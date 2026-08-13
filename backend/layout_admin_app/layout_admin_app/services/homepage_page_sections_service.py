"""Per-market / per-region main (homepage) page section list CRUD and layout sync."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import NotFoundError, ValidationError
from shared.core.homepage_page_sections_sync import (
    CANONICAL_SLUG_BY_TYPE,
    DEFAULT_HOMEPAGE_SECTION_ITEMS,
    PREFERRED_SLUG_PREFIX_BY_TYPE,
    PRESERVED_HOMEPAGE_PAGE_KEYS,
    SECTION_TYPE_CATEGORY,
    SECTION_TYPE_HERO,
    expand_homepage_section_items,
    has_ribbon_ad_section,
    insert_legacy_homepage_ribbon_ads,
    slugify_section_label,
    sync_homepage_layout_slots,
)

from shared.core.logger import get_logger
from shared.core.page_ad_placements import (
    PAGE_NAME_HOMEPAGE,
    default_ads_for_page,
    normalize_ads,
    resolve_ads_list,
)
from shared.core.regions import get_region_by_code
from shared.models.common import utc_now
from shared.read.collections import HOMEPAGE_PAGE_SECTIONS_COLLECTION
from shared.read.market_reads import get_market_by_code
from shared.schemas.homepage_page_sections_schemas import (
    HomepagePageSectionItemIn,
    HomepagePageSectionItemOut,
    HomepagePageSectionsOut,
    HomepagePageSectionsUpdate,
)
from shared.schemas.page_ad_placements_schemas import PageAdPlacementOut

RIBBON_ADS_MIGRATED_FIELD = "ribbon_ads_migrated"

logger = get_logger(__name__)

_SLUG_SAFE_RE = re.compile(r"[^a-z0-9]+")


def _normalize_slug(value: str) -> str:
    """Normalize an explicit slug, preserving hyphenated section keys."""

    normalized = _SLUG_SAFE_RE.sub("-", value.strip().lower()).strip("-")
    if not normalized:
        raise ValidationError("Section slug must contain letters or numbers")
    return normalized


def _unique_preferred_slug(prefix: str, seen_slugs: set[str]) -> str:
    """Pick an unused slug for repeatable section types (more_top_stories, etc.)."""

    if prefix not in seen_slugs:
        return prefix
    suffix = 2
    while f"{prefix}-{suffix}" in seen_slugs:
        suffix += 1
    return f"{prefix}-{suffix}"


def _resolve_item_slug(
    *,
    section_type: str,
    label: str,
    slug: str | None,
    seen_slugs: set[str],
) -> str:
    """Pick a unique position_key for one section row."""

    if section_type == SECTION_TYPE_HERO:
        return CANONICAL_SLUG_BY_TYPE[SECTION_TYPE_HERO]

    if slug:
        return _normalize_slug(slug)

    canonical = CANONICAL_SLUG_BY_TYPE.get(section_type)
    if canonical and canonical not in seen_slugs:
        return canonical

    preferred_prefix = PREFERRED_SLUG_PREFIX_BY_TYPE.get(section_type)
    if preferred_prefix:
        return _unique_preferred_slug(preferred_prefix, seen_slugs)

    return slugify_section_label(label)


def _normalize_items(items: list[HomepagePageSectionItemIn]) -> list[dict[str, str]]:
    """Normalize incoming items to unique typed slug/label rows in order."""

    resolved: list[dict[str, str]] = []
    seen_slugs: set[str] = set()
    hero_count = 0

    for item in items:
        label = item.label.strip()
        if not label:
            raise ValidationError("Section label cannot be empty")

        section_type = item.section_type
        if section_type == SECTION_TYPE_HERO:
            hero_count += 1
            if hero_count > 1:
                raise ValidationError("Only one hero section is allowed")

        slug = _resolve_item_slug(
            section_type=section_type,
            label=label,
            slug=item.slug,
            seen_slugs=seen_slugs,
        )

        if section_type == SECTION_TYPE_CATEGORY and slug in PRESERVED_HOMEPAGE_PAGE_KEYS:
            raise ValidationError(f"Category slug '{slug}' is reserved")

        if section_type != SECTION_TYPE_CATEGORY:
            expected = CANONICAL_SLUG_BY_TYPE.get(section_type)
            if expected and slug == expected:
                pass
            elif (
                section_type not in PREFERRED_SLUG_PREFIX_BY_TYPE
                and slug in PRESERVED_HOMEPAGE_PAGE_KEYS
                and slug != expected
            ):
                raise ValidationError(
                    f"Slug '{slug}' is reserved for another section type",
                )

        if slug in seen_slugs:
            # Prefer auto-renumbering over failing so clients can add + reorder
            # empty-slug rows (e.g. new ribbon ads) before save.
            preferred = PREFERRED_SLUG_PREFIX_BY_TYPE.get(section_type)
            slug = _unique_preferred_slug(preferred or slug, seen_slugs)

        seen_slugs.add(slug)
        resolved.append(
            {
                "section_type": section_type,
                "slug": slug,
                "label": label,
            },
        )
    return resolved


async def _resolve_market(db: AsyncIOMotorDatabase, market_code: str) -> dict[str, Any]:
    """Load a market document by code or raise NotFoundError."""

    market = await get_market_by_code(db, market_code)
    if market is None:
        raise NotFoundError(f"Market not found: {market_code}")
    return market


async def _resolve_region_scope(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str,
    region_code: str | None,
) -> tuple[str | None, str | None]:
    """Resolve optional region code to (region_id, normalized region_code).

    Args:
        db: Database connection.
        market_code: Market short code for the request.
        region_code: Optional region code such as ``us-fl``.

    Returns:
        Tuple of region document id and normalized code, or (None, None).

    Raises:
        NotFoundError: When the region code is unknown.
        ValidationError: When the region does not belong to the market.
    """

    normalized = (region_code or "").strip().lower() or None
    if not normalized:
        return None, None

    region = await get_region_by_code(db, normalized)
    if region is None:
        raise NotFoundError(f"Region not found: {normalized}")

    country_code = str(region.get("country_code") or "").strip().lower()
    if country_code and country_code != market_code.strip().lower():
        raise ValidationError(
            f"Region '{normalized}' does not belong to market '{market_code}'",
        )
    return str(region["_id"]), normalized


def _sections_query(*, market_id: str, region_id: str | None) -> dict[str, Any]:
    """Build the unique-scope filter for a homepage sections document."""

    if region_id is not None:
        return {"market_id": market_id, "region_id": region_id}
    return {
        "market_id": market_id,
        "$or": [{"region_id": None}, {"region_id": {"$exists": False}}],
    }


async def _upsert_sections_doc(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    region_id: str | None,
    items: list[dict[str, str]],
    ads: list[dict[str, Any]],
    now: str,
    ribbon_ads_migrated: bool = True,
) -> None:
    """Insert or replace the homepage sections document for one scope."""

    query = _sections_query(market_id=market_id, region_id=region_id)
    existing = await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].find_one(query, {"_id": 1})
    payload = {
        "items": items,
        "ads": ads,
        "updated_at": now,
        "region_id": region_id,
        RIBBON_ADS_MIGRATED_FIELD: ribbon_ads_migrated,
    }
    if existing is not None:
        await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": payload},
        )
        return

    await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].insert_one(
        {
            "_id": str(uuid4()),
            "market_id": market_id,
            **payload,
        },
    )


def _ads_out(ads: list[dict[str, Any]]) -> list[PageAdPlacementOut]:
    """Map stored ad rows to API models."""

    return [PageAdPlacementOut(**row) for row in ads]


def _to_out(
    *,
    market_id: str,
    market_code: str,
    items: list[dict[str, str]],
    ads: list[dict[str, Any]],
    updated_at: str,
    region_id: str | None = None,
    region_code: str | None = None,
) -> HomepagePageSectionsOut:
    """Map stored config to API response."""

    return HomepagePageSectionsOut(
        market_id=market_id,
        market_code=market_code,
        region_id=region_id,
        region_code=region_code,
        items=[
            HomepagePageSectionItemOut(
                section_type=i["section_type"],  # type: ignore[arg-type]
                slug=i["slug"],
                label=i["label"],
            )
            for i in items
        ],
        ads=_ads_out(ads),
        updated_at=updated_at,
    )


async def get_for_market(
    db: AsyncIOMotorDatabase,
    market_code: str,
    *,
    region_code: str | None = None,
) -> HomepagePageSectionsOut:
    """Return the main-page section list for a market and optional region."""

    market = await _resolve_market(db, market_code)
    market_id = str(market["_id"])
    region_id, normalized_region = await _resolve_region_scope(
        db,
        market_code=market_code,
        region_code=region_code,
    )
    doc = await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].find_one(
        _sections_query(market_id=market_id, region_id=region_id),
    )
    if doc is None:
        items = [dict(row) for row in DEFAULT_HOMEPAGE_SECTION_ITEMS]
        ads = default_ads_for_page(PAGE_NAME_HOMEPAGE)
        return _to_out(
            market_id=market_id,
            market_code=str(market["code"]),
            region_id=region_id,
            region_code=normalized_region,
            items=items,
            ads=ads,
            updated_at=utc_now().isoformat(),
        )
    items = expand_homepage_section_items(list(doc.get("items") or []))
    ads = resolve_ads_list(doc.get("ads"), page_name=PAGE_NAME_HOMEPAGE)
    now = utc_now().isoformat()
    if not doc.get(RIBBON_ADS_MIGRATED_FIELD) and not has_ribbon_ad_section(items):
        items = insert_legacy_homepage_ribbon_ads(items)
        await _upsert_sections_doc(
            db,
            market_id=market_id,
            region_id=region_id,
            items=items,
            ads=ads,
            now=now,
            ribbon_ads_migrated=True,
        )
        await sync_homepage_layout_slots(
            db,
            market_id=market_id,
            items=items,
            region_id=region_id,
        )
        return _to_out(
            market_id=market_id,
            market_code=str(market["code"]),
            region_id=region_id,
            region_code=normalized_region,
            items=items,
            ads=ads,
            updated_at=now,
        )
    if not doc.get(RIBBON_ADS_MIGRATED_FIELD):
        await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": doc["_id"]},
            {"$set": {RIBBON_ADS_MIGRATED_FIELD: True}},
        )
    return _to_out(
        market_id=market_id,
        market_code=str(market["code"]),
        region_id=region_id,
        region_code=normalized_region,
        items=items,
        ads=ads,
        updated_at=str(doc.get("updated_at") or now),
    )


async def replace_for_market(
    db: AsyncIOMotorDatabase,
    market_code: str,
    body: HomepagePageSectionsUpdate,
    *,
    region_code: str | None = None,
) -> HomepagePageSectionsOut:
    """Replace the main-page section list and sync the matching homepage layout."""

    market = await _resolve_market(db, market_code)
    market_id = str(market["_id"])
    region_id, normalized_region = await _resolve_region_scope(
        db,
        market_code=market_code,
        region_code=region_code,
    )
    items = _normalize_items(body.items)
    if body.ads is None:
        existing = await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].find_one(
            _sections_query(market_id=market_id, region_id=region_id),
        )
        ads = resolve_ads_list(
            None if existing is None else existing.get("ads"),
            page_name=PAGE_NAME_HOMEPAGE,
        )
    else:
        ads = normalize_ads(list(body.ads))
    now = utc_now().isoformat()
    await _upsert_sections_doc(
        db,
        market_id=market_id,
        region_id=region_id,
        items=items,
        ads=ads,
        now=now,
    )
    await sync_homepage_layout_slots(
        db,
        market_id=market_id,
        items=items,
        region_id=region_id,
    )
    logger.info(
        "Updated main page sections for market %s region %s (%d items)",
        market_code,
        normalized_region,
        len(items),
    )
    return _to_out(
        market_id=market_id,
        market_code=str(market["code"]),
        region_id=region_id,
        region_code=normalized_region,
        items=items,
        ads=ads,
        updated_at=now,
    )
