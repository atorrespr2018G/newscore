"""Shared helpers to sync main (homepage) page section lists into layouts/slots."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import ValidationError
from shared.core.logger import get_logger
from shared.core.markets import (
    PRESENTATION_EDITORIAL_LEAD,
    PRESENTATION_EDITORIAL_SPOTLIGHT,
    PRESENTATION_FEATURED_BAND,
    PRESENTATION_GRID_4,
    PRESENTATION_HERO,
    PRESENTATION_LIVE_CAROUSEL,
    PRESENTATION_RAIL_COMPACT,
    PRESENTATION_RIBBON_AD,
)
from shared.models.common import utc_now
from shared.read.collections import (
    CATEGORIES_COLLECTION,
    LAYOUTS_COLLECTION,
    SLOTS_COLLECTION,
)

logger = get_logger(__name__)

HOMEPAGE_PAGE_NAME = "homepage"
HERO_POSITION_KEY = "hero"
US_FEATURED_POSITION_KEY = "us-featured"
LIVE_POSITION_KEY = "health"
MORE_TOP_STORIES_POSITION_KEY = "more-top-stories"
SPOTLIGHT_POSITION_KEY = "midterm-elections"
RAIL_POSITION_KEY = "editorial-rail"

SECTION_TYPE_HERO = "hero"
SECTION_TYPE_TOP_STORIES = "top_stories"
SECTION_TYPE_LIVE = "live"
SECTION_TYPE_MORE_TOP_STORIES = "more_top_stories"
SECTION_TYPE_SPOTLIGHT = "spotlight"
SECTION_TYPE_RAIL = "rail"
SECTION_TYPE_CATEGORY = "category"
SECTION_TYPE_RIBBON_AD = "ribbon_ad"

RIBBON_AD_POSITION_KEY = "ad-ribbon"
RIBBON_AD_ARTICLE_LIMIT = 0

HOMEPAGE_PAGE_SECTION_TYPES = frozenset(
    {
        SECTION_TYPE_HERO,
        SECTION_TYPE_TOP_STORIES,
        SECTION_TYPE_LIVE,
        SECTION_TYPE_MORE_TOP_STORIES,
        SECTION_TYPE_SPOTLIGHT,
        SECTION_TYPE_RAIL,
        SECTION_TYPE_CATEGORY,
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
    SECTION_TYPE_MORE_TOP_STORIES: MORE_TOP_STORIES_POSITION_KEY,
    SECTION_TYPE_SPOTLIGHT: SPOTLIGHT_POSITION_KEY,
    SECTION_TYPE_RAIL: RAIL_POSITION_KEY,
    SECTION_TYPE_RIBBON_AD: RIBBON_AD_POSITION_KEY,
}

PRESERVED_HOMEPAGE_PAGE_KEYS = frozenset(
    {
        HERO_POSITION_KEY,
        US_FEATURED_POSITION_KEY,
        LIVE_POSITION_KEY,
        MORE_TOP_STORIES_POSITION_KEY,
        f"{MORE_TOP_STORIES_POSITION_KEY}-2",
        SPOTLIGHT_POSITION_KEY,
        f"{SPOTLIGHT_POSITION_KEY}-2",
        RAIL_POSITION_KEY,
        f"{RAIL_POSITION_KEY}-2",
    },
)

DEFAULT_LABEL_BY_TYPE = {
    SECTION_TYPE_HERO: "Hero",
    SECTION_TYPE_TOP_STORIES: "Top Stories",
    SECTION_TYPE_LIVE: "Live",
    SECTION_TYPE_MORE_TOP_STORIES: "More Top Stories",
    SECTION_TYPE_SPOTLIGHT: "Elections",
    SECTION_TYPE_RAIL: "Sports",
    SECTION_TYPE_RIBBON_AD: "Ribbon Advertisement",
}

# Category keys that historically had a heuristic ribbon immediately before them.
_HOMEPAGE_RIBBON_BEFORE_CATEGORY_KEYS = frozenset(
    {"politics", "health", "finance", "technology", "world"},
)


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


def has_post_hero_ribbon_ad_section(items: list[dict[str, str]]) -> bool:
    """Return whether a ribbon row is directly after the Hero row."""

    for index, item in enumerate(items[:-1]):
        if (
            item.get("section_type") == SECTION_TYPE_HERO
            and items[index + 1].get("section_type") == SECTION_TYPE_RIBBON_AD
        ):
            return True
    return False


def insert_legacy_homepage_ribbon_ads(items: list[dict[str, str]]) -> list[dict[str, str]]:
    """Insert ribbon rows matching the former homepage heuristic placements.

    Args:
        items: Typed section rows without configurable ribbons.

    Returns:
        Copy of ``items`` with ribbon advertisement rows inserted in legacy spots.
    """

    if has_post_hero_ribbon_ad_section(items):
        return [dict(row) for row in items]

    if has_ribbon_ad_section(items):
        result = []
        used_slugs = {str(item.get("slug") or "") for item in items}
        for item in items:
            result.append(dict(item))
            if item.get("section_type") == SECTION_TYPE_HERO:
                ribbon_slug = _next_ribbon_slug(used_slugs)
                used_slugs.add(ribbon_slug)
                result.append(_ribbon_ad_item(ribbon_slug))
        return result

    result: list[dict[str, str]] = []
    used_slugs = {str(item.get("slug") or "") for item in items}
    previous_type: str | None = None

    for item in items:
        section_type = item["section_type"]
        slug = item["slug"]
        needs_before = False
        if previous_type is not None:
            if section_type in {SECTION_TYPE_MORE_TOP_STORIES, SECTION_TYPE_LIVE}:
                needs_before = True
            elif (
                section_type == SECTION_TYPE_CATEGORY
                and slug in _HOMEPAGE_RIBBON_BEFORE_CATEGORY_KEYS
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
        previous_type = section_type
    return result


# Defaults match the previous public landing stack, including heuristic ad ribbons.
DEFAULT_HOMEPAGE_SECTION_ITEMS: list[dict[str, str]] = insert_legacy_homepage_ribbon_ads(
    [
        {"section_type": SECTION_TYPE_HERO, "slug": HERO_POSITION_KEY, "label": "Hero"},
        {
            "section_type": SECTION_TYPE_TOP_STORIES,
            "slug": US_FEATURED_POSITION_KEY,
            "label": "Top Stories",
        },
        {
            "section_type": SECTION_TYPE_MORE_TOP_STORIES,
            "slug": MORE_TOP_STORIES_POSITION_KEY,
            "label": "More Top Stories",
        },
        {"section_type": SECTION_TYPE_RAIL, "slug": RAIL_POSITION_KEY, "label": "Sports"},
        {"section_type": SECTION_TYPE_CATEGORY, "slug": "politics", "label": "Politics"},
        {
            "section_type": SECTION_TYPE_CATEGORY,
            "slug": SPOTLIGHT_POSITION_KEY,
            "label": "Elections",
        },
        {"section_type": SECTION_TYPE_CATEGORY, "slug": "sports", "label": "Sports"},
        {"section_type": SECTION_TYPE_CATEGORY, "slug": "government", "label": "Government"},
        {"section_type": SECTION_TYPE_LIVE, "slug": LIVE_POSITION_KEY, "label": "Live"},
        {"section_type": SECTION_TYPE_CATEGORY, "slug": "finance", "label": "Health"},
        {
            "section_type": SECTION_TYPE_CATEGORY,
            "slug": "entertainment",
            "label": "Entertainment",
        },
        {"section_type": SECTION_TYPE_CATEGORY, "slug": "world", "label": "World"},
        {
            "section_type": SECTION_TYPE_CATEGORY,
            "slug": "technology",
            "label": "Technology",
        },
        {"section_type": SECTION_TYPE_CATEGORY, "slug": "business", "label": "Business"},
        {
            "section_type": SECTION_TYPE_MORE_TOP_STORIES,
            "slug": f"{MORE_TOP_STORIES_POSITION_KEY}-2",
            "label": "Extra Stories",
        },
        {
            "section_type": SECTION_TYPE_SPOTLIGHT,
            "slug": f"{SPOTLIGHT_POSITION_KEY}-2",
            "label": "World watch",
        },
        {
            "section_type": SECTION_TYPE_RAIL,
            "slug": f"{RAIL_POSITION_KEY}-2",
            "label": "Featured",
        },
        {"section_type": SECTION_TYPE_CATEGORY, "slug": "us", "label": "US"},
        {"section_type": SECTION_TYPE_CATEGORY, "slug": "style", "label": "Style"},
        {"section_type": SECTION_TYPE_CATEGORY, "slug": "travel", "label": "Travel"},
    ],
)

# Spotlight position keys that fill from a specific category slug.
SPOTLIGHT_CATEGORY_BY_SLUG = {
    SPOTLIGHT_POSITION_KEY: "politics",
    f"{SPOTLIGHT_POSITION_KEY}-2": "world",
}

HERO_ARTICLE_LIMIT = 12
TOP_STORIES_ARTICLE_LIMIT = 12
LIVE_ARTICLE_LIMIT = 20
MORE_TOP_STORIES_ARTICLE_LIMIT = 7
SPOTLIGHT_ARTICLE_LIMIT = 4
RAIL_ARTICLE_LIMIT = 5
CATEGORY_ARTICLE_LIMIT = 12

_SLUG_SAFE_RE = re.compile(r"[^a-z0-9]+")


def slugify_section_label(label: str) -> str:
    """Derive a URL-safe section slug from a display label.

    Args:
        label: Human-readable section name.

    Returns:
        Lowercase hyphenated slug.

    Raises:
        ValidationError: When the label yields an empty slug.
    """

    normalized = _SLUG_SAFE_RE.sub("-", label.strip().lower()).strip("-")
    if not normalized:
        raise ValidationError("Section label must contain letters or numbers")
    return normalized


def expand_homepage_section_items(items: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Normalize stored items; empty lists become the seed default stack.

    Args:
        items: Raw homepage_page_sections items.

    Returns:
        Ordered ``{section_type, slug, label}`` rows ready for sync or API output.
    """

    if not items:
        return [dict(row) for row in DEFAULT_HOMEPAGE_SECTION_ITEMS]

    resolved: list[dict[str, str]] = []
    for item in items:
        section_type = str(item.get("section_type") or SECTION_TYPE_CATEGORY).strip().lower()
        if section_type not in HOMEPAGE_PAGE_SECTION_TYPES:
            section_type = SECTION_TYPE_CATEGORY
        slug = str(item.get("slug") or "").strip().lower()
        label = str(item.get("label") or "").strip()
        if not slug or not label:
            continue
        resolved.append(
            {
                "section_type": section_type,
                "slug": slug,
                "label": label,
            },
        )
    return resolved or [dict(row) for row in DEFAULT_HOMEPAGE_SECTION_ITEMS]


def migrate_legacy_election_section(items: list[dict[str, str]]) -> list[dict[str, str]]:
    """Move the primary Election slot from the editorial band to a category row.

    The position key remains ``midterm-elections`` so existing pinned stories
    survive the presentation upgrade when the matching slot is upserted.
    """

    election_index = next(
        (
            index
            for index, item in enumerate(items)
            if item["section_type"] == SECTION_TYPE_SPOTLIGHT
            and item["slug"] == SPOTLIGHT_POSITION_KEY
        ),
        None,
    )
    if election_index is None:
        return [dict(item) for item in items]

    migrated = [dict(item) for item in items]
    election = migrated.pop(election_index)
    election["section_type"] = SECTION_TYPE_CATEGORY
    politics_index = next(
        (
            index
            for index, item in enumerate(migrated)
            if item["section_type"] == SECTION_TYPE_CATEGORY and item["slug"] == "politics"
        ),
        None,
    )
    if politics_index is None:
        migrated.append(election)
    else:
        migrated.insert(politics_index + 1, election)
    return migrated


def default_homepage_page_section_items() -> list[dict[str, str]]:
    """Return a copy of the seeded main-page section list.

    Returns:
        Default typed section items matching HOMEPAGE_SLOT_SPECS.
    """

    return [dict(row) for row in DEFAULT_HOMEPAGE_SECTION_ITEMS]


async def _ensure_category(db: AsyncIOMotorDatabase, *, slug: str, label: str) -> str:
    """Ensure a global category exists for a section slug."""

    existing = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    if existing is not None:
        await db[CATEGORIES_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "name": label,
                    "description": f"{label} news.",
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
            "parent_id": None,
            "description": f"{label} news.",
            "created_at": utc_now().isoformat(),
        },
    )
    logger.info("Created homepage section category %s", slug)
    return category_id


async def _category_id_by_slug(db: AsyncIOMotorDatabase, slug: str) -> str | None:
    """Return category id for a slug, if present."""

    category = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    return str(category["_id"]) if category else None


async def _ensure_homepage_layout(db: AsyncIOMotorDatabase, *, market_id: str) -> dict[str, Any]:
    """Ensure an active market-level homepage layout exists."""

    layout = await db[LAYOUTS_COLLECTION].find_one(
        {
            "page_name": HOMEPAGE_PAGE_NAME,
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
        "page_name": HOMEPAGE_PAGE_NAME,
        "market_id": market_id,
        "slot_ids": [],
        "is_active": True,
        "updated_at": now,
    }
    await db[LAYOUTS_COLLECTION].insert_one(layout)
    logger.info("Created homepage layout for market %s", market_id)
    return layout


async def _ensure_region_homepage_layout(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    region_id: str,
) -> dict[str, Any]:
    """Ensure a region-owned homepage layout exists, cloning from market when needed.

    Args:
        db: Mongo database.
        market_id: Market document id.
        region_id: Region document id that must own the homepage board.

    Returns:
        Layout document for the region homepage.

    Raises:
        ValidationError: When no homepage layout can be ensured.
    """

    from shared.core.layout_ensure import ensure_exact_page_layout

    await _ensure_homepage_layout(db, market_id=market_id)
    layout_id = await ensure_exact_page_layout(
        db,
        region_id=region_id,
        page_name=HOMEPAGE_PAGE_NAME,
    )
    if layout_id is None:
        raise ValidationError(f"Unable to ensure homepage layout for region {region_id}")

    layout = await db[LAYOUTS_COLLECTION].find_one({"_id": layout_id})
    if layout is None:
        raise ValidationError(f"Homepage layout missing after ensure: {layout_id}")
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
    """Create or update one homepage layout slot without wiping existing pins.

    New slots are pin-only so a section added in configuration starts empty in
    Placement. ``category_id`` remains on the spec for taxonomy ensure callers;
    auto-fill is only preserved when an existing slot already had it.
    """

    from shared.core.slot_query_rule import query_rule_for_config_slot

    _ = category_id
    existing = await db[SLOTS_COLLECTION].find_one(
        {"layout_id": layout_id, "position_key": position_key},
    )
    fields = {
        "query_rule": query_rule_for_config_slot(limit=limit, existing=existing),
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


async def _delete_obsolete_homepage_slots(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    keep_slot_ids: set[str],
) -> None:
    """Remove homepage slots that are no longer in the active section list."""

    cursor = db[SLOTS_COLLECTION].find({"layout_id": layout_id})
    async for slot in cursor:
        if str(slot["_id"]) in keep_slot_ids:
            continue
        await db[SLOTS_COLLECTION].delete_one({"_id": slot["_id"]})


async def _apply_homepage_slots_to_layout(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    slot_specs: list[dict[str, Any]],
    now: str,
) -> list[str]:
    """Upsert homepage slots onto one layout and delete obsolete rows.

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
    await _delete_obsolete_homepage_slots(db, layout_id=layout_id, keep_slot_ids=set(slot_ids))
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
) -> dict[str, Any]:
    """Build one layout slot spec from a typed main-page section item."""

    section_type = item["section_type"]
    slug = item["slug"]
    label = item["label"]

    if section_type == SECTION_TYPE_HERO:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_HERO,
            "category_id": None,
            "limit": HERO_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_TOP_STORIES:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_FEATURED_BAND,
            "category_id": None,
            "limit": TOP_STORIES_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_LIVE:
        live_category_id = await _category_id_by_slug(db, LIVE_POSITION_KEY)
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_LIVE_CAROUSEL,
            "category_id": live_category_id,
            "limit": LIVE_ARTICLE_LIMIT,
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
    if section_type == SECTION_TYPE_MORE_TOP_STORIES:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_EDITORIAL_LEAD,
            "category_id": None,
            "limit": MORE_TOP_STORIES_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_SPOTLIGHT:
        category_slug = SPOTLIGHT_CATEGORY_BY_SLUG.get(slug) or slugify_section_label(label)
        category_id = await _ensure_category(db, slug=category_slug, label=label)
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_EDITORIAL_SPOTLIGHT,
            "category_id": category_id,
            "limit": SPOTLIGHT_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_RAIL:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_RAIL_COMPACT,
            "category_id": None,
            "limit": RAIL_ARTICLE_LIMIT,
        }

    category_id = await _ensure_category(db, slug=slug, label=label)
    return {
        "position_key": slug,
        "order_index": order_index,
        "display_name": label,
        "presentation_type": PRESENTATION_GRID_4,
        "category_id": category_id,
        "limit": CATEGORY_ARTICLE_LIMIT,
    }


async def sync_homepage_layout_slots(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    items: list[dict[str, Any]],
    region_id: str | None = None,
) -> None:
    """Rebuild homepage slots from an ordered typed section list.

    Upserts slots in list order and deletes obsolete slots. Existing pins are
    preserved per ``position_key``.

    When ``region_id`` is set, updates only that region's homepage layout.
    Otherwise updates the market-level homepage layout only.

    Args:
        db: Mongo database.
        market_id: Market document id.
        items: Ordered section rows.
        region_id: Optional region document id for a state, county, or town board.
    """

    resolved_items = expand_homepage_section_items(items)
    if region_id:
        layout = await _ensure_region_homepage_layout(
            db,
            market_id=market_id,
            region_id=region_id,
        )
    else:
        layout = await _ensure_homepage_layout(db, market_id=market_id)
    layout_id = str(layout["_id"])
    now = utc_now().isoformat()
    slot_specs: list[dict[str, Any]] = []
    for index, item in enumerate(resolved_items):
        slot_specs.append(
            await _slot_spec_for_section(
                db,
                item=item,
                order_index=index,
            ),
        )

    await _apply_homepage_slots_to_layout(
        db,
        layout_id=layout_id,
        slot_specs=slot_specs,
        now=now,
    )
