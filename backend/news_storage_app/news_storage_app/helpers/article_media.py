"""Media normalization and image-cap helpers for articles."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import ValidationError
from shared.schemas.article_schemas import DEFAULT_MAX_IMAGE_COUNT
from news_storage_app.services.media_service import MEDIA_COLLECTION

MEDIA_IMAGE_TYPE = "image"


def _resolve_max_image_count(existing: dict[str, Any], requested: int | None) -> int:
    """Resolve the effective max image count for an article document.

    Args:
        existing: Current persisted article document.
        requested: Requested max image count from an update payload, if any.

    Returns:
        Effective max image count.
    """

    if requested is not None:
        return requested
    stored = existing.get("max_image_count")
    if stored is not None:
        return int(stored)
    return DEFAULT_MAX_IMAGE_COUNT


def _normalize_media_ids(media_ids: list[str]) -> list[str]:
    """Strip blanks from an ordered media id list, preserving order.

    Args:
        media_ids: Raw ordered media ids (images and/or videos).

    Returns:
        Cleaned, order-preserving media id list.
    """

    return [str(media_id).strip() for media_id in media_ids if str(media_id).strip()]


async def _count_image_media_ids(db: AsyncIOMotorDatabase, media_ids: list[str]) -> int:
    """Count how many of the given media ids reference image assets.

    Videos and unknown ids are excluded so only images are capped.

    Args:
        db: Database connection.
        media_ids: Ordered media ids attached to the article.

    Returns:
        Number of image-type media among the ids.
    """

    if not media_ids:
        return 0
    return await db[MEDIA_COLLECTION].count_documents(
        {"_id": {"$in": media_ids}, "file_type": MEDIA_IMAGE_TYPE}
    )


async def _assert_image_cap(
    db: AsyncIOMotorDatabase,
    media_ids: list[str],
    *,
    max_image_count: int,
) -> None:
    """Enforce that the article's image media stay within the image cap.

    Videos may be attached freely via ``media_ids``; only images count toward
    ``max_image_count`` so a story can carry multiple videos alongside images.

    Args:
        db: Database connection.
        media_ids: Normalized ordered media ids (images and/or videos).
        max_image_count: Maximum allowed image assets.

    Raises:
        ValidationError: If the image count exceeds ``max_image_count``.
    """

    image_count = await _count_image_media_ids(db, media_ids)
    if image_count > max_image_count:
        raise ValidationError(
            f"Article has {image_count} images but max_image_count is {max_image_count}"
        )


async def _thumbnail_from_media_ids(
    db: AsyncIOMotorDatabase,
    media_ids: list[str],
) -> str | None:
    """Return the URL of the first image asset in media_ids order.

    Args:
        db: Database connection.
        media_ids: Ordered media id list attached to the article.

    Returns:
        Public URL for the lead image, or None when no image media exists.
    """

    if not media_ids:
        return None

    cursor = db[MEDIA_COLLECTION].find(
        {"_id": {"$in": media_ids}, "file_type": MEDIA_IMAGE_TYPE},
        {"_id": 1, "url": 1},
    )
    docs = {str(doc["_id"]): doc async for doc in cursor}
    for media_id in media_ids:
        doc = docs.get(media_id)
        url = doc.get("url") if doc else None
        if isinstance(url, str) and url.strip():
            return url.strip()
    return None


async def _resolve_thumbnail_url(
    db: AsyncIOMotorDatabase,
    *,
    media_ids: list[str],
    explicit: str | None,
) -> str | None:
    """Resolve thumbnail_url from an explicit value or the first attached image.

    Args:
        db: Database connection.
        media_ids: Ordered media id list attached to the article.
        explicit: Caller-provided thumbnail URL, if any.

    Returns:
        Resolved thumbnail URL or None.
    """

    if explicit:
        return explicit
    return await _thumbnail_from_media_ids(db, media_ids)
