"""Environment configuration for the independent media editor service."""

from __future__ import annotations

import os
from pathlib import Path


def get_mongo_uri() -> str:
    """Return the configured MongoDB connection URI.

    Raises:
        RuntimeError: If no database URI is configured.
    """

    uri = os.getenv("MEDIA_EDITOR_MONGO_URI", os.getenv("MONGO_URI", "")).strip()
    if not uri:
        raise RuntimeError("MEDIA_EDITOR_MONGO_URI is required")
    return uri


def get_database_name() -> str:
    """Return the isolated database name for media-editor documents."""

    return os.getenv("MEDIA_EDITOR_MONGO_DB_NAME", "newscore_media_editor")


def get_storage_root() -> Path:
    """Return the filesystem location used by local media storage."""

    return Path(os.getenv("MEDIA_EDITOR_STORAGE_ROOT", "/media-editor"))


def get_public_base_url() -> str:
    """Return the public base URL for stored media files."""

    return os.getenv("MEDIA_EDITOR_PUBLIC_BASE_URL", "").rstrip("/")


def get_allowed_origins() -> list[str]:
    """Return the explicit CORS origins permitted to call this API."""

    raw_origins = os.getenv("MEDIA_EDITOR_CORS_ORIGINS", "http://localhost:3004")
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def get_max_upload_bytes() -> int:
    """Return the maximum accepted upload size in bytes."""

    max_size_mb = int(os.getenv("MEDIA_EDITOR_MAX_UPLOAD_MB", "250"))
    return max_size_mb * 1024 * 1024
