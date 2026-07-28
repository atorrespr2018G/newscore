"""Per-market / per-region sports page section list CRUD and layout sync."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import NotFoundError, ValidationError
from shared.core.logger import get_logger
from shared.core.regions import get_region_by_code
from shared.core.sports_page_sections_sync import (
    PRESERVED_SPORTS_PAGE_KEYS,
    slugify_sport_label,
    sync_sports_layout_slots,
)
from shared.models.common import utc_now
from shared.read.collections import SPORTS_PAGE_SECTIONS_COLLECTION
from shared.read.market_reads import get_market_by_code
from shared.schemas.sports_page_sections_schemas import (
    SportsPageSectionItemIn,
    SportsPageSectionItemOut,
    SportsPageSectionsOut,
    SportsPageSectionsUpdate,
)

logger = get_logger(__name__)

_SLUG_SAFE_RE = re.compile(r"[^a-z0-9]+")


def _normalize_slug(value: str) -> str:
    """Normalize an explicit slug, preserving hyphenated sport keys."""

    normalized = _SLUG_SAFE_RE.sub("-", value.strip().lower()).strip("-")
    if not normalized:
        raise ValidationError("Sport slug must contain letters or numbers")
    return normalized


def _normalize_items(items: list[SportsPageSectionItemIn]) -> list[dict[str, str]]:
    """Normalize incoming items to unique slug/label pairs in order."""

    resolved: list[dict[str, str]] = []
    seen_slugs: set[str] = set()
    for item in items:
        label = item.label.strip()
        if not label:
            raise ValidationError("Sport label cannot be empty")
        slug = _normalize_slug(item.slug) if item.slug else slugify_sport_label(label)
        if slug in PRESERVED_SPORTS_PAGE_KEYS:
            raise ValidationError(f"Sport slug '{slug}' is reserved")
        if slug in seen_slugs:
            raise ValidationError(f"Duplicate sport slug: {slug}")
        seen_slugs.add(slug)
        resolved.append({"slug": slug, "label": label})
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
    """Build the unique-scope filter for a sports sections document."""

    if region_id is not None:
        return {"market_id": market_id, "region_id": region_id}
    # Match explicit null and legacy docs that omit region_id.
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
    now: str,
) -> None:
    """Insert or replace the sports sections document for one scope."""

    query = _sections_query(market_id=market_id, region_id=region_id)
    existing = await db[SPORTS_PAGE_SECTIONS_COLLECTION].find_one(query, {"_id": 1})
    if existing is not None:
        await db[SPORTS_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": {"items": items, "updated_at": now, "region_id": region_id}},
        )
        return

    await db[SPORTS_PAGE_SECTIONS_COLLECTION].insert_one(
        {
            "_id": str(uuid4()),
            "market_id": market_id,
            "region_id": region_id,
            "items": items,
            "updated_at": now,
        },
    )


def _to_out(
    *,
    market_id: str,
    market_code: str,
    items: list[dict[str, str]],
    updated_at: str,
    region_id: str | None = None,
    region_code: str | None = None,
) -> SportsPageSectionsOut:
    """Map stored config to API response."""

    return SportsPageSectionsOut(
        market_id=market_id,
        market_code=market_code,
        region_id=region_id,
        region_code=region_code,
        items=[SportsPageSectionItemOut(slug=i["slug"], label=i["label"]) for i in items],
        updated_at=updated_at,
    )


async def get_for_market(
    db: AsyncIOMotorDatabase,
    market_code: str,
    *,
    region_code: str | None = None,
) -> SportsPageSectionsOut:
    """Return the sports section list for a market and optional region."""

    market = await _resolve_market(db, market_code)
    market_id = str(market["_id"])
    region_id, normalized_region = await _resolve_region_scope(
        db,
        market_code=market_code,
        region_code=region_code,
    )
    doc = await db[SPORTS_PAGE_SECTIONS_COLLECTION].find_one(
        _sections_query(market_id=market_id, region_id=region_id),
    )
    if doc is None:
        return _to_out(
            market_id=market_id,
            market_code=str(market["code"]),
            region_id=region_id,
            region_code=normalized_region,
            items=[],
            updated_at=utc_now().isoformat(),
        )
    return _to_out(
        market_id=market_id,
        market_code=str(market["code"]),
        region_id=region_id,
        region_code=normalized_region,
        items=list(doc.get("items") or []),
        updated_at=str(doc.get("updated_at") or utc_now().isoformat()),
    )


async def replace_for_market(
    db: AsyncIOMotorDatabase,
    market_code: str,
    body: SportsPageSectionsUpdate,
    *,
    region_code: str | None = None,
) -> SportsPageSectionsOut:
    """Replace the sports section list and sync the matching sports layout."""

    market = await _resolve_market(db, market_code)
    market_id = str(market["_id"])
    region_id, normalized_region = await _resolve_region_scope(
        db,
        market_code=market_code,
        region_code=region_code,
    )
    items = _normalize_items(body.items)
    now = utc_now().isoformat()
    await _upsert_sections_doc(
        db,
        market_id=market_id,
        region_id=region_id,
        items=items,
        now=now,
    )
    await sync_sports_layout_slots(
        db,
        market_id=market_id,
        items=items,
        region_id=region_id,
    )
    logger.info(
        "Updated sports page sections for market %s region %s (%d items)",
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
        updated_at=now,
    )
