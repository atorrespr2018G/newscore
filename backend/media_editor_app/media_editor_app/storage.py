"""Local object storage helpers for media-editor originals and derivatives."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from media_editor_app.config import get_public_base_url, get_storage_root


def save_file(*, content: bytes, media_type: str, extension: str) -> tuple[Path, str]:
    """Persist file content and return its disk path and public URL."""

    now = datetime.now(timezone.utc)
    directory = get_storage_root() / media_type / f"{now.year:04d}" / f"{now.month:02d}"
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}.{extension}"
    file_path = directory / filename
    file_path.write_bytes(content)
    public_path = f"/media/{media_type}/{now.year:04d}/{now.month:02d}/{filename}"
    base_url = get_public_base_url()
    return file_path, f"{base_url}{public_path}" if base_url else public_path


def get_local_path(url: str) -> Path:
    """Convert a local public media URL to its persisted filesystem path."""

    public_path = url.split("/media/", maxsplit=1)[-1]
    return get_storage_root() / public_path
