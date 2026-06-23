"""Media asset read operations."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.read.collections import MEDIA_COLLECTION
from shared.schemas.media_schemas import MediaOut

MEDIA_BY_IDS_LOOKUP_LIMIT = 50


def media_out(doc: dict[str, Any]) -> MediaOut:
    """Map a Mongo media document to MediaOut.

    Args:
        doc: Raw media document.

    Returns:
        The media asset response schema.
    """

    return MediaOut(
        id=str(doc["_id"]),
        file_type=doc["file_type"],
        url=doc["url"],
        width=doc.get("width"),
        height=doc.get("height"),
        duration=doc.get("duration"),
        uploader_id=str(doc.get("uploader_id", "")),
        created_at=str(doc.get("created_at", "")),
    )


async def list_media_by_ids(
    db: AsyncIOMotorDatabase,
    *,
    media_ids: list[str],
) -> list[MediaOut]:
    """Load media assets by id list, preserving the requested order.

    Args:
        db: Database connection.
        media_ids: Ordered media ids to resolve.

    Returns:
        Media assets in the same order as the requested ids, skipping any id
        that no longer resolves to a stored asset.
    """

    if not media_ids:
        return []

    cursor = db[MEDIA_COLLECTION].find({"_id": {"$in": media_ids}}).limit(
        MEDIA_BY_IDS_LOOKUP_LIMIT
    )
    docs = {str(doc["_id"]): doc async for doc in cursor}

    ordered: list[MediaOut] = []
    for media_id in media_ids:
        doc = docs.get(media_id)
        if doc is not None:
            ordered.append(media_out(doc))
    return ordered
