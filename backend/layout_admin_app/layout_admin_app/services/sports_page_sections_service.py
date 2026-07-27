"""Per-market sports page section list CRUD and sports layout sync."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import NotFoundError, ValidationError
from shared.core.logger import get_logger
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


def _to_out(
    *,
    market_id: str,
    market_code: str,
    items: list[dict[str, str]],
    updated_at: str,
) -> SportsPageSectionsOut:
    """Map stored config to API response."""

    return SportsPageSectionsOut(
        market_id=market_id,
        market_code=market_code,
        items=[SportsPageSectionItemOut(slug=i["slug"], label=i["label"]) for i in items],
        updated_at=updated_at,
    )


async def get_for_market(db: AsyncIOMotorDatabase, market_code: str) -> SportsPageSectionsOut:
    """Return the sports section list for a market code."""

    market = await _resolve_market(db, market_code)
    market_id = str(market["_id"])
    doc = await db[SPORTS_PAGE_SECTIONS_COLLECTION].find_one({"market_id": market_id})
    if doc is None:
        return _to_out(
            market_id=market_id,
            market_code=str(market["code"]),
            items=[],
            updated_at=utc_now().isoformat(),
        )
    return _to_out(
        market_id=market_id,
        market_code=str(market["code"]),
        items=list(doc.get("items") or []),
        updated_at=str(doc.get("updated_at") or utc_now().isoformat()),
    )


async def replace_for_market(
    db: AsyncIOMotorDatabase,
    market_code: str,
    body: SportsPageSectionsUpdate,
) -> SportsPageSectionsOut:
    """Replace the sports section list and sync the sports layout."""

    market = await _resolve_market(db, market_code)
    market_id = str(market["_id"])
    items = _normalize_items(body.items)
    now = utc_now().isoformat()
    await db[SPORTS_PAGE_SECTIONS_COLLECTION].update_one(
        {"market_id": market_id},
        {
            "$set": {"items": items, "updated_at": now},
            "$setOnInsert": {"_id": str(uuid4()), "market_id": market_id},
        },
        upsert=True,
    )
    await sync_sports_layout_slots(db, market_id=market_id, items=items)
    logger.info("Updated sports page sections for market %s (%d items)", market_code, len(items))
    return _to_out(
        market_id=market_id,
        market_code=str(market["code"]),
        items=items,
        updated_at=now,
    )
