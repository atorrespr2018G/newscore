"""FFmpeg-backed probing and multi-segment rendering for newsroom video edits."""

from __future__ import annotations

import tempfile
from pathlib import Path

from media_editor_app.schemas import VideoEditInstruction, VideoSegment


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
) -> None:
    """Extract ordered segments, concatenate, apply overlays, then mute or replace audio.

    Args:
        source_path: Local path to the source video.
        output_path: Destination path for the rendered MP4.
        instruction: Ordered segments plus optional burn-in and audio flags.
        replace_audio_path: Optional soundtrack to mux over the rendered picture.

    Raises:
        ValueError: If segments are invalid, audio options conflict, or FFmpeg fails.
    """

    if instruction.mute_audio and replace_audio_path is not None:
        raise ValueError("Cannot mute audio and replace audio in the same render")
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


def _validated_segments(segments: list[VideoSegment], source_duration: float | None) -> list[VideoSegment]:
    """Return segments after checking they fit inside the source duration."""

    if not segments:
        raise ValueError("At least one video segment is required")
    for index, segment in enumerate(segments):
        if source_duration is not None and segment.end_seconds > source_duration + 0.05:
            raise ValueError(
                f"Segment {index + 1} ends at {segment.end_seconds:.2f}s but the source is only "
                f"{source_duration:.2f}s long",
            )
    return segments


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
    """Mux replacement audio onto the picture, trimming to the shorter stream."""

    video_in = ffmpeg.input(str(video_path))
    audio_in = ffmpeg.input(str(audio_path))
    try:
        (
            ffmpeg.output(
                video_in.video,
                audio_in.audio,
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
