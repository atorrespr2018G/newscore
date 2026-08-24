"""Custom tab registry CRUD and market-scoped board seeding."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.custom_page_sections_sync import (
    default_custom_page_section_items,
    sync_custom_layout_slots,
)
from shared.core.custom_tabs import assert_custom_tab_slug_allowed, slugify_tab_label
from shared.core.exceptions import ConflictError, NotFoundError, ValidationError
from shared.core.logger import get_logger
from shared.core.page_ad_placements import default_ads_for_page
from shared.core.regions import get_region_by_code
from shared.models.common import utc_now
from shared.read.collections import CUSTOM_PAGE_SECTIONS_COLLECTION, CUSTOM_TABS_COLLECTION
from shared.read.market_reads import get_market_by_code
from shared.schemas.custom_tabs_schemas import (
    CustomTabCreate,
    CustomTabListOut,
    CustomTabOut,
    CustomTabUpdate,
)

logger = get_logger(__name__)


def _normalize_market_code(market_code: str) -> str:
    """Normalize a market short code.

    Args:
        market_code: Raw market code from API or form.

    Returns:
        Lowercase market code.

    Raises:
        ValidationError: When the code is empty.
    """

    normalized = market_code.strip().lower()
    if not normalized:
        raise ValidationError("Market code is required")
    return normalized


def _to_out(doc: dict[str, Any]) -> CustomTabOut:
    """Map a Mongo custom tab document to the API model."""

    return CustomTabOut(
        slug=str(doc["slug"]),
        label=str(doc["label"]),
        market_code=str(doc.get("market_code") or "").strip().lower(),
        sort_order=int(doc.get("sort_order") or 0),
        created_at=str(doc.get("created_at") or ""),
        updated_at=str(doc.get("updated_at") or ""),
    )


async def list_tabs(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str | None = None,
) -> CustomTabListOut:
    """Return custom tabs, optionally filtered to one market.

    Args:
        db: Database connection.
        market_code: When set, only tabs owned by that market are returned.

    Returns:
        Ordered custom tab list.
    """

    query: dict[str, Any] = {}
    if market_code:
        query["market_code"] = _normalize_market_code(market_code)
    cursor = db[CUSTOM_TABS_COLLECTION].find(query).sort([("sort_order", 1), ("label", 1)])
    items = [_to_out(doc) async for doc in cursor]
    return CustomTabListOut(items=items)


async def get_tab(db: AsyncIOMotorDatabase, slug: str) -> CustomTabOut:
    """Load one custom tab by slug.

    Args:
        db: Database connection.
        slug: Tab slug / page name.

    Returns:
        Custom tab payload.

    Raises:
        NotFoundError: When the slug is unknown.
    """

    normalized = slug.strip().lower()
    doc = await db[CUSTOM_TABS_COLLECTION].find_one({"slug": normalized})
    if doc is None:
        raise NotFoundError(f"Custom tab not found: {normalized}")
    return _to_out(doc)


async def _next_sort_order(db: AsyncIOMotorDatabase, *, market_code: str) -> int:
    """Allocate the next sort_order within one market."""

    last = await db[CUSTOM_TABS_COLLECTION].find_one(
        {"market_code": market_code},
        sort=[("sort_order", -1)],
    )
    if last is None:
        return 0
    return int(last.get("sort_order") or 0) + 1


async def _seed_market_board(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str,
    page_name: str,
    label: str,
) -> None:
    """Create the country-level sections doc and layout for one tab.

    State/town/county boards are created lazily on first Configuration load or
    save for that locality so Create Tab stays fast (US has 100+ geos).

    Args:
        db: Database connection.
        market_code: Owning market short code.
        page_name: Tab slug / page name.
        label: Tab display name.

    Raises:
        ValidationError: When the market or country region document is missing.
    """

    market = await get_market_by_code(db, market_code)
    if market is None:
        raise ValidationError(f"Market not found: {market_code}")
    country_region = await get_region_by_code(db, market_code)
    if country_region is None:
        raise ValidationError(f"Country region not found: {market_code}")
    market_id = str(market["_id"])
    region_id = str(country_region["_id"])
    items = default_custom_page_section_items([], hero_label=label)
    ads = default_ads_for_page(page_name)
    now = utc_now().isoformat()
    existing = await db[CUSTOM_PAGE_SECTIONS_COLLECTION].find_one(
        {
            "page_name": page_name,
            "market_id": market_id,
            "region_id": region_id,
        },
    )
    if existing is None:
        await db[CUSTOM_PAGE_SECTIONS_COLLECTION].insert_one(
            {
                "_id": str(uuid4()),
                "page_name": page_name,
                "market_id": market_id,
                "region_id": region_id,
                "items": items,
                "ads": ads,
                "updated_at": now,
            },
        )
    await sync_custom_layout_slots(
        db,
        market_id=market_id,
        page_name=page_name,
        parent_label=label,
        items=items,
        region_id=region_id,
    )


async def create_tab(db: AsyncIOMotorDatabase, body: CustomTabCreate) -> CustomTabOut:
    """Register a custom tab for one market and seed its country board.

    Locality boards (states, towns, counties) are created on demand when the
    Configuration editor opens or saves that geo scope.

    Args:
        db: Database connection.
        body: Create payload with label, market, and optional slug.

    Returns:
        Created custom tab.

    Raises:
        ValidationError: When the slug or market is invalid.
        ConflictError: When the slug already exists.
        NotFoundError: When the market code is unknown.
    """

    label = body.label.strip()
    if not label:
        raise ValidationError("Tab label cannot be empty")
    market_code = _normalize_market_code(body.market_code)
    market = await get_market_by_code(db, market_code)
    if market is None:
        raise NotFoundError(f"Market not found: {market_code}")

    raw_slug = (body.slug or "").strip() or slugify_tab_label(label)
    slug = assert_custom_tab_slug_allowed(raw_slug)
    existing = await db[CUSTOM_TABS_COLLECTION].find_one({"slug": slug})
    if existing is not None:
        raise ConflictError(f"Custom tab already exists: {slug}")

    now = utc_now().isoformat()
    sort_order = await _next_sort_order(db, market_code=market_code)
    doc = {
        "_id": str(uuid4()),
        "slug": slug,
        "label": label,
        "market_code": market_code,
        "sort_order": sort_order,
        "created_at": now,
        "updated_at": now,
    }
    await db[CUSTOM_TABS_COLLECTION].insert_one(doc)
    await _seed_market_board(
        db,
        market_code=market_code,
        page_name=slug,
        label=label,
    )
    logger.info("Created custom tab %s for market %s", slug, market_code)
    return _to_out(doc)


async def update_tab(
    db: AsyncIOMotorDatabase,
    slug: str,
    body: CustomTabUpdate,
) -> CustomTabOut:
    """Rename or reorder a custom tab.

    Args:
        db: Database connection.
        slug: Existing tab slug.
        body: Partial update fields.

    Returns:
        Updated custom tab.

    Raises:
        NotFoundError: When the slug is unknown.
        ValidationError: When the new label is empty.
    """

    normalized = slug.strip().lower()
    doc = await db[CUSTOM_TABS_COLLECTION].find_one({"slug": normalized})
    if doc is None:
        raise NotFoundError(f"Custom tab not found: {normalized}")

    updates: dict[str, Any] = {"updated_at": utc_now().isoformat()}
    if body.label is not None:
        label = body.label.strip()
        if not label:
            raise ValidationError("Tab label cannot be empty")
        updates["label"] = label
    if body.sort_order is not None:
        updates["sort_order"] = int(body.sort_order)

    await db[CUSTOM_TABS_COLLECTION].update_one({"_id": doc["_id"]}, {"$set": updates})
    refreshed = await db[CUSTOM_TABS_COLLECTION].find_one({"_id": doc["_id"]})
    assert refreshed is not None
    return _to_out(refreshed)


async def delete_tab(db: AsyncIOMotorDatabase, slug: str) -> None:
    """Delete a custom tab and section documents for its owning market only.

    Args:
        db: Database connection.
        slug: Tab slug to remove.

    Raises:
        NotFoundError: When the slug is unknown.
    """

    normalized = slug.strip().lower()
    doc = await db[CUSTOM_TABS_COLLECTION].find_one({"slug": normalized})
    if doc is None:
        raise NotFoundError(f"Custom tab not found: {normalized}")

    market_code = str(doc.get("market_code") or "").strip().lower()
    market = await get_market_by_code(db, market_code) if market_code else None
    await db[CUSTOM_TABS_COLLECTION].delete_one({"_id": doc["_id"]})
    if market is not None:
        await db[CUSTOM_PAGE_SECTIONS_COLLECTION].delete_many(
            {
                "page_name": normalized,
                "market_id": str(market["_id"]),
            },
        )
    else:
        await db[CUSTOM_PAGE_SECTIONS_COLLECTION].delete_many({"page_name": normalized})
    logger.info("Deleted custom tab %s for market %s", normalized, market_code)
