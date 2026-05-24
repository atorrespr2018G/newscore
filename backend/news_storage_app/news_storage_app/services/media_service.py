"""Media upload service for images and videos."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.constants import SUPPORTED_IMAGE_TYPES, SUPPORTED_VIDEO_TYPES
from shared.core.exceptions import MediaUploadError, PayloadTooLargeError
from shared.core.file_storage import delete_media_file, save_image, save_video
from shared.schemas.media_schemas import MediaOut

MEDIA_COLLECTION = "media"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _max_upload_bytes() -> int:
    max_mb = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
    return max_mb * 1024 * 1024


def _to_out(doc: dict[str, Any]) -> MediaOut:
    return MediaOut(
        id=str(doc["_id"]),
        file_type=doc["file_type"],
        url=doc["url"],
        width=doc.get("width"),
        height=doc.get("height"),
        duration=doc.get("duration"),
        uploader_id=doc["uploader_id"],
        created_at=doc.get("created_at", ""),
    )


async def _read_upload_limited(file: UploadFile) -> bytes:
    """Read upload body up to MAX_FILE_SIZE_MB; reject oversized payloads."""

    max_bytes = _max_upload_bytes()
    if file.size is not None and file.size > max_bytes:
        raise PayloadTooLargeError(f"File exceeds {max_bytes // (1024 * 1024)} MB limit")

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise PayloadTooLargeError(f"File exceeds {max_bytes // (1024 * 1024)} MB limit")
        chunks.append(chunk)

    content = b"".join(chunks)
    if not content:
        raise MediaUploadError("Empty file")
    return content


async def upload_image(db: AsyncIOMotorDatabase, *, file: UploadFile, uploader_id: str) -> MediaOut:
    """Upload an image to dev filesystem and create a media document."""

    if file.content_type not in SUPPORTED_IMAGE_TYPES:
        raise MediaUploadError("Unsupported image type")

    content = await _read_upload_limited(file)
    extension = (file.filename or "upload").split(".")[-1].lower()
    url = save_image(content=content, extension=extension)

    media_id = str(uuid4())
    doc = {
        "_id": media_id,
        "file_type": "image",
        "url": url,
        "width": None,
        "height": None,
        "duration": None,
        "uploader_id": uploader_id,
        "created_at": _utc_now_iso(),
    }
    await db[MEDIA_COLLECTION].insert_one(doc)
    return _to_out(doc)


async def upload_video(db: AsyncIOMotorDatabase, *, file: UploadFile, uploader_id: str) -> MediaOut:
    """Upload a video to dev filesystem and create a media document."""

    if file.content_type not in SUPPORTED_VIDEO_TYPES:
        raise MediaUploadError("Unsupported video type")

    content = await _read_upload_limited(file)
    extension = (file.filename or "upload").split(".")[-1].lower()
    url = save_video(content=content, extension=extension)

    media_id = str(uuid4())
    doc = {
        "_id": media_id,
        "file_type": "video",
        "url": url,
        "width": None,
        "height": None,
        "duration": None,
        "uploader_id": uploader_id,
        "created_at": _utc_now_iso(),
    }
    await db[MEDIA_COLLECTION].insert_one(doc)
    return _to_out(doc)


async def delete_media(db: AsyncIOMotorDatabase, *, media_id: str) -> None:
    """Delete a media document and its underlying file (best effort)."""

    doc = await db[MEDIA_COLLECTION].find_one({"_id": media_id})
    if doc is None:
        return
    url = str(doc.get("url") or "")
    if url:
        delete_media_file(relative_path=url)
    await db[MEDIA_COLLECTION].delete_one({"_id": media_id})
