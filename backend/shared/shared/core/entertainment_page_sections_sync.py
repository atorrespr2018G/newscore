"""Shared helpers to sync entertainment page section lists into layouts/slots."""

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
    ENTERTAINMENT_PAGE_SECTIONS_COLLECTION,
)

logger = get_logger(__name__)

ENTERTAINMENT_PAGE_NAME = "entertainment"
HERO_POSITION_KEY = "hero"
US_FEATURED_POSITION_KEY = "us-featured"
LIVE_POSITION_KEY = "health"
PARENT_ENTERTAINMENT_CATEGORY_SLUG = "entertainment"
PRESERVED_ENTERTAINMENT_PAGE_KEYS = frozenset(
    {
        HERO_POSITION_KEY,
        US_FEATURED_POSITION_KEY,
        LIVE_POSITION_KEY,
        PARENT_ENTERTAINMENT_CATEGORY_SLUG,
    },
)

SECTION_TYPE_HERO = "hero"
SECTION_TYPE_TOP_STORIES = "top_stories"
SECTION_TYPE_LIVE = "live"
SECTION_TYPE_ENTERTAINMENT = "entertainment"
SECTION_TYPE_RIBBON_AD = "ribbon_ad"

RIBBON_AD_POSITION_KEY = "ad-ribbon"
RIBBON_AD_ARTICLE_LIMIT = 0

ENTERTAINMENT_PAGE_SECTION_TYPES = frozenset(
    {
        SECTION_TYPE_HERO,
        SECTION_TYPE_TOP_STORIES,
        SECTION_TYPE_LIVE,
        SECTION_TYPE_ENTERTAINMENT,
        SECTION_TYPE_RIBBON_AD,
    },
)
CANONICAL_SLUG_BY_TYPE = {
    SECTION_TYPE_HERO: HERO_POSITION_KEY,
    SECTION_TYPE_TOP_STORIES: US_FEATURED_POSITION_KEY,
    SECTION_TYPE_LIVE: LIVE_POSITION_KEY,
}
# First occurrence prefers these slugs; later rows get numbered suffixes.
PREFERRED_SLUG_PREFIX_BY_TYPE = {
    SECTION_TYPE_RIBBON_AD: RIBBON_AD_POSITION_KEY,
    SECTION_TYPE_ENTERTAINMENT: "topic",
}
DEFAULT_LABEL_BY_TYPE = {
    SECTION_TYPE_HERO: "Entertainment",
    SECTION_TYPE_TOP_STORIES: "Top Stories",
    SECTION_TYPE_LIVE: "Live",
    SECTION_TYPE_RIBBON_AD: "Ribbon Advertisement",
}
ENTERTAINMENT_SECTION_PAIR_SIZE = 2


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


def insert_legacy_entertainment_ribbon_ads(items: list[dict[str, str]]) -> list[dict[str, str]]:
    """Insert ribbon rows matching the former entertainment-page heuristic placements.

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
            section_type == SECTION_TYPE_ENTERTAINMENT
            and compact_index > 0
            and compact_index % ENTERTAINMENT_SECTION_PAIR_SIZE == 0
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
        if section_type == SECTION_TYPE_ENTERTAINMENT:
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
]
DEFAULT_FIXED_SECTION_ITEMS: list[dict[str, str]] = insert_legacy_entertainment_ribbon_ads(
    [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS_WITHOUT_RIBBONS],
)
# Configuration topic rows (Sports compact bands, no World).
DEFAULT_ENTERTAINMENT_TOPIC_LABELS: tuple[str, ...] = (
    "Arts & Culture",
    "Music",
    "Movies",
    "TV & Streaming",
    "Celebrities",
    "Fashion",
    "Design",
    "Architecture",
    "Luxury",
    "Gaming",
    "Lifestyle",
    "Horoscope",
)

ENTERTAINMENT_SECTION_ARTICLE_LIMIT = 12
ENTERTAINMENT_HERO_ARTICLE_LIMIT = 12
ENTERTAINMENT_TOP_STORIES_ARTICLE_LIMIT = 12
ENTERTAINMENT_LIVE_ARTICLE_LIMIT = 20
LIVE_CATEGORY_SLUG = "health"
_SLUG_SAFE_RE = re.compile(r"[^a-z0-9]+")


def slugify_entertainment_label(label: str) -> str:
    """Derive a URL-safe entertainment slug from a display label.

    Args:
        label: Human-readable entertainment name.

    Returns:
        Lowercase hyphenated slug.

    Raises:
        ValidationError: When the label yields an empty slug.
    """

    normalized = _SLUG_SAFE_RE.sub("-", label.strip().lower()).strip("-")
    if not normalized:
        raise ValidationError("Entertainment label must contain letters or numbers")
    return normalized


def expand_legacy_section_items(items: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Normalize stored items and prepend fixed sections for legacy entertainment-only lists.

    Args:
        items: Raw entertainment_page_sections items (may omit ``section_type``).

    Returns:
        Ordered ``{section_type, slug, label}`` rows ready for sync or API output.
    """

    if not items:
        return [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS]

    has_typed = any(str(item.get("section_type") or "").strip() for item in items)
    if has_typed:
        resolved: list[dict[str, str]] = []
        for item in items:
            section_type = str(item.get("section_type") or SECTION_TYPE_ENTERTAINMENT).strip().lower()
            if section_type not in ENTERTAINMENT_PAGE_SECTION_TYPES:
                section_type = SECTION_TYPE_ENTERTAINMENT
            resolved.append(
                {
                    "section_type": section_type,
                    "slug": str(item["slug"]).strip().lower(),
                    "label": str(item["label"]).strip(),
                },
            )
        return resolved

    entertainment = [
        {
            "section_type": SECTION_TYPE_ENTERTAINMENT,
            "slug": str(item["slug"]).strip().lower(),
            "label": str(item["label"]).strip(),
        }
        for item in items
        if str(item.get("slug") or "").strip() and str(item.get("label") or "").strip()
    ]
    return insert_legacy_entertainment_ribbon_ads(
        [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS_WITHOUT_RIBBONS] + entertainment,
    )


def entertainment_rows_from_labels(labels: list[str]) -> list[dict[str, str]]:
    """Build typed entertainment rows from display labels.

    Args:
        labels: Ordered entertainment display names.

    Returns:
        Entertainment-typed section items with derived slugs.
    """

    return [
        {
            "section_type": SECTION_TYPE_ENTERTAINMENT,
            "slug": slugify_entertainment_label(label),
            "label": label,
        }
        for label in labels
    ]


def default_entertainment_page_section_items(labels: list[str]) -> list[dict[str, str]]:
    """Full default entertainment page list: fixed bands plus entertainment rows.

    Args:
        labels: Ordered entertainment display names.

    Returns:
        Fixed sections followed by entertainment rows, with legacy ad ribbons inserted.
    """

    return insert_legacy_entertainment_ribbon_ads(
        [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS_WITHOUT_RIBBONS]
        + entertainment_rows_from_labels(labels),
    )


async def _ensure_entertainment_category(db: AsyncIOMotorDatabase, *, slug: str, label: str) -> str:
    """Ensure a global category exists for an entertainment slug under parent Entertainment."""

    parent = await db[CATEGORIES_COLLECTION].find_one({"slug": PARENT_ENTERTAINMENT_CATEGORY_SLUG})
    parent_id = str(parent["_id"]) if parent else None
    if slug == PARENT_ENTERTAINMENT_CATEGORY_SLUG and parent is not None:
        return str(parent["_id"])
    existing = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    if existing is not None:
        await db[CATEGORIES_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "name": label,
                    "description": f"{label} entertainment news.",
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
            "description": f"{label} entertainment news.",
            "created_at": utc_now().isoformat(),
        },
    )
    logger.info("Created entertainment category %s", slug)
    return category_id


async def _ensure_entertainment_layout(db: AsyncIOMotorDatabase, *, market_id: str) -> dict[str, Any]:
    """Ensure an active market-level entertainment layout exists (not a region clone)."""

    layout = await db[LAYOUTS_COLLECTION].find_one(
        {
            "page_name": ENTERTAINMENT_PAGE_NAME,
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
        "page_name": ENTERTAINMENT_PAGE_NAME,
        "market_id": market_id,
        "slot_ids": [],
        "is_active": True,
        "updated_at": now,
    }
    await db[LAYOUTS_COLLECTION].insert_one(layout)
    logger.info("Created entertainment layout for market %s", market_id)
    return layout


async def _ensure_region_entertainment_layout(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    region_id: str,
) -> dict[str, Any]:
    """Ensure a region-owned entertainment layout exists, cloning from market when needed.

    Args:
        db: Mongo database.
        market_id: Market document id.
        region_id: Region document id that must own the entertainment board.

    Returns:
        Layout document for the region entertainment page.

    Raises:
        ValidationError: When no market entertainment layout exists to clone from.
    """

    from shared.core.layout_ensure import ensure_exact_page_layout

    # Market board must exist first so ensure_exact_page_layout can clone slots.
    await _ensure_entertainment_layout(db, market_id=market_id)
    layout_id = await ensure_exact_page_layout(
        db,
        region_id=region_id,
        page_name=ENTERTAINMENT_PAGE_NAME,
    )
    if layout_id is None:
        raise ValidationError(f"Unable to ensure entertainment layout for region {region_id}")

    layout = await db[LAYOUTS_COLLECTION].find_one({"_id": layout_id})
    if layout is None:
        raise ValidationError(f"Entertainment layout missing after ensure: {layout_id}")
    return layout


def _entertainment_slot_query_rule(
    *,
    limit: int,
    existing: dict[str, Any] | None,
    category_id: str | None,
) -> dict[str, Any]:
    """Build query_rule so entertainment slots auto-fill from their category.

    New boards start with ``category_id`` so seeded topic stories appear without
    pinning. Existing slots keep a prior ``category_id`` when already set.

    Args:
        limit: Maximum articles for the slot.
        existing: Existing slot document, or None when inserting.
        category_id: Category to auto-fill when the slot has none yet.

    Returns:
        Query rule payload to persist on the slot.
    """

    from shared.core.slot_query_rule import query_rule_for_config_slot

    query_rule = query_rule_for_config_slot(limit=limit, existing=existing)
    if category_id and not query_rule.get("category_id"):
        query_rule["category_id"] = str(category_id)
    return query_rule


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
    """Create or update one entertainment layout slot without wiping existing pins."""

    existing = await db[SLOTS_COLLECTION].find_one(
        {"layout_id": layout_id, "position_key": position_key},
    )
    fields = {
        "query_rule": _entertainment_slot_query_rule(
            limit=limit,
            existing=existing,
            category_id=category_id,
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


async def _delete_obsolete_entertainment_slots(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    keep_slot_ids: set[str],
) -> None:
    """Remove entertainment-page slots that are no longer in the active list."""

    cursor = db[SLOTS_COLLECTION].find({"layout_id": layout_id})
    async for slot in cursor:
        if str(slot["_id"]) in keep_slot_ids:
            continue
        await db[SLOTS_COLLECTION].delete_one({"_id": slot["_id"]})


async def _category_id_by_slug(db: AsyncIOMotorDatabase, slug: str) -> str | None:
    """Return category id for a slug, if present."""

    category = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    return str(category["_id"]) if category else None


async def _apply_entertainment_slots_to_layout(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    slot_specs: list[dict[str, Any]],
    now: str,
) -> list[str]:
    """Upsert entertainment slots onto one layout and delete obsolete rows.

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
    await _delete_obsolete_entertainment_slots(db, layout_id=layout_id, keep_slot_ids=set(slot_ids))
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
    entertainment_category_id: str | None,
    live_category_id: str | None,
) -> dict[str, Any]:
    """Build one layout slot spec from a typed entertainment page section item."""

    section_type = item["section_type"]
    slug = item["slug"]
    label = item["label"]

    if section_type == SECTION_TYPE_HERO:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_HERO,
            "category_id": entertainment_category_id,
            "limit": ENTERTAINMENT_HERO_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_TOP_STORIES:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_FEATURED_BAND,
            "category_id": entertainment_category_id,
            "limit": ENTERTAINMENT_TOP_STORIES_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_LIVE:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_LIVE_CAROUSEL,
            "category_id": live_category_id,
            "limit": ENTERTAINMENT_LIVE_ARTICLE_LIMIT,
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

    category_id = await _ensure_entertainment_category(db, slug=slug, label=label)
    return {
        "position_key": slug,
        "order_index": order_index,
        "display_name": label,
        "presentation_type": PRESENTATION_GRID_4,
        "category_id": category_id,
        "limit": ENTERTAINMENT_SECTION_ARTICLE_LIMIT,
    }


async def sync_entertainment_layout_slots(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    items: list[dict[str, Any]],
    region_id: str | None = None,
) -> None:
    """Rebuild entertainment page slots from an ordered typed section list.

    Expands legacy entertainment-only lists, then upserts slots in list order and deletes
    obsolete slots. Existing pins are preserved per ``position_key``.

    When ``region_id`` is set, updates only that region's entertainment layout. Otherwise
    updates the market-level entertainment layout only (does not mirror onto region boards).

    Args:
        db: Mongo database.
        market_id: Market document id.
        items: Ordered section rows (``section_type`` optional for legacy docs).
        region_id: Optional region document id for a state, county, or town entertainment board.
    """

    resolved_items = expand_legacy_section_items(items)
    entertainment_category_id = await _category_id_by_slug(db, PARENT_ENTERTAINMENT_CATEGORY_SLUG)
    live_category_id = await _category_id_by_slug(db, LIVE_CATEGORY_SLUG)
    if region_id:
        layout = await _ensure_region_entertainment_layout(
            db,
            market_id=market_id,
            region_id=region_id,
        )
    else:
        layout = await _ensure_entertainment_layout(db, market_id=market_id)
    layout_id = str(layout["_id"])
    now = utc_now().isoformat()
    slot_specs: list[dict[str, Any]] = []
    for index, item in enumerate(resolved_items):
        slot_specs.append(
            await _slot_spec_for_section(
                db,
                item=item,
                order_index=index,
                entertainment_category_id=entertainment_category_id,
                live_category_id=live_category_id,
            ),
        )

    await _apply_entertainment_slots_to_layout(
        db,
        layout_id=layout_id,
        slot_specs=slot_specs,
        now=now,
    )


async def _resolve_region_entertainment_items(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    region_id: str,
    default_items: list[dict[str, str]],
    now: str,
) -> tuple[list[dict[str, Any]], bool, bool]:
    """Load or create entertainment section items for one region.

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

    existing = await db[ENTERTAINMENT_PAGE_SECTIONS_COLLECTION].find_one(
        {"market_id": market_id, "region_id": region_id},
    )
    if existing is None:
        await db[ENTERTAINMENT_PAGE_SECTIONS_COLLECTION].insert_one(
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
        await db[ENTERTAINMENT_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": {"items": default_items, "updated_at": now}},
        )
        return default_items, False, True
    return stored, False, False


async def ensure_region_entertainment_sections(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str,
    region_codes: tuple[str, ...] | list[str],
    labels: list[str],
) -> dict[str, Any]:
    """Upsert entertainment section lists and sync layouts for the given region codes.

    Creates missing docs with fixed bands plus ``labels``. Existing non-empty
    lists are kept; empty lists are filled from the default full list. Layout
    sync runs only when the list was created or filled so editorial boards that
    already auto-fill are not rewritten to pin-only entertainment slots.

    Args:
        db: Mongo database.
        market_code: Market short code that owns the regions (e.g. ``us``, ``pr``).
        region_codes: Ordered region codes to ensure.
        labels: Ordered entertainment display labels (typically PR entertainment labels).

    Returns:
        Summary with market id and per-region codes that were ensured.

    Raises:
        ValidationError: When the market document is missing.
    """

    market = await db[MARKETS_COLLECTION].find_one({"code": market_code}, {"_id": 1})
    if market is None:
        raise ValidationError(
            f"{market_code.upper()} market not found; cannot seed entertainment sections",
        )

    market_id = str(market["_id"])
    default_items = default_entertainment_page_section_items(labels)
    now = utc_now().isoformat()
    ensured_codes: list[str] = []
    created_count = 0

    for region_code in region_codes:
        region = await get_region_by_code(db, region_code)
        if region is None:
            logger.warning("Skipping entertainment sections; region missing: %s", region_code)
            continue
        region_id = str(region["_id"])
        items, created, should_sync = await _resolve_region_entertainment_items(
            db,
            market_id=market_id,
            region_id=region_id,
            default_items=default_items,
            now=now,
        )
        if created:
            created_count += 1
        if should_sync:
            await sync_entertainment_layout_slots(
                db,
                market_id=market_id,
                items=items,
                region_id=region_id,
            )
        ensured_codes.append(region_code)

    logger.info(
        "Ensured %s entertainment sections for %d regions (%d created, %d entertainment)",
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


async def ensure_us_state_entertainment_sections(
    db: AsyncIOMotorDatabase,
    *,
    labels: list[str],
) -> dict[str, Any]:
    """Upsert PR-shaped entertainment section lists and sync layouts for every US state.

    Args:
        db: Mongo database.
        labels: Ordered entertainment display labels (typically PR entertainment labels).

    Returns:
        Summary with market id and per-state region codes that were ensured.
    """

    return await ensure_region_entertainment_sections(
        db,
        market_code="us",
        region_codes=us_state_region_codes(),
        labels=labels,
    )


async def ensure_florida_county_entertainment_sections(
    db: AsyncIOMotorDatabase,
    *,
    labels: list[str],
) -> dict[str, Any]:
    """Upsert entertainment section lists and sync layouts for every Florida county.

    Args:
        db: Mongo database.
        labels: Ordered entertainment display labels (typically PR entertainment labels).

    Returns:
        Summary with market id and per-county region codes that were ensured.
    """

    return await ensure_region_entertainment_sections(
        db,
        market_code="us",
        region_codes=florida_county_region_codes(),
        labels=labels,
    )


async def ensure_pr_town_entertainment_sections(
    db: AsyncIOMotorDatabase,
    *,
    labels: list[str],
) -> dict[str, Any]:
    """Upsert entertainment section lists and sync layouts for every Puerto Rico town.

    Args:
        db: Mongo database.
        labels: Ordered entertainment display labels (typically PR entertainment labels).

    Returns:
        Summary with market id and per-town region codes that were ensured.
    """

    return await ensure_region_entertainment_sections(
        db,
        market_code="pr",
        region_codes=puerto_rico_town_region_codes(),
        labels=labels,
    )


async def ensure_country_entertainment_sections(
    db: AsyncIOMotorDatabase,
    *,
    labels: list[str],
) -> dict[str, Any]:
    """Upsert entertainment lists for the US and Puerto Rico country boards.

    Configuration sends region ``us`` / ``pr`` when no state or town is selected.

    Args:
        db: Mongo database.
        labels: Ordered entertainment display labels.

    Returns:
        Summary keyed by country code.
    """

    us_board = await ensure_region_entertainment_sections(
        db,
        market_code="us",
        region_codes=("us",),
        labels=labels,
    )
    pr_board = await ensure_region_entertainment_sections(
        db,
        market_code="pr",
        region_codes=("pr",),
        labels=labels,
    )
    return {"us": us_board, "pr": pr_board}


async def ensure_geo_entertainment_sections(
    db: AsyncIOMotorDatabase,
    *,
    labels: list[str],
) -> dict[str, Any]:
    """Ensure entertainment lists for countries, US states, FL counties, and PR towns.

    Args:
        db: Mongo database.
        labels: Ordered entertainment display labels (typically PR entertainment labels).

    Returns:
        Combined summary keyed by geo group.
    """

    countries = await ensure_country_entertainment_sections(db, labels=labels)
    states = await ensure_us_state_entertainment_sections(db, labels=labels)
    counties = await ensure_florida_county_entertainment_sections(db, labels=labels)
    towns = await ensure_pr_town_entertainment_sections(db, labels=labels)
    return {
        "countries": countries,
        "us_states": states,
        "florida_counties": counties,
        "pr_towns": towns,
    }
