"""Shared helpers to sync sports page section lists into layouts/slots."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import ValidationError
from shared.core.geo_catalog import (
    florida_county_region_codes,
    puerto_rico_town_region_codes,
    us_state_region_codes,
)
from shared.core.logger import get_logger
from shared.core.markets import (
    PRESENTATION_FEATURED_BAND,
    PRESENTATION_GRID_4,
    PRESENTATION_HERO,
    PRESENTATION_LIVE_CAROUSEL,
    PRESENTATION_RIBBON_AD,
)
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

SECTION_TYPE_HERO = "hero"
SECTION_TYPE_TOP_STORIES = "top_stories"
SECTION_TYPE_LIVE = "live"
SECTION_TYPE_WORLD = "world"
SECTION_TYPE_SPORT = "sport"
SECTION_TYPE_RIBBON_AD = "ribbon_ad"

RIBBON_AD_POSITION_KEY = "ad-ribbon"
RIBBON_AD_ARTICLE_LIMIT = 0

SPORTS_PAGE_SECTION_TYPES = frozenset(
    {
        SECTION_TYPE_HERO,
        SECTION_TYPE_TOP_STORIES,
        SECTION_TYPE_LIVE,
        SECTION_TYPE_WORLD,
        SECTION_TYPE_SPORT,
        SECTION_TYPE_RIBBON_AD,
    },
)
CANONICAL_SLUG_BY_TYPE = {
    SECTION_TYPE_HERO: HERO_POSITION_KEY,
    SECTION_TYPE_TOP_STORIES: US_FEATURED_POSITION_KEY,
    SECTION_TYPE_LIVE: LIVE_POSITION_KEY,
    SECTION_TYPE_WORLD: WORLD_POSITION_KEY,
}
# First occurrence prefers these slugs; later rows get numbered suffixes.
PREFERRED_SLUG_PREFIX_BY_TYPE = {
    SECTION_TYPE_RIBBON_AD: RIBBON_AD_POSITION_KEY,
}
DEFAULT_LABEL_BY_TYPE = {
    SECTION_TYPE_HERO: "Sports",
    SECTION_TYPE_TOP_STORIES: "Top Stories",
    SECTION_TYPE_LIVE: "Live",
    SECTION_TYPE_WORLD: "World",
    SECTION_TYPE_RIBBON_AD: "Ribbon Advertisement",
}
SPORTS_SECTION_PAIR_SIZE = 2


def _ribbon_ad_item(slug: str) -> dict[str, str]:
    """Build one configurable ribbon advertisement section row."""

    return {
        "section_type": SECTION_TYPE_RIBBON_AD,
        "slug": slug,
        "label": DEFAULT_LABEL_BY_TYPE[SECTION_TYPE_RIBBON_AD],
    }


def _next_ribbon_slug(used_slugs: set[str]) -> str:
    """Allocate the next unused ``ad-ribbon`` / ``ad-ribbon-N`` slug."""

    if RIBBON_AD_POSITION_KEY not in used_slugs:
        return RIBBON_AD_POSITION_KEY
    suffix = 2
    while f"{RIBBON_AD_POSITION_KEY}-{suffix}" in used_slugs:
        suffix += 1
    return f"{RIBBON_AD_POSITION_KEY}-{suffix}"


def has_ribbon_ad_section(items: list[dict[str, str]]) -> bool:
    """Return whether the section list already includes ribbon advertisement rows."""

    return any(item.get("section_type") == SECTION_TYPE_RIBBON_AD for item in items)


def insert_legacy_sports_ribbon_ads(items: list[dict[str, str]]) -> list[dict[str, str]]:
    """Insert ribbon rows matching the former sports-page heuristic placements.

    Args:
        items: Typed section rows without configurable ribbons.

    Returns:
        Copy of ``items`` with ribbon advertisement rows inserted in legacy spots.
    """

    if has_ribbon_ad_section(items):
        return [dict(row) for row in items]

    result: list[dict[str, str]] = []
    used_slugs = {str(item.get("slug") or "") for item in items}
    previous_type: str | None = None
    compact_index = 0

    for item in items:
        section_type = item["section_type"]
        needs_before = False
        if section_type == SECTION_TYPE_LIVE:
            needs_before = True
        elif (
            section_type == SECTION_TYPE_WORLD
            and previous_type is not None
            and previous_type != SECTION_TYPE_HERO
        ):
            needs_before = True
        elif (
            section_type == SECTION_TYPE_SPORT
            and compact_index > 0
            and compact_index % SPORTS_SECTION_PAIR_SIZE == 0
        ):
            needs_before = True
        elif (
            section_type == SECTION_TYPE_TOP_STORIES
            and previous_type is not None
            and previous_type != SECTION_TYPE_HERO
            and previous_type != SECTION_TYPE_RIBBON_AD
        ):
            needs_before = True

        if needs_before:
            ribbon_slug = _next_ribbon_slug(used_slugs)
            used_slugs.add(ribbon_slug)
            result.append(_ribbon_ad_item(ribbon_slug))

        result.append(dict(item))
        if section_type == SECTION_TYPE_HERO:
            ribbon_slug = _next_ribbon_slug(used_slugs)
            used_slugs.add(ribbon_slug)
            result.append(_ribbon_ad_item(ribbon_slug))
        if section_type == SECTION_TYPE_SPORT:
            compact_index += 1
        previous_type = section_type
    return result


DEFAULT_FIXED_SECTION_ITEMS_WITHOUT_RIBBONS: list[dict[str, str]] = [
    {
        "section_type": SECTION_TYPE_HERO,
        "slug": HERO_POSITION_KEY,
        "label": DEFAULT_LABEL_BY_TYPE[SECTION_TYPE_HERO],
    },
    {
        "section_type": SECTION_TYPE_TOP_STORIES,
        "slug": US_FEATURED_POSITION_KEY,
        "label": DEFAULT_LABEL_BY_TYPE[SECTION_TYPE_TOP_STORIES],
    },
    {
        "section_type": SECTION_TYPE_LIVE,
        "slug": LIVE_POSITION_KEY,
        "label": DEFAULT_LABEL_BY_TYPE[SECTION_TYPE_LIVE],
    },
    {
        "section_type": SECTION_TYPE_WORLD,
        "slug": WORLD_POSITION_KEY,
        "label": DEFAULT_LABEL_BY_TYPE[SECTION_TYPE_WORLD],
    },
]
DEFAULT_FIXED_SECTION_ITEMS: list[dict[str, str]] = insert_legacy_sports_ribbon_ads(
    [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS_WITHOUT_RIBBONS],
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


def expand_legacy_section_items(items: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Normalize stored items and prepend fixed sections for legacy sport-only lists.

    Args:
        items: Raw sports_page_sections items (may omit ``section_type``).

    Returns:
        Ordered ``{section_type, slug, label}`` rows ready for sync or API output.
    """

    if not items:
        return [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS]

    has_typed = any(str(item.get("section_type") or "").strip() for item in items)
    if has_typed:
        resolved: list[dict[str, str]] = []
        for item in items:
            section_type = str(item.get("section_type") or SECTION_TYPE_SPORT).strip().lower()
            if section_type not in SPORTS_PAGE_SECTION_TYPES:
                section_type = SECTION_TYPE_SPORT
            resolved.append(
                {
                    "section_type": section_type,
                    "slug": str(item["slug"]).strip().lower(),
                    "label": str(item["label"]).strip(),
                },
            )
        return resolved

    sports = [
        {
            "section_type": SECTION_TYPE_SPORT,
            "slug": str(item["slug"]).strip().lower(),
            "label": str(item["label"]).strip(),
        }
        for item in items
        if str(item.get("slug") or "").strip() and str(item.get("label") or "").strip()
    ]
    return insert_legacy_sports_ribbon_ads(
        [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS_WITHOUT_RIBBONS] + sports,
    )


def sport_rows_from_labels(labels: list[str]) -> list[dict[str, str]]:
    """Build typed sport rows from display labels.

    Args:
        labels: Ordered sport display names.

    Returns:
        Sport-typed section items with derived slugs.
    """

    return [
        {
            "section_type": SECTION_TYPE_SPORT,
            "slug": slugify_sport_label(label),
            "label": label,
        }
        for label in labels
    ]


def default_sports_page_section_items(labels: list[str]) -> list[dict[str, str]]:
    """Full default sports page list: fixed bands plus sport rows.

    Args:
        labels: Ordered sport display names.

    Returns:
        Fixed sections followed by sport rows, with legacy ad ribbons inserted.
    """

    return insert_legacy_sports_ribbon_ads(
        [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS_WITHOUT_RIBBONS]
        + sport_rows_from_labels(labels),
    )


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


def _sports_slot_query_rule(
    *,
    position_key: str,
    limit: int,
    existing: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build query_rule for a sports layout slot.

    Sport grids are always pin-only so configuration-added sports start empty.
    Fixed bands may keep prior category fill when the slot already existed.
    """

    from shared.core.slot_query_rule import query_rule_for_config_slot

    if position_key not in PRESERVED_SPORTS_PAGE_KEYS:
        return {"limit": limit}
    return query_rule_for_config_slot(limit=limit, existing=existing)


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

    _ = category_id
    existing = await db[SLOTS_COLLECTION].find_one(
        {"layout_id": layout_id, "position_key": position_key},
    )
    fields = {
        "query_rule": _sports_slot_query_rule(
            position_key=position_key,
            limit=limit,
            existing=existing,
        ),
        "order_index": order_index,
        "display_name": display_name,
        "presentation_type": presentation_type,
        "updated_at": now,
    }
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


async def _slot_spec_for_section(
    db: AsyncIOMotorDatabase,
    *,
    item: dict[str, str],
    order_index: int,
    sports_category_id: str | None,
    live_category_id: str | None,
    world_category_id: str,
) -> dict[str, Any]:
    """Build one layout slot spec from a typed sports page section item."""

    section_type = item["section_type"]
    slug = item["slug"]
    label = item["label"]

    if section_type == SECTION_TYPE_HERO:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_HERO,
            "category_id": sports_category_id,
            "limit": SPORTS_HERO_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_TOP_STORIES:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_FEATURED_BAND,
            "category_id": sports_category_id,
            "limit": SPORTS_TOP_STORIES_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_LIVE:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_LIVE_CAROUSEL,
            "category_id": live_category_id,
            "limit": SPORTS_LIVE_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_WORLD:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_FEATURED_BAND,
            "category_id": world_category_id,
            "limit": SPORTS_WORLD_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_RIBBON_AD:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_RIBBON_AD,
            "category_id": None,
            "limit": RIBBON_AD_ARTICLE_LIMIT,
        }

    category_id = await _ensure_sport_category(db, slug=slug, label=label)
    return {
        "position_key": slug,
        "order_index": order_index,
        "display_name": label,
        "presentation_type": PRESENTATION_GRID_4,
        "category_id": category_id,
        "limit": SPORTS_SECTION_ARTICLE_LIMIT,
    }


async def sync_sports_layout_slots(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    items: list[dict[str, Any]],
    region_id: str | None = None,
) -> None:
    """Rebuild sports page slots from an ordered typed section list.

    Expands legacy sport-only lists, then upserts slots in list order and deletes
    obsolete slots. Existing pins are preserved per ``position_key``.

    When ``region_id`` is set, updates only that region's sports layout. Otherwise
    updates the market-level sports layout only (does not mirror onto region boards).

    Args:
        db: Mongo database.
        market_id: Market document id.
        items: Ordered section rows (``section_type`` optional for legacy docs).
        region_id: Optional region document id for a state, county, or town sports board.
    """

    resolved_items = expand_legacy_section_items(items)
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
    slot_specs: list[dict[str, Any]] = []
    for index, item in enumerate(resolved_items):
        slot_specs.append(
            await _slot_spec_for_section(
                db,
                item=item,
                order_index=index,
                sports_category_id=sports_category_id,
                live_category_id=live_category_id,
                world_category_id=world_category_id,
            ),
        )

    await _apply_sports_slots_to_layout(
        db,
        layout_id=layout_id,
        slot_specs=slot_specs,
        now=now,
    )


async def _resolve_region_sports_items(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    region_id: str,
    default_items: list[dict[str, str]],
    now: str,
) -> tuple[list[dict[str, Any]], bool, bool]:
    """Load or create sports section items for one region.

    Args:
        db: Mongo database.
        market_id: Market document id.
        region_id: Region document id.
        default_items: Default typed section list when creating or filling empty.
        now: ISO timestamp for updated_at.

    Returns:
        Tuple of ``(items, created, should_sync)``. ``should_sync`` is true when
        the section list was created or filled from empty; non-empty editorial
        lists skip layout sync so existing category fill is left intact.
    """

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
        return default_items, True, True

    stored = list(existing.get("items") or [])
    if not stored:
        await db[SPORTS_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": {"items": default_items, "updated_at": now}},
        )
        return default_items, False, True
    return stored, False, False


async def ensure_region_sports_sections(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str,
    region_codes: tuple[str, ...] | list[str],
    labels: list[str],
) -> dict[str, Any]:
    """Upsert sports section lists and sync layouts for the given region codes.

    Creates missing docs with fixed bands plus ``labels``. Existing non-empty
    lists are kept; empty lists are filled from the default full list. Layout
    sync runs only when the list was created or filled so editorial boards that
    already auto-fill are not rewritten to pin-only sport slots.

    Args:
        db: Mongo database.
        market_code: Market short code that owns the regions (e.g. ``us``, ``pr``).
        region_codes: Ordered region codes to ensure.
        labels: Ordered sport display labels (typically PR sport labels).

    Returns:
        Summary with market id and per-region codes that were ensured.

    Raises:
        ValidationError: When the market document is missing.
    """

    market = await db[MARKETS_COLLECTION].find_one({"code": market_code}, {"_id": 1})
    if market is None:
        raise ValidationError(
            f"{market_code.upper()} market not found; cannot seed sports sections",
        )

    market_id = str(market["_id"])
    default_items = default_sports_page_section_items(labels)
    now = utc_now().isoformat()
    ensured_codes: list[str] = []
    created_count = 0

    for region_code in region_codes:
        region = await get_region_by_code(db, region_code)
        if region is None:
            logger.warning("Skipping sports sections; region missing: %s", region_code)
            continue
        region_id = str(region["_id"])
        items, created, should_sync = await _resolve_region_sports_items(
            db,
            market_id=market_id,
            region_id=region_id,
            default_items=default_items,
            now=now,
        )
        if created:
            created_count += 1
        if should_sync:
            await sync_sports_layout_slots(
                db,
                market_id=market_id,
                items=items,
                region_id=region_id,
            )
        ensured_codes.append(region_code)

    logger.info(
        "Ensured %s sports sections for %d regions (%d created, %d sports)",
        market_code,
        len(ensured_codes),
        created_count,
        len(labels),
    )
    return {
        "market_id": market_id,
        "region_codes": ensured_codes,
        "created_count": created_count,
        "item_count": len(default_items),
    }


async def ensure_us_state_sports_sections(
    db: AsyncIOMotorDatabase,
    *,
    labels: list[str],
) -> dict[str, Any]:
    """Upsert PR-shaped sports section lists and sync layouts for every US state.

    Args:
        db: Mongo database.
        labels: Ordered sport display labels (typically PR sport labels).

    Returns:
        Summary with market id and per-state region codes that were ensured.
    """

    return await ensure_region_sports_sections(
        db,
        market_code="us",
        region_codes=us_state_region_codes(),
        labels=labels,
    )


async def ensure_florida_county_sports_sections(
    db: AsyncIOMotorDatabase,
    *,
    labels: list[str],
) -> dict[str, Any]:
    """Upsert sports section lists and sync layouts for every Florida county.

    Args:
        db: Mongo database.
        labels: Ordered sport display labels (typically PR sport labels).

    Returns:
        Summary with market id and per-county region codes that were ensured.
    """

    return await ensure_region_sports_sections(
        db,
        market_code="us",
        region_codes=florida_county_region_codes(),
        labels=labels,
    )


async def ensure_pr_town_sports_sections(
    db: AsyncIOMotorDatabase,
    *,
    labels: list[str],
) -> dict[str, Any]:
    """Upsert sports section lists and sync layouts for every Puerto Rico town.

    Args:
        db: Mongo database.
        labels: Ordered sport display labels (typically PR sport labels).

    Returns:
        Summary with market id and per-town region codes that were ensured.
    """

    return await ensure_region_sports_sections(
        db,
        market_code="pr",
        region_codes=puerto_rico_town_region_codes(),
        labels=labels,
    )


async def ensure_geo_sports_sections(
    db: AsyncIOMotorDatabase,
    *,
    labels: list[str],
) -> dict[str, Any]:
    """Ensure independent sports lists for US states, FL counties, and PR towns.

    Args:
        db: Mongo database.
        labels: Ordered sport display labels (typically PR sport labels).

    Returns:
        Combined summary keyed by geo group.
    """

    states = await ensure_us_state_sports_sections(db, labels=labels)
    counties = await ensure_florida_county_sports_sections(db, labels=labels)
    towns = await ensure_pr_town_sports_sections(db, labels=labels)
    return {
        "us_states": states,
        "florida_counties": counties,
        "pr_towns": towns,
    }
