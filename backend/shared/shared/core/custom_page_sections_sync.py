"""Shared helpers to sync custom tab page section lists into layouts/slots."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import ValidationError
from shared.core.geo_catalog import (
    country_region_codes,
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
    CUSTOM_PAGE_SECTIONS_COLLECTION,
    LAYOUTS_COLLECTION,
    MARKETS_COLLECTION,
    SLOTS_COLLECTION,
)

logger = get_logger(__name__)

HERO_POSITION_KEY = "hero"
US_FEATURED_POSITION_KEY = "us-featured"
LIVE_POSITION_KEY = "health"
PRESERVED_CUSTOM_PAGE_KEYS = frozenset(
    {
        HERO_POSITION_KEY,
        US_FEATURED_POSITION_KEY,
        LIVE_POSITION_KEY,
    },
)

SECTION_TYPE_HERO = "hero"
SECTION_TYPE_TOP_STORIES = "top_stories"
SECTION_TYPE_LIVE = "live"
SECTION_TYPE_TOPIC = "topic"
SECTION_TYPE_RIBBON_AD = "ribbon_ad"

RIBBON_AD_POSITION_KEY = "ad-ribbon"
RIBBON_AD_ARTICLE_LIMIT = 0

CUSTOM_PAGE_SECTION_TYPES = frozenset(
    {
        SECTION_TYPE_HERO,
        SECTION_TYPE_TOP_STORIES,
        SECTION_TYPE_LIVE,
        SECTION_TYPE_TOPIC,
        SECTION_TYPE_RIBBON_AD,
    },
)
CANONICAL_SLUG_BY_TYPE = {
    SECTION_TYPE_HERO: HERO_POSITION_KEY,
    SECTION_TYPE_TOP_STORIES: US_FEATURED_POSITION_KEY,
    SECTION_TYPE_LIVE: LIVE_POSITION_KEY,
}
PREFERRED_SLUG_PREFIX_BY_TYPE = {
    SECTION_TYPE_RIBBON_AD: RIBBON_AD_POSITION_KEY,
    SECTION_TYPE_TOPIC: "topic",
}
DEFAULT_LABEL_BY_TYPE = {
    SECTION_TYPE_HERO: "Section",
    SECTION_TYPE_TOP_STORIES: "Top Stories",
    SECTION_TYPE_LIVE: "Live",
    SECTION_TYPE_RIBBON_AD: "Ribbon Advertisement",
}
CUSTOM_SECTION_PAIR_SIZE = 2
DEFAULT_CUSTOM_TOPIC_LABELS: tuple[str, ...] = ()

CUSTOM_SECTION_ARTICLE_LIMIT = 12
CUSTOM_HERO_ARTICLE_LIMIT = 12
CUSTOM_TOP_STORIES_ARTICLE_LIMIT = 12
CUSTOM_LIVE_ARTICLE_LIMIT = 20
LIVE_CATEGORY_SLUG = "health"
_SLUG_SAFE_RE = re.compile(r"[^a-z0-9]+")


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


def insert_legacy_custom_ribbon_ads(items: list[dict[str, str]]) -> list[dict[str, str]]:
    """Insert ribbon rows matching the Entertainment/Health heuristic placements.

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
            section_type == SECTION_TYPE_TOPIC
            and compact_index > 0
            and compact_index % CUSTOM_SECTION_PAIR_SIZE == 0
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
        if section_type == SECTION_TYPE_TOPIC:
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
DEFAULT_FIXED_SECTION_ITEMS: list[dict[str, str]] = insert_legacy_custom_ribbon_ads(
    [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS_WITHOUT_RIBBONS],
)


def slugify_custom_label(label: str) -> str:
    """Derive a URL-safe topic slug from a display label.

    Args:
        label: Human-readable topic name.

    Returns:
        Lowercase hyphenated slug.

    Raises:
        ValidationError: When the label yields an empty slug.
    """

    normalized = _SLUG_SAFE_RE.sub("-", label.strip().lower()).strip("-")
    if not normalized:
        raise ValidationError("Topic label must contain letters or numbers")
    return normalized


def expand_legacy_custom_section_items(items: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Normalize stored items for sync or API output.

    Args:
        items: Raw custom_page_sections items (may omit ``section_type``).

    Returns:
        Ordered ``{section_type, slug, label}`` rows.
    """

    if not items:
        return [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS]

    has_typed = any(str(item.get("section_type") or "").strip() for item in items)
    if has_typed:
        resolved: list[dict[str, str]] = []
        for item in items:
            section_type = str(item.get("section_type") or SECTION_TYPE_TOPIC).strip().lower()
            if section_type not in CUSTOM_PAGE_SECTION_TYPES:
                section_type = SECTION_TYPE_TOPIC
            resolved.append(
                {
                    "section_type": section_type,
                    "slug": str(item["slug"]).strip().lower(),
                    "label": str(item["label"]).strip(),
                },
            )
        return resolved

    topics = [
        {
            "section_type": SECTION_TYPE_TOPIC,
            "slug": str(item["slug"]).strip().lower(),
            "label": str(item["label"]).strip(),
        }
        for item in items
        if str(item.get("slug") or "").strip() and str(item.get("label") or "").strip()
    ]
    return insert_legacy_custom_ribbon_ads(
        [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS_WITHOUT_RIBBONS] + topics,
    )


def topic_rows_from_labels(labels: list[str]) -> list[dict[str, str]]:
    """Build typed topic rows from display labels.

    Args:
        labels: Ordered topic display names.

    Returns:
        Topic-typed section items with derived slugs.
    """

    return [
        {
            "section_type": SECTION_TYPE_TOPIC,
            "slug": slugify_custom_label(label),
            "label": label,
        }
        for label in labels
    ]


def default_custom_page_section_items(
    labels: list[str] | None = None,
    *,
    hero_label: str | None = None,
) -> list[dict[str, str]]:
    """Full default custom page list: fixed bands plus optional topic rows.

    Args:
        labels: Ordered topic display names.
        hero_label: Optional hero band label (defaults to ``Section``).

    Returns:
        Fixed sections followed by topic rows, with legacy ad ribbons inserted.
    """

    fixed = [dict(row) for row in DEFAULT_FIXED_SECTION_ITEMS_WITHOUT_RIBBONS]
    if hero_label and hero_label.strip():
        fixed[0] = {
            **fixed[0],
            "label": hero_label.strip(),
        }
    topic_labels = list(labels) if labels is not None else list(DEFAULT_CUSTOM_TOPIC_LABELS)
    return insert_legacy_custom_ribbon_ads(fixed + topic_rows_from_labels(topic_labels))


async def _ensure_parent_category(
    db: AsyncIOMotorDatabase,
    *,
    slug: str,
    label: str,
) -> str:
    """Ensure the parent category for a custom tab exists.

    Args:
        db: Mongo database.
        slug: Parent category slug (matches tab page name).
        label: Display name for the parent category.

    Returns:
        Category document id.
    """

    existing = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    if existing is not None:
        await db[CATEGORIES_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "name": label,
                    "description": f"{label} news.",
                    "parent_id": None,
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
    logger.info("Created custom tab parent category %s", slug)
    return category_id


async def _ensure_topic_category(
    db: AsyncIOMotorDatabase,
    *,
    slug: str,
    label: str,
    parent_category_slug: str,
    parent_label: str,
) -> str:
    """Ensure a topic category exists under the custom tab parent.

    Args:
        db: Mongo database.
        slug: Topic category slug.
        label: Topic display name.
        parent_category_slug: Parent tab slug.
        parent_label: Parent tab display name.

    Returns:
        Category document id.
    """

    parent_id = await _ensure_parent_category(
        db,
        slug=parent_category_slug,
        label=parent_label,
    )
    if slug == parent_category_slug:
        return parent_id
    existing = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    if existing is not None:
        await db[CATEGORIES_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "name": label,
                    "description": f"{label} news.",
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
            "description": f"{label} news.",
            "created_at": utc_now().isoformat(),
        },
    )
    logger.info("Created custom topic category %s under %s", slug, parent_category_slug)
    return category_id


async def _ensure_custom_layout(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    page_name: str,
) -> dict[str, Any]:
    """Ensure an active market-level layout exists for a custom tab page."""

    layout = await db[LAYOUTS_COLLECTION].find_one(
        {
            "page_name": page_name,
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
        "page_name": page_name,
        "market_id": market_id,
        "slot_ids": [],
        "is_active": True,
        "updated_at": now,
    }
    await db[LAYOUTS_COLLECTION].insert_one(layout)
    logger.info("Created custom layout %s for market %s", page_name, market_id)
    return layout


async def _ensure_region_custom_layout(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    region_id: str,
    page_name: str,
) -> dict[str, Any]:
    """Ensure a region-owned custom layout exists, cloning from market when needed."""

    from shared.core.layout_ensure import ensure_exact_page_layout

    await _ensure_custom_layout(db, market_id=market_id, page_name=page_name)
    layout_id = await ensure_exact_page_layout(
        db,
        region_id=region_id,
        page_name=page_name,
    )
    if layout_id is None:
        raise ValidationError(f"Unable to ensure custom layout for region {region_id}")

    layout = await db[LAYOUTS_COLLECTION].find_one({"_id": layout_id})
    if layout is None:
        raise ValidationError(f"Custom layout missing after ensure: {layout_id}")
    return layout


def _custom_slot_query_rule(
    *,
    limit: int,
    existing: dict[str, Any] | None,
    category_id: str | None,
) -> dict[str, Any]:
    """Build query_rule so custom slots auto-fill from their category."""

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
    """Create or update one custom layout slot without wiping existing pins."""

    existing = await db[SLOTS_COLLECTION].find_one(
        {"layout_id": layout_id, "position_key": position_key},
    )
    fields = {
        "query_rule": _custom_slot_query_rule(
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


async def _delete_obsolete_custom_slots(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    keep_slot_ids: set[str],
) -> None:
    """Remove custom-page slots that are no longer in the active list."""

    cursor = db[SLOTS_COLLECTION].find({"layout_id": layout_id})
    async for slot in cursor:
        if str(slot["_id"]) in keep_slot_ids:
            continue
        await db[SLOTS_COLLECTION].delete_one({"_id": slot["_id"]})


async def _category_id_by_slug(db: AsyncIOMotorDatabase, slug: str) -> str | None:
    """Return category id for a slug, if present."""

    category = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    return str(category["_id"]) if category else None


async def _apply_custom_slots_to_layout(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    slot_specs: list[dict[str, Any]],
    now: str,
) -> list[str]:
    """Upsert custom slots onto one layout and delete obsolete rows."""

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
    await _delete_obsolete_custom_slots(db, layout_id=layout_id, keep_slot_ids=set(slot_ids))
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
    parent_category_id: str | None,
    live_category_id: str | None,
    parent_category_slug: str,
    parent_label: str,
) -> dict[str, Any]:
    """Build one layout slot spec from a typed custom page section item."""

    section_type = item["section_type"]
    slug = item["slug"]
    label = item["label"]

    if section_type == SECTION_TYPE_HERO:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_HERO,
            "category_id": parent_category_id,
            "limit": CUSTOM_HERO_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_TOP_STORIES:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_FEATURED_BAND,
            "category_id": parent_category_id,
            "limit": CUSTOM_TOP_STORIES_ARTICLE_LIMIT,
        }
    if section_type == SECTION_TYPE_LIVE:
        return {
            "position_key": slug,
            "order_index": order_index,
            "display_name": label,
            "presentation_type": PRESENTATION_LIVE_CAROUSEL,
            "category_id": live_category_id,
            "limit": CUSTOM_LIVE_ARTICLE_LIMIT,
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

    category_id = await _ensure_topic_category(
        db,
        slug=slug,
        label=label,
        parent_category_slug=parent_category_slug,
        parent_label=parent_label,
    )
    return {
        "position_key": slug,
        "order_index": order_index,
        "display_name": label,
        "presentation_type": PRESENTATION_GRID_4,
        "category_id": category_id,
        "limit": CUSTOM_SECTION_ARTICLE_LIMIT,
    }


async def sync_custom_layout_slots(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    page_name: str,
    parent_label: str,
    items: list[dict[str, Any]],
    region_id: str | None = None,
) -> None:
    """Rebuild custom page slots from an ordered typed section list.

    Args:
        db: Mongo database.
        market_id: Market document id.
        page_name: Layout page name / tab slug.
        parent_label: Display name for the parent category.
        items: Typed section rows.
        region_id: Optional region board id.
    """

    resolved = expand_legacy_custom_section_items(items)
    parent_category_slug = page_name
    await _ensure_parent_category(db, slug=parent_category_slug, label=parent_label)
    parent_category_id = await _category_id_by_slug(db, parent_category_slug)
    live_category_id = await _category_id_by_slug(db, LIVE_CATEGORY_SLUG)

    if region_id is not None:
        layout = await _ensure_region_custom_layout(
            db,
            market_id=market_id,
            region_id=region_id,
            page_name=page_name,
        )
    else:
        layout = await _ensure_custom_layout(db, market_id=market_id, page_name=page_name)

    now = utc_now().isoformat()
    slot_specs: list[dict[str, Any]] = []
    for order_index, item in enumerate(resolved):
        slot_specs.append(
            await _slot_spec_for_section(
                db,
                item=item,
                order_index=order_index,
                parent_category_id=parent_category_id,
                live_category_id=live_category_id,
                parent_category_slug=parent_category_slug,
                parent_label=parent_label,
            ),
        )
    await _apply_custom_slots_to_layout(
        db,
        layout_id=str(layout["_id"]),
        slot_specs=slot_specs,
        now=now,
    )


def region_codes_for_market(market_code: str) -> tuple[str, ...]:
    """Return geo region codes that belong to a market's full board tree.

    Args:
        market_code: Market short code such as ``us`` or ``pr``.

    Returns:
        Country code plus descendant locality codes for that market.
    """

    normalized = market_code.strip().lower()
    if normalized == "us":
        return ("us",) + us_state_region_codes() + florida_county_region_codes()
    if normalized == "pr":
        return ("pr",) + puerto_rico_town_region_codes()
    # Future markets: country board only until a finer geo catalog exists.
    return (normalized,)


async def ensure_market_custom_geo_sections(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str,
    page_name: str,
    label: str,
    items: list[dict[str, str]],
) -> dict[str, Any]:
    """Seed custom section boards for every geo locality under a market.

    Creates missing region boards from ``items`` and syncs layouts. Existing
    non-empty boards are left unchanged so editorial edits are preserved.

    Args:
        db: Mongo database.
        market_code: Owning market short code.
        page_name: Custom tab slug / layout page name.
        label: Tab display name for parent category sync.
        items: Default typed section rows to seed.

    Returns:
        Summary with market id and ensured region codes.

    Raises:
        ValidationError: When the market document is missing.
    """

    market = await db[MARKETS_COLLECTION].find_one(
        {"code": market_code.strip().lower()},
        {"_id": 1},
    )
    if market is None:
        raise ValidationError(
            f"{market_code.upper()} market not found; cannot seed custom tab sections",
        )

    market_id = str(market["_id"])
    now = utc_now().isoformat()
    ensured_codes: list[str] = []
    created_count = 0

    for region_code in region_codes_for_market(market_code):
        region = await get_region_by_code(db, region_code)
        if region is None:
            logger.warning("Skipping custom sections; region missing: %s", region_code)
            continue
        region_id = str(region["_id"])
        query = {
            "page_name": page_name,
            "market_id": market_id,
            "region_id": region_id,
        }
        existing = await db[CUSTOM_PAGE_SECTIONS_COLLECTION].find_one(query)
        if existing is None:
            await db[CUSTOM_PAGE_SECTIONS_COLLECTION].insert_one(
                {
                    "_id": str(uuid4()),
                    "page_name": page_name,
                    "market_id": market_id,
                    "region_id": region_id,
                    "items": items,
                    "ads": [],
                    "updated_at": now,
                },
            )
            created_count += 1
            await sync_custom_layout_slots(
                db,
                market_id=market_id,
                page_name=page_name,
                parent_label=label,
                items=items,
                region_id=region_id,
            )
        elif not list(existing.get("items") or []):
            await db[CUSTOM_PAGE_SECTIONS_COLLECTION].update_one(
                {"_id": existing["_id"]},
                {"$set": {"items": items, "updated_at": now}},
            )
            await sync_custom_layout_slots(
                db,
                market_id=market_id,
                page_name=page_name,
                parent_label=label,
                items=items,
                region_id=region_id,
            )
        ensured_codes.append(region_code)

    logger.info(
        "Ensured custom tab %s geo boards for market %s (%d regions, %d created)",
        page_name,
        market_code,
        len(ensured_codes),
        created_count,
    )
    return {
        "market_id": market_id,
        "region_codes": ensured_codes,
        "created_count": created_count,
    }
