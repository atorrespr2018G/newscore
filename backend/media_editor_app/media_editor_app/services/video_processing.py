"""FFmpeg-backed probing and multi-segment rendering for newsroom video edits."""

from __future__ import annotations

import tempfile
from dataclasses import dataclass
from pathlib import Path

from media_editor_app.schemas import PictureReplacement, VideoEditInstruction, VideoSegment

_DURATION_SLACK_SECONDS: float = 0.05
_MIN_PIECE_SECONDS: float = 0.05


def _ffmpeg_module():
    """Import the optional FFmpeg Python wrapper with a useful failure."""

    try:
        import ffmpeg
    except ImportError as exc:
        raise ValueError("Video processing requires ffmpeg-python") from exc
    return ffmpeg


def probe_video(file_path: Path) -> tuple[int | None, int | None, float | None]:
    """Return video dimensions and duration using ffprobe."""

    ffmpeg = _ffmpeg_module()
    try:
        metadata = ffmpeg.probe(str(file_path))
    except ffmpeg.Error as exc:
        raise ValueError("Unable to read uploaded video") from exc
    stream = next((item for item in metadata["streams"] if item["codec_type"] == "video"), None)
    if stream is None:
        raise ValueError("Uploaded file does not contain a video stream")
    duration = float(metadata["format"].get("duration", 0)) or None
    return stream.get("width"), stream.get("height"), duration


@dataclass(frozen=True)
class _PicturePiece:
    """One contiguous video-only span on the composed timeline."""

    source_path: Path
    source_start: float
    duration: float
    from_insert: bool
    is_still: bool


@dataclass(frozen=True)
class ResolvedInsertSource:
    """Local media used as a picture insert over the base clip."""

    path: Path
    is_still: bool


def extract_video_poster(video_path: Path) -> bytes:
    """Extract a JPEG poster frame from a video for library thumbnails.

    Args:
        video_path: Local path to an MP4 (or other FFmpeg-readable video).

    Returns:
        JPEG image bytes.

    Raises:
        ValueError: If no poster frame can be extracted.
    """

    for at_seconds in (0.5, 0.0):
        try:
            return _extract_poster_at(video_path, at_seconds)
        except ValueError:
            continue
    raise ValueError("Failed to extract video poster frame")


def _extract_poster_at(video_path: Path, at_seconds: float) -> bytes:
    """Grab one JPEG frame at a timestamp.

    Args:
        video_path: Local video path.
        at_seconds: Seek position before grabbing the frame.

    Returns:
        JPEG bytes for the frame.

    Raises:
        ValueError: If FFmpeg fails or the frame file is empty.
    """

    ffmpeg = _ffmpeg_module()
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as handle:
        poster_path = Path(handle.name)
    try:
        (
            ffmpeg.input(str(video_path), ss=at_seconds)
            .output(str(poster_path), vframes=1, format="image2", **{"qscale:v": 2})
            .overwrite_output()
            .run(quiet=True)
        )
        content = poster_path.read_bytes()
        if not content:
            raise ValueError("Poster frame was empty")
        return content
    except ffmpeg.Error as exc:
        raise ValueError("Unable to extract video poster frame") from exc
    finally:
        poster_path.unlink(missing_ok=True)


def probe_audio_duration(file_path: Path) -> float | None:
    """Return duration for an audio file using ffprobe.

    Args:
        file_path: Local path to an audio upload.

    Returns:
        Duration in seconds, or None when unknown.

    Raises:
        ValueError: If ffprobe cannot read the file or no audio stream exists.
    """

    ffmpeg = _ffmpeg_module()
    try:
        metadata = ffmpeg.probe(str(file_path))
    except ffmpeg.Error as exc:
        raise ValueError("Unable to read uploaded audio") from exc
    stream = next((item for item in metadata["streams"] if item["codec_type"] == "audio"), None)
    if stream is None:
        raise ValueError("Uploaded file does not contain an audio stream")
    return float(metadata["format"].get("duration", 0)) or None


def render_video(
    source_path: Path,
    output_path: Path,
    instruction: VideoEditInstruction,
    *,
    replace_audio_path: Path | None = None,
    insert_sources: dict[str, ResolvedInsertSource] | None = None,
) -> None:
    """Render a cut package or picture-insert composition via FFmpeg.

    Args:
        source_path: Local path to the source video.
        output_path: Destination path for the rendered MP4.
        instruction: Segments, picture replacements, overlays, and audio flags.
        replace_audio_path: Optional soundtrack to mux over a cut package.
        insert_sources: Map of asset id → image/video path for picture inserts.

    Raises:
        ValueError: If the instruction is invalid or FFmpeg fails.
    """

    if instruction.mute_audio and replace_audio_path is not None:
        raise ValueError("Cannot mute audio and replace audio in the same render")
    if instruction.picture_replacements:
        _render_picture_replacements(
            source_path,
            output_path,
            instruction,
            insert_sources=insert_sources or {},
        )
        return
    ffmpeg = _ffmpeg_module()
    _, _, source_duration = probe_video(source_path)
    segments = _validated_segments(instruction.segments, source_duration)
    with tempfile.TemporaryDirectory(prefix="media-editor-video-") as temp_dir:
        temp_root = Path(temp_dir)
        clip_paths = [
            _extract_segment(ffmpeg, source_path, temp_root, index, segment)
            for index, segment in enumerate(segments)
        ]
        concat_path = temp_root / "joined.mp4"
        _concat_clips(ffmpeg, clip_paths, concat_path)
        pictured_path = temp_root / "pictured.mp4"
        _apply_overlays_and_write(ffmpeg, concat_path, pictured_path, instruction)
        _apply_audio_stage(
            ffmpeg,
            pictured_path,
            output_path,
            mute_audio=instruction.mute_audio,
            replace_audio_path=replace_audio_path,
        )


def _render_picture_replacements(
    source_path: Path,
    output_path: Path,
    instruction: VideoEditInstruction,
    *,
    insert_sources: dict[str, ResolvedInsertSource],
) -> None:
    """Punch images/videos into the picture while muxing the original full-length audio.

    Args:
        source_path: Base A-roll video path.
        output_path: Destination MP4.
        instruction: Must include at least one picture replacement.
        insert_sources: Resolved local image/video paths keyed by asset id.

    Raises:
        ValueError: If replacements are invalid or FFmpeg fails.
    """

    ffmpeg = _ffmpeg_module()
    width, height, source_duration = probe_video(source_path)
    if source_duration is None or source_duration <= 0:
        raise ValueError("Source video duration is unknown")
    if width is None or height is None or width <= 0 or height <= 0:
        raise ValueError("Source video dimensions are unknown")
    pieces = _build_picture_pieces(
        source_path=source_path,
        source_duration=source_duration,
        replacements=instruction.picture_replacements,
        insert_sources=insert_sources,
    )
    with tempfile.TemporaryDirectory(prefix="media-editor-picture-") as temp_dir:
        temp_root = Path(temp_dir)
        clip_paths = [
            _extract_video_only_piece(
                ffmpeg,
                piece=piece,
                temp_root=temp_root,
                index=index,
                width=width,
                height=height,
            )
            for index, piece in enumerate(pieces)
        ]
        silent_path = temp_root / "picture-silent.mp4"
        _concat_video_only_clips(ffmpeg, clip_paths, silent_path)
        pictured_path = temp_root / "pictured.mp4"
        _apply_overlays_video_only(ffmpeg, silent_path, pictured_path, instruction)
        _mux_source_audio(ffmpeg, pictured_path, source_path, output_path)


def _validated_segments(segments: list[VideoSegment], source_duration: float | None) -> list[VideoSegment]:
    """Return segments after checking they fit inside the source duration."""

    if not segments:
        raise ValueError("At least one video segment is required")
    for index, segment in enumerate(segments):
        if source_duration is not None and segment.end_seconds > source_duration + _DURATION_SLACK_SECONDS:
            raise ValueError(
                f"Segment {index + 1} ends at {segment.end_seconds:.2f}s but the source is only "
                f"{source_duration:.2f}s long",
            )
    return segments


def _build_picture_pieces(
    *,
    source_path: Path,
    source_duration: float,
    replacements: list[PictureReplacement],
    insert_sources: dict[str, ResolvedInsertSource],
) -> list[_PicturePiece]:
    """Build sorted video-only pieces covering the full base timeline.

    Args:
        source_path: Base A-roll path.
        source_duration: Probed base duration in seconds.
        replacements: Punch-in windows from the edit instruction.
        insert_sources: Resolved image/video inserts keyed by asset id.

    Returns:
        Contiguous pieces from 0 to source_duration.

    Raises:
        ValueError: On missing insert, overlap, out-of-range window, or short video.
    """

    if not replacements:
        raise ValueError("At least one picture replacement is required")
    ordered = sorted(replacements, key=lambda item: item.at_seconds)
    validated: list[tuple[PictureReplacement, ResolvedInsertSource]] = []
    previous_end = 0.0
    for index, replacement in enumerate(ordered):
        end_at = replacement.at_seconds + replacement.duration_seconds
        if end_at > source_duration + _DURATION_SLACK_SECONDS:
            raise ValueError(
                f"Picture replacement {index + 1} ends at {end_at:.2f}s but the source is only "
                f"{source_duration:.2f}s long",
            )
        if replacement.at_seconds + _DURATION_SLACK_SECONDS < previous_end:
            raise ValueError(f"Picture replacement {index + 1} overlaps a previous replacement")
        insert = insert_sources.get(replacement.source_asset_id)
        if insert is None or not insert.path.exists():
            raise ValueError(f"Insert media for replacement {index + 1} was not found")
        if not insert.is_still:
            _, _, insert_duration = probe_video(insert.path)
            if insert_duration is None or insert_duration <= 0:
                raise ValueError(f"Insert video duration for replacement {index + 1} is unknown")
            if replacement.source_in_seconds >= insert_duration - _DURATION_SLACK_SECONDS:
                raise ValueError(
                    f"Insert video in-point for replacement {index + 1} is past the end of the clip",
                )
        validated.append((replacement, insert))
        previous_end = end_at

    pieces: list[_PicturePiece] = []
    cursor = 0.0
    for replacement, insert in validated:
        gap = replacement.at_seconds - cursor
        if gap > _MIN_PIECE_SECONDS:
            pieces.append(
                _PicturePiece(
                    source_path=source_path,
                    source_start=cursor,
                    duration=gap,
                    from_insert=False,
                    is_still=False,
                ),
            )
        pieces.append(
            _PicturePiece(
                source_path=insert.path,
                source_start=0.0 if insert.is_still else replacement.source_in_seconds,
                duration=replacement.duration_seconds,
                from_insert=True,
                is_still=insert.is_still,
            ),
        )
        cursor = replacement.at_seconds + replacement.duration_seconds
    tail = source_duration - cursor
    if tail > _MIN_PIECE_SECONDS:
        pieces.append(
            _PicturePiece(
                source_path=source_path,
                source_start=cursor,
                duration=tail,
                from_insert=False,
                is_still=False,
            ),
        )
    if not pieces:
        raise ValueError("Picture replacements produced an empty timeline")
    return pieces


def _extract_video_only_piece(
    ffmpeg,
    *,
    piece: _PicturePiece,
    temp_root: Path,
    index: int,
    width: int,
    height: int,
) -> Path:
    """Extract one scaled video-only clip (or still hold) for composition.

    Args:
        ffmpeg: Loaded ffmpeg-python module.
        piece: Source span to extract.
        temp_root: Temporary directory for the clip.
        index: Zero-based piece index for naming.
        width: Target frame width from the base video.
        height: Target frame height from the base video.

    Returns:
        Path to the temporary muted MP4 clip.

    Raises:
        ValueError: If FFmpeg fails.
    """

    clip_path = temp_root / f"picture-{index:02d}.mp4"
    scale_filter = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30"
    )
    try:
        if piece.is_still:
            stream = ffmpeg.input(str(piece.source_path), loop=1, framerate=30, t=piece.duration)
        elif piece.from_insert:
            # Loop short inserts so they fully cover the replaced base segment.
            stream = ffmpeg.input(
                str(piece.source_path),
                ss=piece.source_start,
                stream_loop=-1,
                t=piece.duration,
            )
        else:
            stream = ffmpeg.input(str(piece.source_path), ss=piece.source_start, t=piece.duration)
        (
            stream.output(
                str(clip_path),
                vf=scale_filter,
                vcodec="libx264",
                an=None,
                avoid_negative_ts="make_zero",
                movflags="+faststart",
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        if piece.is_still:
            label = "still"
        elif piece.from_insert:
            label = "insert video"
        else:
            label = "base"
        raise ValueError(f"Failed to extract {label} picture piece {index + 1}") from exc
    return clip_path


def _concat_video_only_clips(ffmpeg, clip_paths: list[Path], output_path: Path) -> None:
    """Concatenate muted video clips into one video-only MP4.

    Args:
        ffmpeg: Loaded ffmpeg-python module.
        clip_paths: Ordered temporary clips.
        output_path: Destination path for the silent concat.

    Raises:
        ValueError: If FFmpeg fails.
    """

    if len(clip_paths) == 1:
        output_path.write_bytes(clip_paths[0].read_bytes())
        return
    list_path = output_path.parent / "picture-concat.txt"
    list_path.write_text(
        "\n".join(f"file '{path.as_posix()}'" for path in clip_paths),
        encoding="utf-8",
    )
    try:
        (
            ffmpeg.input(str(list_path), format="concat", safe=0)
            .output(str(output_path), vcodec="libx264", an=None, movflags="+faststart")
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise ValueError("Failed to concatenate picture pieces") from exc


def _apply_overlays_video_only(
    ffmpeg,
    source_path: Path,
    output_path: Path,
    instruction: VideoEditInstruction,
) -> None:
    """Burn optional overlays onto a video-only intermediate.

    Args:
        ffmpeg: Loaded ffmpeg-python module.
        source_path: Silent composed picture.
        output_path: Destination with overlays applied (still silent).
        instruction: Optional title, lower third, and logo.

    Raises:
        ValueError: If overlay rendering fails.
    """

    has_overlay = bool(instruction.title or instruction.lower_third or instruction.logo_url)
    if not has_overlay:
        if source_path.resolve() != output_path.resolve():
            output_path.write_bytes(source_path.read_bytes())
        return
    stream = ffmpeg.input(str(source_path))
    video = stream.video
    if instruction.logo_url:
        logo = ffmpeg.input(str(instruction.logo_url))
        video = ffmpeg.overlay(video, logo, x=20, y=20)
    if instruction.title:
        video = video.drawtext(text=instruction.title, x="(w-text_w)/2", y=40)
    if instruction.lower_third:
        video = video.drawtext(text=instruction.lower_third, x=40, y="h-80")
    try:
        (
            ffmpeg.output(video, str(output_path), vcodec="libx264", an=None, movflags="+faststart")
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise ValueError("Video overlay rendering failed") from exc


def _mux_source_audio(
    ffmpeg,
    picture_path: Path,
    source_path: Path,
    output_path: Path,
) -> None:
    """Mux the base clip's original audio onto a composed picture timeline.

    Args:
        ffmpeg: Loaded ffmpeg-python module.
        picture_path: Silent composed video.
        source_path: Base A-roll that supplies audio from t=0.
        output_path: Final MP4 destination.

    Raises:
        ValueError: If FFmpeg fails.
    """

    picture = ffmpeg.input(str(picture_path))
    audio = ffmpeg.input(str(source_path)).audio
    try:
        (
            ffmpeg.output(
                picture.video,
                audio,
                str(output_path),
                vcodec="copy",
                acodec="aac",
                shortest=None,
                movflags="+faststart",
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise ValueError("Failed to mux original audio onto picture inserts") from exc


def _extract_segment(
    ffmpeg,
    source_path: Path,
    temp_root: Path,
    index: int,
    segment: VideoSegment,
) -> Path:
    """Trim one A/V segment into a temporary MP4 clip."""

    duration = segment.end_seconds - segment.start_seconds
    clip_path = temp_root / f"segment-{index:02d}.mp4"
    try:
        (
            ffmpeg.input(str(source_path), ss=segment.start_seconds, t=duration)
            .output(
                str(clip_path),
                vcodec="libx264",
                acodec="aac",
                avoid_negative_ts="make_zero",
                movflags="+faststart",
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise ValueError(f"Failed to extract video segment {index + 1}") from exc
    return clip_path


def merge_video_files(source_paths: list[Path], output_path: Path) -> None:
    """Normalize and concatenate several source videos into one MP4.

    Args:
        source_paths: Local paths of owned source/edited videos, in output order.
        output_path: Destination path for the merged MP4.

    Raises:
        ValueError: If fewer than two sources are provided or FFmpeg fails.
    """

    if len(source_paths) < 2:
        raise ValueError("At least two videos are required to merge")
    ffmpeg = _ffmpeg_module()
    with tempfile.TemporaryDirectory(prefix="media-editor-merge-") as temp_dir:
        temp_root = Path(temp_dir)
        normalized = [
            _normalize_clip(ffmpeg, source_path, temp_root / f"norm-{index:02d}.mp4", index)
            for index, source_path in enumerate(source_paths)
        ]
        _concat_clips(ffmpeg, normalized, output_path)


def _normalize_clip(ffmpeg, source_path: Path, clip_path: Path, index: int) -> Path:
    """Re-encode one source file to a consistent H.264/AAC MP4 for concatenation."""

    if not source_path.exists():
        raise ValueError(f"Video file for merge item {index + 1} was not found on disk")
    try:
        (
            ffmpeg.input(str(source_path))
            .output(
                str(clip_path),
                vcodec="libx264",
                acodec="aac",
                avoid_negative_ts="make_zero",
                movflags="+faststart",
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise ValueError(f"Failed to prepare video {index + 1} for merge") from exc
    return clip_path


def _concat_clips(ffmpeg, clip_paths: list[Path], output_path: Path) -> None:
    """Concatenate temporary clips into one MP4 with a fresh encode."""

    if len(clip_paths) == 1:
        output_path.write_bytes(clip_paths[0].read_bytes())
        return
    list_path = output_path.parent / "concat.txt"
    list_path.write_text(
        "\n".join(f"file '{path.as_posix()}'" for path in clip_paths),
        encoding="utf-8",
    )
    try:
        (
            ffmpeg.input(str(list_path), format="concat", safe=0)
            .output(str(output_path), vcodec="libx264", acodec="aac", movflags="+faststart")
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise ValueError("Failed to concatenate video segments") from exc


def _apply_overlays_and_write(ffmpeg, source_path: Path, output_path: Path, instruction: VideoEditInstruction) -> None:
    """Copy or re-encode with optional title/lower-third/logo burn-ins."""

    has_overlay = bool(instruction.title or instruction.lower_third or instruction.logo_url)
    if not has_overlay:
        if source_path.resolve() != output_path.resolve():
            output_path.write_bytes(source_path.read_bytes())
        return
    stream = ffmpeg.input(str(source_path))
    video = stream.video
    audio = stream.audio
    if instruction.logo_url:
        logo = ffmpeg.input(str(instruction.logo_url))
        video = ffmpeg.overlay(video, logo, x=20, y=20)
    if instruction.title:
        video = video.drawtext(text=instruction.title, x="(w-text_w)/2", y=40)
    if instruction.lower_third:
        video = video.drawtext(text=instruction.lower_third, x=40, y="h-80")
    try:
        (
            ffmpeg.output(video, audio, str(output_path), vcodec="libx264", acodec="aac", movflags="+faststart")
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise ValueError("Video overlay rendering failed") from exc


def _apply_audio_stage(
    ffmpeg,
    video_path: Path,
    output_path: Path,
    *,
    mute_audio: bool,
    replace_audio_path: Path | None,
) -> None:
    """Mute, replace, or pass through audio after the picture is finalized.

    Args:
        ffmpeg: Loaded ffmpeg-python module.
        video_path: Intermediate MP4 with picture (and optional original audio).
        output_path: Final destination MP4.
        mute_audio: When True, write a video-only file.
        replace_audio_path: When set, mux this soundtrack and drop original audio.

    Raises:
        ValueError: If FFmpeg fails or the replacement file is missing.
    """

    if not mute_audio and replace_audio_path is None:
        if video_path.resolve() != output_path.resolve():
            output_path.write_bytes(video_path.read_bytes())
        return
    if mute_audio:
        _write_muted_video(ffmpeg, video_path, output_path)
        return
    if replace_audio_path is None or not replace_audio_path.exists():
        raise ValueError("Replacement audio file was not found")
    _write_replaced_audio(ffmpeg, video_path, replace_audio_path, output_path)


def _write_muted_video(ffmpeg, video_path: Path, output_path: Path) -> None:
    """Write a video-only MP4 with no audio stream."""

    stream = ffmpeg.input(str(video_path))
    try:
        (
            ffmpeg.output(stream.video, str(output_path), vcodec="copy", movflags="+faststart")
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise ValueError("Failed to mute video audio") from exc


def _write_replaced_audio(
    ffmpeg,
    video_path: Path,
    audio_path: Path,
    output_path: Path,
) -> None:
    """Mux replacement audio onto the full picture length.

    Short narration is padded with silence so the video is never truncated.
    Long narration is cut at the end of the picture via ``-shortest``.
    """

    video_in = ffmpeg.input(str(video_path))
    # apad extends short audio with silence; -shortest then ends on the video.
    audio = ffmpeg.input(str(audio_path)).audio.filter("apad")
    try:
        (
            ffmpeg.output(
                video_in.video,
                audio,
                str(output_path),
                vcodec="copy",
                acodec="aac",
                shortest=None,
                movflags="+faststart",
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise ValueError("Failed to replace video audio") from exc
