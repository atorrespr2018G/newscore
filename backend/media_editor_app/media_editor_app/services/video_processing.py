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


def render_video(source_path: Path, output_path: Path, instruction: VideoEditInstruction) -> None:
    """Extract ordered segments, concatenate into one MP4, and apply optional overlays.

    Args:
        source_path: Local path to the source video.
        output_path: Destination path for the rendered MP4.
        instruction: Ordered segments plus optional burn-in fields.

    Raises:
        ValueError: If segments are invalid or FFmpeg fails.
    """

    ffmpeg = _ffmpeg_module()
    _, _, source_duration = probe_video(source_path)
    segments = _validated_segments(instruction.segments, source_duration)
    with tempfile.TemporaryDirectory(prefix="media-editor-video-") as temp_dir:
        temp_root = Path(temp_dir)
        clip_paths = [_extract_segment(ffmpeg, source_path, temp_root, index, segment) for index, segment in enumerate(segments)]
        concat_path = temp_root / "joined.mp4"
        _concat_clips(ffmpeg, clip_paths, concat_path)
        _apply_overlays_and_write(ffmpeg, concat_path, output_path, instruction)


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
