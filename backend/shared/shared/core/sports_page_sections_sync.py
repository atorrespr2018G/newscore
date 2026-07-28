"""Shared helpers to sync sports page section lists into layouts/slots."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import ValidationError
from shared.core.geo_catalog import us_state_region_codes
from shared.core.logger import get_logger
from shared.core.regions import get_region_by_code
from shared.models.common import utc_now
from shared.read.collections import (
    CATEGORIES_COLLECTION,
    LAYOUTS_COLLECTION,
    MARKETS_COLLECTION,
    SLOTS_COLLECTION,
    SPORTS_PAGE_SECTIONS_COLLECTION,
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
# Distinct from homepage/world-page `world` so Sports World is its own article pool.
SPORTS_WORLD_CATEGORY_SLUG = "sports-page-world"
SPORTS_WORLD_CATEGORY_NAME = "World"
SPORTS_WORLD_CATEGORY_DESCRIPTION = "World news curated for the Sports page only."
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
    """Ensure a global category exists for a sport slug under parent Sports."""

    parent = await db[CATEGORIES_COLLECTION].find_one({"slug": PARENT_SPORTS_CATEGORY_SLUG})
    parent_id = str(parent["_id"]) if parent else None
    existing = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    if existing is not None:
        await db[CATEGORIES_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "name": label,
                    "description": f"{label} sports news.",
                    "parent_id": parent_id,
                },
            },
        )
        return str(existing["_id"])

    category_id = str(uuid4())
    await db[CATEGORIES_COLLECTION].insert_one(
        {
            "_id": category_id,
            "name": label,
            "slug": slug,
            "parent_id": parent_id,
            "description": f"{label} sports news.",
            "created_at": utc_now().isoformat(),
        },
    )
    logger.info("Created sport category %s", slug)
    return category_id


async def _ensure_sports_world_category(db: AsyncIOMotorDatabase) -> str:
    """Ensure the Sports-page-only World category exists (not homepage `world`)."""

    existing = await db[CATEGORIES_COLLECTION].find_one({"slug": SPORTS_WORLD_CATEGORY_SLUG})
    if existing is not None:
        await db[CATEGORIES_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "name": SPORTS_WORLD_CATEGORY_NAME,
                    "description": SPORTS_WORLD_CATEGORY_DESCRIPTION,
                },
            },
        )
        return str(existing["_id"])

    category_id = str(uuid4())
    await db[CATEGORIES_COLLECTION].insert_one(
        {
            "_id": category_id,
            "name": SPORTS_WORLD_CATEGORY_NAME,
            "slug": SPORTS_WORLD_CATEGORY_SLUG,
            "parent_id": None,
            "description": SPORTS_WORLD_CATEGORY_DESCRIPTION,
            "created_at": utc_now().isoformat(),
        },
    )
    logger.info("Created Sports page World category %s", SPORTS_WORLD_CATEGORY_SLUG)
    return category_id


async def _ensure_sports_layout(db: AsyncIOMotorDatabase, *, market_id: str) -> dict[str, Any]:
    """Ensure an active market-level sports layout exists (not a region clone)."""

    layout = await db[LAYOUTS_COLLECTION].find_one(
        {
            "page_name": SPORTS_PAGE_NAME,
            "market_id": market_id,
            "$or": [{"region_id": None}, {"region_id": {"$exists": False}}],
        },
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


async def _ensure_region_sports_layout(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    region_id: str,
) -> dict[str, Any]:
    """Ensure a region-owned sports layout exists, cloning from market when needed.

    Args:
        db: Mongo database.
        market_id: Market document id.
        region_id: Region document id that must own the sports board.

    Returns:
        Layout document for the region sports page.

    Raises:
        ValidationError: When no market sports layout exists to clone from.
    """

    from shared.core.layout_ensure import ensure_exact_page_layout

    # Market board must exist first so ensure_exact_page_layout can clone slots.
    await _ensure_sports_layout(db, market_id=market_id)
    layout_id = await ensure_exact_page_layout(
        db,
        region_id=region_id,
        page_name=SPORTS_PAGE_NAME,
    )
    if layout_id is None:
        raise ValidationError(f"Unable to ensure sports layout for region {region_id}")

    layout = await db[LAYOUTS_COLLECTION].find_one({"_id": layout_id})
    if layout is None:
        raise ValidationError(f"Sports layout missing after ensure: {layout_id}")
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
    """Create or update one sports layout slot without wiping existing pins."""

    query_rule: dict[str, Any] = {"limit": limit}
    if category_id:
        query_rule["category_id"] = category_id
    fields = {
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
            "pinned_ids": [],
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


async def _apply_sports_slots_to_layout(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    slot_specs: list[dict[str, Any]],
    now: str,
) -> list[str]:
    """Upsert sports slots onto one layout and delete obsolete rows.

    Args:
        db: Mongo database.
        layout_id: Layout document id to update.
        slot_specs: Ordered slot field dicts for `_upsert_layout_slot`.
        now: ISO timestamp for updated_at.

    Returns:
        Ordered slot ids kept on the layout.
    """

    slot_ids: list[str] = []
    for spec in slot_specs:
        slot_ids.append(
            await _upsert_layout_slot(
                db,
                layout_id=layout_id,
                now=now,
                **spec,
            ),
        )
    await _delete_obsolete_sports_slots(db, layout_id=layout_id, keep_slot_ids=set(slot_ids))
    await db[LAYOUTS_COLLECTION].update_one(
        {"_id": layout_id},
        {"$set": {"slot_ids": slot_ids, "is_active": True, "updated_at": now}},
    )
    return slot_ids


async def sync_sports_layout_slots(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    items: list[dict[str, str]],
    region_id: str | None = None,
) -> None:
    """Rebuild sports page slots from an ordered sport list.

    Keeps hero, Top Stories, Live, and World (Live then World); replaces dynamic sport rows.
    When ``region_id`` is set, updates only that region's sports layout. Otherwise updates
    the market-level sports layout only (does not mirror onto region boards).

    Args:
        db: Mongo database.
        market_id: Market document id.
        items: Ordered `{slug, label}` sport rows.
        region_id: Optional region document id for a state sports board.
    """

    sports_category_id = await _category_id_by_slug(db, PARENT_SPORTS_CATEGORY_SLUG)
    live_category_id = await _category_id_by_slug(db, LIVE_CATEGORY_SLUG)
    world_category_id = await _ensure_sports_world_category(db)
    if region_id:
        layout = await _ensure_region_sports_layout(
            db,
            market_id=market_id,
            region_id=region_id,
        )
    else:
        layout = await _ensure_sports_layout(db, market_id=market_id)
    layout_id = str(layout["_id"])
    now = utc_now().isoformat()
    slot_specs: list[dict[str, Any]] = [
        {
            "position_key": HERO_POSITION_KEY,
            "order_index": 0,
            "display_name": "Sports",
            "presentation_type": "hero",
            "category_id": sports_category_id,
            "limit": SPORTS_HERO_ARTICLE_LIMIT,
        },
        {
            "position_key": US_FEATURED_POSITION_KEY,
            "order_index": 1,
            "display_name": "Top Stories",
            "presentation_type": "grid_4",
            "category_id": sports_category_id,
            "limit": SPORTS_TOP_STORIES_ARTICLE_LIMIT,
        },
        {
            "position_key": LIVE_POSITION_KEY,
            "order_index": 2,
            "display_name": "Live",
            "presentation_type": "grid_4",
            "category_id": live_category_id,
            "limit": SPORTS_LIVE_ARTICLE_LIMIT,
        },
        {
            "position_key": WORLD_POSITION_KEY,
            "order_index": 3,
            "display_name": "World",
            "presentation_type": "grid_4",
            "category_id": world_category_id,
            "limit": SPORTS_WORLD_ARTICLE_LIMIT,
        },
    ]

    for index, item in enumerate(items):
        category_id = await _ensure_sport_category(db, slug=item["slug"], label=item["label"])
        slot_specs.append(
            {
                "position_key": item["slug"],
                "order_index": index + 4,
                "display_name": item["label"],
                "presentation_type": "grid_4",
                "category_id": category_id,
                "limit": SPORTS_SECTION_ARTICLE_LIMIT,
            },
        )

    await _apply_sports_slots_to_layout(
        db,
        layout_id=layout_id,
        slot_specs=slot_specs,
        now=now,
    )


async def ensure_us_state_sports_sections(
    db: AsyncIOMotorDatabase,
    *,
    labels: list[str],
) -> dict[str, Any]:
    """Upsert PR-shaped sports section lists and sync layouts for every US state.

    Creates missing state docs with ``labels``. Existing non-empty lists are kept;
    empty lists are filled from ``labels``. Layouts are always synced to the
    stored item list so boards stay aligned.

    Args:
        db: Mongo database.
        labels: Ordered sport display labels (typically PR sport labels).

    Returns:
        Summary with market id and per-state region codes that were ensured.
    """

    market = await db[MARKETS_COLLECTION].find_one({"code": "us"}, {"_id": 1})
    if market is None:
        raise ValidationError("US market not found; cannot seed state sports sections")

    market_id = str(market["_id"])
    default_items = [{"slug": slugify_sport_label(label), "label": label} for label in labels]
    now = utc_now().isoformat()
    ensured_codes: list[str] = []
    created_count = 0

    for region_code in us_state_region_codes():
        region = await get_region_by_code(db, region_code)
        if region is None:
            logger.warning("Skipping sports sections; region missing: %s", region_code)
            continue
        region_id = str(region["_id"])
        existing = await db[SPORTS_PAGE_SECTIONS_COLLECTION].find_one(
            {"market_id": market_id, "region_id": region_id},
        )
        if existing is None:
            await db[SPORTS_PAGE_SECTIONS_COLLECTION].insert_one(
                {
                    "_id": str(uuid4()),
                    "market_id": market_id,
                    "region_id": region_id,
                    "items": default_items,
                    "updated_at": now,
                },
            )
            items = default_items
            created_count += 1
        else:
            stored = list(existing.get("items") or [])
            if not stored:
                await db[SPORTS_PAGE_SECTIONS_COLLECTION].update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"items": default_items, "updated_at": now}},
                )
                items = default_items
            else:
                items = stored

        await sync_sports_layout_slots(
            db,
            market_id=market_id,
            items=items,
            region_id=region_id,
        )
        ensured_codes.append(region_code)

    logger.info(
        "Ensured US state sports sections for %d states (%d created, %d sports)",
        len(ensured_codes),
        created_count,
        len(default_items),
    )
    return {
        "market_id": market_id,
        "region_codes": ensured_codes,
        "created_count": created_count,
        "item_count": len(default_items),
    }
