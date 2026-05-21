"""Media upload service for images and videos."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.constants import SUPPORTED_IMAGE_TYPES, SUPPORTED_VIDEO_TYPES
from shared.core.exceptions import MediaUploadError
from shared.core.file_storage import delete_media_file, save_image, save_video
from shared.schemas.media_schemas import MediaOut

MEDIA_COLLECTION = "media"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


async def upload_image(db: AsyncIOMotorDatabase, *, file: UploadFile, uploader_id: str) -> MediaOut:
    """Upload an image to dev filesystem and create a media document."""

    if file.content_type not in SUPPORTED_IMAGE_TYPES:
        raise MediaUploadError("Unsupported image type")

    content = await file.read()
    if not content:
        raise MediaUploadError("Empty file")

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

    content = await file.read()
    if not content:
        raise MediaUploadError("Empty file")

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

