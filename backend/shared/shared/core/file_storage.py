"""Filesystem media storage for development.

This module is intentionally small and swappable. In production, replace it with
an S3 implementation behind the same function signatures.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from shared.core.exceptions import MediaUploadError


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _media_root() -> Path:
    media_root = os.getenv("MEDIA_ROOT", "/media")
    return Path(media_root)


def save_image(*, content: bytes, extension: str) -> str:
    """Persist an image into the year/month images folder.

    Args:
        content: Raw file bytes.
        extension: File extension without dot (e.g. "jpg", "png", "webp").

    Returns:
        Relative URL path (e.g. "/media/images/2026/03/<file>.jpg").

    Raises:
        MediaUploadError: If the file cannot be written.
    """

    now = datetime.now(timezone.utc)
    rel_dir = Path("images") / f"{now.year:04d}" / f"{now.month:02d}"
    filename = f"{uuid4().hex}.{extension}"

    abs_dir = _media_root() / rel_dir
    _ensure_dir(abs_dir)
    abs_path = abs_dir / filename
    try:
        abs_path.write_bytes(content)
    except OSError as exc:
        raise MediaUploadError("Failed to save image", detail=str(exc)) from exc

    return f"/media/{rel_dir.as_posix()}/{filename}"


def save_video(*, content: bytes, extension: str) -> str:
    """Persist a video into the videos folder.

    Args:
        content: Raw file bytes.
        extension: File extension without dot (e.g. "mp4", "webm").

    Returns:
        Relative URL path (e.g. "/media/videos/<file>.mp4").

    Raises:
        MediaUploadError: If the file cannot be written.
    """

    rel_dir = Path("videos")
    filename = f"{uuid4().hex}.{extension}"

    abs_dir = _media_root() / rel_dir
    _ensure_dir(abs_dir)
    abs_path = abs_dir / filename
    try:
        abs_path.write_bytes(content)
    except OSError as exc:
        raise MediaUploadError("Failed to save video", detail=str(exc)) from exc

    return f"/media/{rel_dir.as_posix()}/{filename}"


def delete_media_file(*, relative_path: str) -> None:
    """Delete a media file by its relative path.

    Args:
        relative_path: Relative path returned by save_image/save_video.

    Raises:
        MediaUploadError: If deletion fails unexpectedly.
    """

    cleaned = relative_path.lstrip("/")
    abs_path = _media_root().parent / cleaned if cleaned.startswith("media/") else _media_root() / cleaned
    try:
        abs_path.unlink(missing_ok=True)
    except OSError as exc:
        raise MediaUploadError("Failed to delete media file", detail=str(exc)) from exc

