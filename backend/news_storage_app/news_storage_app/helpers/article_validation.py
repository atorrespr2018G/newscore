"""Validation helpers for article create and update flows."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import ValidationError
from shared.read.collections import CATEGORIES_COLLECTION, MARKETS_COLLECTION
from shared.schemas.article_schemas import (
    DEFAULT_MAX_IMAGE_COUNT,
    MAX_CATEGORY_COUNT,
    MIN_CATEGORY_COUNT,
    ArticleCreate,
)


async def _validate_market_ids(db: AsyncIOMotorDatabase, market_ids: list[str]) -> list[str]:
    """Normalize and validate market ids against the markets collection.

    Args:
        db: Database connection.
        market_ids: Raw market ids submitted by the client.

    Returns:
        Normalized market id list.

    Raises:
        ValidationError: If no market ids are provided or an id is unknown.
    """

    if not market_ids:
        raise ValidationError("At least one market_id is required")

    normalized = [str(mid).strip() for mid in market_ids if str(mid).strip()]
    if not normalized:
        raise ValidationError("At least one market_id is required")

    for market_id in normalized:
        exists = await db[MARKETS_COLLECTION].find_one({"_id": market_id}, {"_id": 1})
        if exists is None:
            raise ValidationError(f"Unknown market_id: {market_id}")

    return normalized


async def _validate_category_ids(db: AsyncIOMotorDatabase, category_ids: list[str]) -> list[str]:
    """Normalize and validate the selected category ids.

    Enforces the editorial rule that a story belongs to between one and three
    sections, with no duplicates, and that every id exists.

    Args:
        db: Database connection.
        category_ids: Raw category ids submitted by the client.

    Returns:
        Ordered, de-duplicated category id list.

    Raises:
        ValidationError: If the count is out of range or an id is unknown.
    """

    normalized: list[str] = []
    for cid in category_ids:
        clean = str(cid).strip()
        if clean and clean not in normalized:
            normalized.append(clean)

    if len(normalized) < MIN_CATEGORY_COUNT:
        raise ValidationError(f"Select at least {MIN_CATEGORY_COUNT} category")
    if len(normalized) > MAX_CATEGORY_COUNT:
        raise ValidationError(f"Select no more than {MAX_CATEGORY_COUNT} categories")

    for category_id in normalized:
        exists = await db[CATEGORIES_COLLECTION].find_one({"_id": category_id}, {"_id": 1})
        if exists is None:
            raise ValidationError(f"Unknown category_id: {category_id}")

    return normalized


def _check_reporter_permissions(update_doc: dict[str, Any], actor_role: str | None) -> None:
    """Reject reporter attempts to change the image cap.

    Args:
        update_doc: Pending update fields.
        actor_role: Role of the acting user, if known.

    Raises:
        ValidationError: If a reporter tries to change ``max_image_count``.
    """

    if actor_role == "reporter" and "max_image_count" in update_doc:
        raise ValidationError("Reporters cannot change max_image_count")


def _resolve_create_max_image_count(body: ArticleCreate, actor_role: str | None) -> int:
    """Resolve the image cap for a new article, enforcing the reporter limit.

    Args:
        body: Validated article payload.
        actor_role: Role of the acting user, if known.

    Returns:
        Effective max image count for the new article.

    Raises:
        ValidationError: If a reporter attempts to set ``max_image_count``.
    """

    if body.max_image_count is None:
        return DEFAULT_MAX_IMAGE_COUNT
    if actor_role == "reporter":
        raise ValidationError("Reporters cannot set max_image_count")
    return body.max_image_count
