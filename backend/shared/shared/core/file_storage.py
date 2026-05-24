"""Filesystem and S3-compatible media storage."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from shared.core.exceptions import MediaUploadError

_LOCAL_BACKEND = "local"
_S3_BACKEND = "s3"


def _storage_backend() -> str:
    return os.getenv("MEDIA_STORAGE_BACKEND", _LOCAL_BACKEND).strip().lower()


def _media_root() -> Path:
    media_root = os.getenv("MEDIA_ROOT", "/media")
    return Path(media_root)


def _public_url(relative_path: str) -> str:
    """Build a public URL, prefixing MEDIA_BASE_URL when configured."""

    base = os.getenv("MEDIA_BASE_URL", "").rstrip("/")
    path = relative_path if relative_path.startswith("/") else f"/{relative_path}"
    if base:
        return f"{base}{path}"
    return path


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _save_local(*, rel_dir: Path, content: bytes, extension: str) -> str:
    filename = f"{uuid4().hex}.{extension}"
    abs_dir = _media_root() / rel_dir
    _ensure_dir(abs_dir)
    abs_path = abs_dir / filename
    try:
        abs_path.write_bytes(content)
    except OSError as exc:
        raise MediaUploadError("Failed to save media file", detail=str(exc)) from exc
    return _public_url(f"/media/{rel_dir.as_posix()}/{filename}")


def _s3_client():
    try:
        import boto3
    except ImportError as exc:
        raise MediaUploadError(
            "S3 storage requires boto3; install with pip install boto3",
            detail=str(exc),
        ) from exc

    endpoint = os.getenv("S3_ENDPOINT_URL")
    region = os.getenv("S3_REGION", "us-east-1")
    return boto3.client(
        "s3",
        region_name=region,
        endpoint_url=endpoint or None,
    )


def _save_s3(*, key_prefix: str, content: bytes, extension: str) -> str:
    bucket = os.getenv("S3_BUCKET")
    if not bucket:
        raise MediaUploadError("S3_BUCKET is required when MEDIA_STORAGE_BACKEND=s3")

    key = f"{key_prefix.rstrip('/')}/{uuid4().hex}.{extension}"
    client = _s3_client()
    try:
        client.put_object(Bucket=bucket, Key=key, Body=content)
    except Exception as exc:  # noqa: BLE001 — surface provider error to caller
        raise MediaUploadError("Failed to upload to object storage", detail=str(exc)) from exc

    cdn_base = os.getenv("S3_PUBLIC_BASE_URL", os.getenv("MEDIA_BASE_URL", "")).rstrip("/")
    if cdn_base:
        return f"{cdn_base}/{key.lstrip('/')}"
    return _public_url(f"/media/{key}")


def save_image(*, content: bytes, extension: str) -> str:
    """Persist an image and return its public URL path."""

    now = datetime.now(timezone.utc)
    rel_dir = Path("images") / f"{now.year:04d}" / f"{now.month:02d}"
    if _storage_backend() == _S3_BACKEND:
        return _save_s3(key_prefix=rel_dir.as_posix(), content=content, extension=extension)
    return _save_local(rel_dir=rel_dir, content=content, extension=extension)


def save_video(*, content: bytes, extension: str) -> str:
    """Persist a video and return its public URL path."""

    rel_dir = Path("videos")
    if _storage_backend() == _S3_BACKEND:
        return _save_s3(key_prefix=rel_dir.as_posix(), content=content, extension=extension)
    return _save_local(rel_dir=rel_dir, content=content, extension=extension)


def delete_media_file(*, relative_path: str) -> None:
    """Delete a media file from the active storage backend."""

    if _storage_backend() == _S3_BACKEND:
        bucket = os.getenv("S3_BUCKET")
        if not bucket:
            raise MediaUploadError("S3_BUCKET is required when MEDIA_STORAGE_BACKEND=s3")
        key = relative_path.lstrip("/")
        for prefix in ("media/", "/media/"):
            if key.startswith(prefix.lstrip("/")):
                key = key[len(prefix.lstrip("/")) :]
                break
        client = _s3_client()
        try:
            client.delete_object(Bucket=bucket, Key=key)
        except Exception as exc:  # noqa: BLE001
            raise MediaUploadError("Failed to delete object from storage", detail=str(exc)) from exc
        return

    cleaned = relative_path.lstrip("/")
    abs_path = _media_root().parent / cleaned if cleaned.startswith("media/") else _media_root() / cleaned
    try:
        abs_path.unlink(missing_ok=True)
    except OSError as exc:
        raise MediaUploadError("Failed to delete media file", detail=str(exc)) from exc
