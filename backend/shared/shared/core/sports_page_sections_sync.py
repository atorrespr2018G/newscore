"""Shared helpers to sync sports page section lists into layouts/slots."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import ValidationError
from shared.core.logger import get_logger
from shared.models.common import utc_now
from shared.read.collections import (
    CATEGORIES_COLLECTION,
    LAYOUTS_COLLECTION,
    SLOTS_COLLECTION,
)

logger = get_logger(__name__)

SPORTS_PAGE_NAME = "sports"
HERO_POSITION_KEY = "hero"
US_FEATURED_POSITION_KEY = "us-featured"
LIVE_POSITION_KEY = "health"
WORLD_POSITION_KEY = "world"
PRESERVED_SPORTS_PAGE_KEYS = frozenset(
    {HERO_POSITION_KEY, US_FEATURED_POSITION_KEY, LIVE_POSITION_KEY, WORLD_POSITION_KEY},
)
SPORTS_SECTION_ARTICLE_LIMIT = 12
SPORTS_HERO_ARTICLE_LIMIT = 12
SPORTS_TOP_STORIES_ARTICLE_LIMIT = 12
SPORTS_LIVE_ARTICLE_LIMIT = 20
SPORTS_WORLD_ARTICLE_LIMIT = 12
PARENT_SPORTS_CATEGORY_SLUG = "sports"
LIVE_CATEGORY_SLUG = "health"
WORLD_CATEGORY_SLUG = "world"
_SLUG_SAFE_RE = re.compile(r"[^a-z0-9]+")


def slugify_sport_label(label: str) -> str:
    """Derive a URL-safe sport slug from a display label.

    Args:
        label: Human-readable sport name.

    Returns:
        Lowercase hyphenated slug.

    Raises:
        ValidationError: When the label yields an empty slug.
    """

    normalized = _SLUG_SAFE_RE.sub("-", label.strip().lower()).strip("-")
    if not normalized:
        raise ValidationError("Sport label must contain letters or numbers")
    return normalized


async def _ensure_sport_category(db: AsyncIOMotorDatabase, *, slug: str, label: str) -> str:
    """Ensure a global category exists for a sport slug."""

    existing = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    if existing is not None:
        await db[CATEGORIES_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": {"name": label, "description": f"{label} sports news."}},
        )
        return str(existing["_id"])

    parent = await db[CATEGORIES_COLLECTION].find_one({"slug": PARENT_SPORTS_CATEGORY_SLUG})
    category_id = str(uuid4())
    await db[CATEGORIES_COLLECTION].insert_one(
        {
            "_id": category_id,
            "name": label,
            "slug": slug,
            "parent_id": str(parent["_id"]) if parent else None,
            "description": f"{label} sports news.",
            "created_at": utc_now().isoformat(),
        },
    )
    logger.info("Created sport category %s", slug)
    return category_id


async def _ensure_sports_layout(db: AsyncIOMotorDatabase, *, market_id: str) -> dict[str, Any]:
    """Ensure an active sports layout exists for a market."""

    layout = await db[LAYOUTS_COLLECTION].find_one(
        {"page_name": SPORTS_PAGE_NAME, "market_id": market_id},
    )
    now = utc_now().isoformat()
    if layout is not None:
        await db[LAYOUTS_COLLECTION].update_one(
            {"_id": layout["_id"]},
            {"$set": {"is_active": True, "updated_at": now}},
        )
        return layout

    layout_id = str(uuid4())
    layout = {
        "_id": layout_id,
        "page_name": SPORTS_PAGE_NAME,
        "market_id": market_id,
        "slot_ids": [],
        "is_active": True,
        "updated_at": now,
    }
    await db[LAYOUTS_COLLECTION].insert_one(layout)
    logger.info("Created sports layout for market %s", market_id)
    return layout


async def _upsert_layout_slot(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    position_key: str,
    order_index: int,
    display_name: str,
    presentation_type: str,
    category_id: str | None,
    limit: int,
    now: str,
) -> str:
    """Create or update one sports layout slot."""

    query_rule: dict[str, Any] = {"limit": limit}
    if category_id:
        query_rule["category_id"] = category_id
    fields = {
        "pinned_ids": [],
        "query_rule": query_rule,
        "order_index": order_index,
        "display_name": display_name,
        "presentation_type": presentation_type,
        "updated_at": now,
    }
    existing = await db[SLOTS_COLLECTION].find_one(
        {"layout_id": layout_id, "position_key": position_key},
    )
    if existing is not None:
        await db[SLOTS_COLLECTION].update_one({"_id": existing["_id"]}, {"$set": fields})
        return str(existing["_id"])

    slot_id = str(uuid4())
    await db[SLOTS_COLLECTION].insert_one(
        {
            "_id": slot_id,
            "layout_id": layout_id,
            "position_key": position_key,
            "content_type": "articles",
            **fields,
        },
    )
    return slot_id


async def _delete_obsolete_sports_slots(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    keep_slot_ids: set[str],
) -> None:
    """Remove sports-page slots that are no longer in the active list."""

    cursor = db[SLOTS_COLLECTION].find({"layout_id": layout_id})
    async for slot in cursor:
        if str(slot["_id"]) in keep_slot_ids:
            continue
        await db[SLOTS_COLLECTION].delete_one({"_id": slot["_id"]})


async def _category_id_by_slug(db: AsyncIOMotorDatabase, slug: str) -> str | None:
    """Return category id for a slug, if present."""

    category = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    return str(category["_id"]) if category else None


async def sync_sports_layout_slots(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    items: list[dict[str, str]],
) -> None:
    """Rebuild sports page slots from an ordered sport list.

    Keeps hero, Top Stories, Live, and World; replaces dynamic sport rows.

    Args:
        db: Mongo database.
        market_id: Market document id.
        items: Ordered `{slug, label}` sport rows.
    """

    sports_category_id = await _category_id_by_slug(db, PARENT_SPORTS_CATEGORY_SLUG)
    live_category_id = await _category_id_by_slug(db, LIVE_CATEGORY_SLUG)
    world_category_id = await _category_id_by_slug(db, WORLD_CATEGORY_SLUG)
    layout = await _ensure_sports_layout(db, market_id=market_id)
    layout_id = str(layout["_id"])
    now = utc_now().isoformat()
    slot_ids: list[str] = [
        await _upsert_layout_slot(
            db,
            layout_id=layout_id,
            position_key=HERO_POSITION_KEY,
            order_index=0,
            display_name="Sports",
            presentation_type="hero",
            category_id=sports_category_id,
            limit=SPORTS_HERO_ARTICLE_LIMIT,
            now=now,
        ),
        await _upsert_layout_slot(
            db,
            layout_id=layout_id,
            position_key=US_FEATURED_POSITION_KEY,
            order_index=1,
            display_name="Top Stories",
            presentation_type="grid_4",
            category_id=sports_category_id,
            limit=SPORTS_TOP_STORIES_ARTICLE_LIMIT,
            now=now,
        ),
        await _upsert_layout_slot(
            db,
            layout_id=layout_id,
            position_key=LIVE_POSITION_KEY,
            order_index=2,
            display_name="Live",
            presentation_type="grid_4",
            category_id=live_category_id,
            limit=SPORTS_LIVE_ARTICLE_LIMIT,
            now=now,
        ),
    ]

    for index, item in enumerate(items):
        category_id = await _ensure_sport_category(db, slug=item["slug"], label=item["label"])
        slot_ids.append(
            await _upsert_layout_slot(
                db,
                layout_id=layout_id,
                position_key=item["slug"],
                order_index=index + 3,
                display_name=item["label"],
                presentation_type="grid_4",
                category_id=category_id,
                limit=SPORTS_SECTION_ARTICLE_LIMIT,
                now=now,
            ),
        )

    slot_ids.append(
        await _upsert_layout_slot(
            db,
            layout_id=layout_id,
            position_key=WORLD_POSITION_KEY,
            order_index=len(items) + 3,
            display_name="World",
            presentation_type="grid_4",
            category_id=world_category_id,
            limit=SPORTS_WORLD_ARTICLE_LIMIT,
            now=now,
        ),
    )

    await _delete_obsolete_sports_slots(db, layout_id=layout_id, keep_slot_ids=set(slot_ids))
    await db[LAYOUTS_COLLECTION].update_one(
        {"_id": layout_id},
        {"$set": {"slot_ids": slot_ids, "is_active": True, "updated_at": now}},
    )
