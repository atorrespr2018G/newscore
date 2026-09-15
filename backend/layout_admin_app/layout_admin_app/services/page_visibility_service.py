"""CRUD for geo-scoped landing page enablement."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.cache_invalidation import (
    invalidate_homepage_for_market_ids,
    invalidate_homepage_for_region_ids,
)
from shared.core.events import publish_homepage_feed_invalidation
from shared.core.exceptions import NotFoundError, ValidationError
from shared.core.logger import get_logger
from shared.core.page_ad_placements import PAGE_NAME_HOMEPAGE
from shared.core.page_visibility import (
    IS_ENABLED_FIELD,
    PageVisibility,
    descendant_region_codes,
    docs_for_page,
    load_visibility_docs,
    normalize_page_name,
    visibility_chain,
    visibility_from_chain,
)
from shared.core.regions import get_region_by_code
from shared.models.common import utc_now
from shared.read.collections import PAGE_VISIBILITY_COLLECTION
from shared.read.market_reads import get_market_by_code
from shared.schemas.page_visibility_schemas import PageVisibilityOut, PageVisibilityUpdate

logger = get_logger(__name__)

_PAGE_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _validate_page_name(page_name: str) -> str:
    """Normalize and reject page names that cannot be disabled.

    Args:
        page_name: Raw layout page name.

    Returns:
        Normalized page name.

    Raises:
        ValidationError: When the name is empty, homepage, or not a slug.
    """

    normalized = normalize_page_name(page_name)
    if not normalized:
        raise ValidationError("Page name is required")
    if normalized == PAGE_NAME_HOMEPAGE:
        raise ValidationError("The main page cannot be disabled")
    if not _PAGE_SLUG_RE.fullmatch(normalized):
        raise ValidationError("Page name must be a lowercase slug")
    return normalized


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
    """Resolve optional region code to (region_id, normalized region_code)."""

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


def _sections_query(*, market_id: str, region_id: str | None, page_name: str) -> dict[str, Any]:
    """Unique-scope filter for one page-visibility document."""

    query: dict[str, Any] = {"market_id": market_id, "page_name": page_name}
    if region_id is not None:
        query["region_id"] = region_id
        return query
    query["$or"] = [{"region_id": None}, {"region_id": {"$exists": False}}]
    return query


def _to_out(
    *,
    page_name: str,
    market_id: str,
    market_code: str,
    region_id: str | None,
    region_code: str | None,
    visibility: PageVisibility,
    updated_at: str,
) -> PageVisibilityOut:
    """Map resolved flags to the API payload."""

    return PageVisibilityOut(
        page_name=page_name,
        market_id=market_id,
        market_code=market_code,
        region_id=region_id,
        region_code=region_code,
        is_enabled=visibility.local_enabled,
        is_effectively_enabled=visibility.effectively_enabled,
        disabled_by_region_code=visibility.disabled_by_region_code,
        inherited=visibility.inherited,
        updated_at=updated_at,
    )


async def _invalidate_visibility_feeds(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    region_id: str | None,
) -> None:
    """Invalidate public feeds for this geo and every nested locality."""

    if not region_id:
        await invalidate_homepage_for_market_ids(db, [market_id])
        return
    codes = await descendant_region_codes(db, region_id)
    if not codes:
        await invalidate_homepage_for_region_ids(db, [region_id])
        return
    await publish_homepage_feed_invalidation(region_codes=codes)


async def get_for_scope(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str,
    page_name: str,
    region_code: str | None = None,
) -> PageVisibilityOut:
    """Return enablement for one page at the selected geo."""

    normalized_page = _validate_page_name(page_name)
    market = await _resolve_market(db, market_code)
    market_id = str(market["_id"])
    region_id, normalized_region = await _resolve_region_scope(
        db,
        market_code=market_code,
        region_code=region_code,
    )
    chain = await visibility_chain(
        db,
        region_id=region_id,
        market_code=str(market["code"]),
    )
    docs = await load_visibility_docs(
        db,
        market_id=market_id,
        chain_ids=[scope[0] for scope in chain],
    )
    visibility = visibility_from_chain(
        docs_by_scope=docs_for_page(docs, normalized_page),
        chain_scopes=chain,
    )
    local_doc = docs_for_page(docs, normalized_page).get(region_id)
    updated_at = str((local_doc or {}).get("updated_at") or utc_now().isoformat())
    return _to_out(
        page_name=normalized_page,
        market_id=market_id,
        market_code=str(market["code"]),
        region_id=region_id,
        region_code=normalized_region,
        visibility=visibility,
        updated_at=updated_at,
    )


async def replace_for_scope(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str,
    page_name: str,
    body: PageVisibilityUpdate,
    region_code: str | None = None,
) -> PageVisibilityOut:
    """Persist the local enable flag for this geo and invalidate nested feeds."""

    normalized_page = _validate_page_name(page_name)
    market = await _resolve_market(db, market_code)
    market_id = str(market["_id"])
    region_id, normalized_region = await _resolve_region_scope(
        db,
        market_code=market_code,
        region_code=region_code,
    )
    now = utc_now().isoformat()
    query = _sections_query(
        market_id=market_id,
        region_id=region_id,
        page_name=normalized_page,
    )
    existing = await db[PAGE_VISIBILITY_COLLECTION].find_one(query, {"_id": 1})
    payload = {
        "page_name": normalized_page,
        "market_id": market_id,
        "region_id": region_id,
        IS_ENABLED_FIELD: bool(body.is_enabled),
        "updated_at": now,
    }
    if existing is not None:
        await db[PAGE_VISIBILITY_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": payload},
        )
    else:
        await db[PAGE_VISIBILITY_COLLECTION].insert_one({"_id": str(uuid4()), **payload})
    await _invalidate_visibility_feeds(db, market_id=market_id, region_id=region_id)
    logger.info(
        "Updated page visibility page=%s market=%s region=%s enabled=%s",
        normalized_page,
        market_code,
        normalized_region,
        body.is_enabled,
    )
    return await get_for_scope(
        db,
        market_code=market_code,
        page_name=normalized_page,
        region_code=region_code,
    )
