"""FFmpeg-backed probing and rendering for basic newsroom video edits."""

from __future__ import annotations

from pathlib import Path

from media_editor_app.schemas import VideoEditInstruction


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
    """Render basic trim and text overlays to an MP4 derivative."""

    ffmpeg = _ffmpeg_module()
    input_stream = ffmpeg.input(str(source_path), ss=instruction.trim_start_seconds)
    output_stream = input_stream
    if instruction.trim_end_seconds is not None:
        duration = instruction.trim_end_seconds - instruction.trim_start_seconds
        if duration <= 0:
            raise ValueError("Video end time must be after its start time")
        output_stream = output_stream.filter("trim", duration=duration)
    if instruction.logo_url:
        logo_stream = ffmpeg.input(str(instruction.logo_url))
        output_stream = ffmpeg.overlay(output_stream, logo_stream, x=20, y=20)
    if instruction.title:
        output_stream = output_stream.drawtext(text=instruction.title, x="(w-text_w)/2", y=40)
    if instruction.lower_third:
        output_stream = output_stream.drawtext(text=instruction.lower_third, x=40, y="h-80")
    try:
        ffmpeg.output(output_stream, str(output_path), vcodec="libx264", acodec="aac").overwrite_output().run()
    except ffmpeg.Error as exc:
        raise ValueError("Video rendering failed") from exc
