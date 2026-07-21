"""Search service for editor article lookup.

Supports a single-field title/slug substring search plus optional structured
filters (category, created-date range, market/region) combined with AND. An
exact article-id lookup overrides every other filter and matches across all
statuses.
"""

from __future__ import annotations

import re
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.pagination import PaginationParams
from shared.core.regions import (
    get_region_by_code,
    legacy_market_scope_article_filter,
    region_ids_under_same_country,
    region_scope_article_filter,
    resolve_region_code_from_legacy,
)
from shared.read.article_reads import article_out
from shared.read.collections import ARTICLES_COLLECTION
from shared.read.loaders import AuthorNameLoader
from shared.read.market_reads import get_market_by_code
from shared.schemas.article_schemas import ArticleOut

# A bare date (YYYY-MM-DD) needs widening to the end of the day so a created_to
# filter is inclusive against full ISO-8601 created_at timestamps.
_DATE_ONLY_LENGTH = 10
_END_OF_DAY_SUFFIX = "T23:59:59.999999+00:00"


def _build_title_slug_filter(query: str) -> dict[str, Any]:
    """Build a case-insensitive title/slug substring filter.

    Args:
        query: Raw search text from the client.

    Returns:
        MongoDB filter matching title or slug substrings, or empty when blank.
    """

    escaped = re.escape(query.strip())
    if not escaped:
        return {}
    return {
        "$or": [
            {"title": {"$regex": escaped, "$options": "i"}},
            {"slug": {"$regex": escaped, "$options": "i"}},
        ]
    }


def _build_created_at_filter(created_from: str | None, created_to: str | None) -> dict[str, Any]:
    """Build a created_at range filter from inclusive from/to date bounds.

    Args:
        created_from: Inclusive lower bound (date or ISO timestamp).
        created_to: Inclusive upper bound (date or ISO timestamp).

    Returns:
        A ``{"created_at": {...}}`` filter, or empty when no bounds are given.
    """

    bounds: dict[str, str] = {}
    if created_from and created_from.strip():
        bounds["$gte"] = created_from.strip()
    if created_to and created_to.strip():
        upper = created_to.strip()
        # Widen a bare date so the whole day is included in the range.
        if len(upper) == _DATE_ONLY_LENGTH:
            upper = f"{upper}{_END_OF_DAY_SUFFIX}"
        bounds["$lte"] = upper
    return {"created_at": bounds} if bounds else {}


def _build_legacy_location_filter(
    *,
    market_id: str | None,
    town: str | None,
) -> dict[str, Any]:
    """Build a legacy market_ids / town_id location filter.

    Args:
        market_id: Resolved market document id, if any.
        town: Optional town/state locality code.

    Returns:
        A MongoDB filter for legacy location fields, or empty when unused.
    """

    if not market_id:
        return {}
    return legacy_market_scope_article_filter(market_id, town=town)


def _build_location_filter(
    *,
    region_scope_ids: list[str] | None,
    market_id: str | None,
    town: str | None,
) -> dict[str, Any]:
    """Build a location filter preferring region ids with a legacy fallback.

    Args:
        region_scope_ids: Country-wide placement scope ids for the active region.
        market_id: Resolved market document id for legacy articles.
        town: Optional town/state locality code for legacy articles.

    Returns:
        A MongoDB filter matching region or legacy location fields, or empty.
    """

    legacy = _build_legacy_location_filter(market_id=market_id, town=town)
    if region_scope_ids:
        region_clause = region_scope_article_filter(region_scope_ids, market_id=market_id)
        if legacy:
            # region_clause already includes market_ids when market_id is set.
            return region_clause
        return region_clause
    return legacy


def _build_search_filter(
    *,
    query: str | None,
    category_id: str | None,
    created_from: str | None,
    created_to: str | None,
    region_scope_ids: list[str] | None = None,
    market_id: str | None = None,
    town: str | None = None,
) -> dict[str, Any]:
    """Combine the title/slug, category, date, and location filters with AND.

    Args:
        query: Title/slug substring text.
        category_id: Category id to match against legacy or multi-category fields.
        created_from: Inclusive created-date lower bound.
        created_to: Inclusive created-date upper bound.
        region_scope_ids: Optional country-wide placement scope ids.
        market_id: Optional market id for legacy market_ids matching.
        town: Optional town/state code for legacy town_id matching.

    Returns:
        A MongoDB filter document (empty when no filters are supplied).
    """

    clauses: list[dict[str, Any]] = []
    if query:
        title_slug = _build_title_slug_filter(query)
        if title_slug:
            clauses.append(title_slug)
    if category_id and category_id.strip():
        cid = category_id.strip()
        clauses.append({"$or": [{"category_id": cid}, {"category_ids": cid}]})
    created_filter = _build_created_at_filter(created_from, created_to)
    if created_filter:
        clauses.append(created_filter)
    location_filter = _build_location_filter(
        region_scope_ids=region_scope_ids,
        market_id=market_id,
        town=town,
    )
    if location_filter:
        clauses.append(location_filter)

    if not clauses:
        return {}
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


async def _resolve_search_location(
    db: AsyncIOMotorDatabase,
    *,
    market: str | None,
    town: str | None,
    region_code: str | None,
) -> tuple[str | None, str | None, list[str]]:
    """Resolve market/town/region_code into region and market document ids.

    Args:
        db: Database connection.
        market: Market code such as ``us``.
        town: Optional town/state locality code.
        region_code: Optional canonical region code.

    Returns:
        A ``(region_id, market_id, region_scope_ids)`` tuple; values may be empty.
    """

    normalized_market = (market or "").strip().lower() or None
    normalized_town = (town or "").strip().lower() or None
    requested_region_code = (region_code or "").strip().lower() or None

    market_id: str | None = None
    if normalized_market:
        market_doc = await get_market_by_code(db, normalized_market)
        if market_doc is not None:
            market_id = str(market_doc["_id"])

    if not requested_region_code and normalized_market:
        requested_region_code = await resolve_region_code_from_legacy(
            db,
            market_code=normalized_market,
            town=normalized_town,
        )

    region_id: str | None = None
    region_scope_ids: list[str] = []
    if requested_region_code:
        region_doc = await get_region_by_code(db, requested_region_code)
        if region_doc is not None:
            region_id = str(region_doc["_id"])
            region_scope_ids = await region_ids_under_same_country(db, region_id)

    return region_id, market_id, region_scope_ids


async def _items_from_docs(
    db: AsyncIOMotorDatabase, docs: list[dict[str, Any]]
) -> list[ArticleOut]:
    """Resolve author names and map raw article docs to ArticleOut rows."""

    loader = AuthorNameLoader(db)
    await loader.load_many([str(doc["author_id"]) for doc in docs])
    return [
        article_out(doc, author_name=await loader.load(str(doc["author_id"])))
        for doc in docs
    ]


async def _search_by_article_id(
    db: AsyncIOMotorDatabase, article_id: str
) -> tuple[list[ArticleOut], int]:
    """Resolve a single article by exact id across all statuses."""

    doc = await db[ARTICLES_COLLECTION].find_one({"_id": article_id.strip()})
    if doc is None:
        return [], 0
    items = await _items_from_docs(db, [doc])
    return items, 1


async def search_articles(
    db: AsyncIOMotorDatabase,
    *,
    query: str | None = None,
    category_id: str | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
    article_id: str | None = None,
    market: str | None = None,
    town: str | None = None,
    region_code: str | None = None,
    pagination: PaginationParams,
) -> tuple[list[ArticleOut], int]:
    """Search articles by title/slug, category, created-date range, and location.

    A non-empty ``article_id`` short-circuits to an exact, all-status lookup and
    ignores every other filter. Otherwise filters combine with AND, sorted by
    ``created_at`` descending.

    Args:
        db: Database connection.
        query: Title/slug substring text.
        category_id: Category id to match.
        created_from: Inclusive created-date lower bound.
        created_to: Inclusive created-date upper bound.
        article_id: Exact article id override.
        market: Optional market code (country) filter.
        town: Optional town/state locality filter.
        region_code: Optional canonical region code filter.
        pagination: Page/size parameters.

    Returns:
        A tuple of the matching article rows and the total match count.
    """

    if article_id and article_id.strip():
        return await _search_by_article_id(db, article_id)

    region_id, market_id, region_scope_ids = await _resolve_search_location(
        db,
        market=market,
        town=town,
        region_code=region_code,
    )

    filter_doc = _build_search_filter(
        query=query,
        category_id=category_id,
        created_from=created_from,
        created_to=created_to,
        region_scope_ids=region_scope_ids,
        market_id=market_id,
        town=town,
    )
    total = await db[ARTICLES_COLLECTION].count_documents(filter_doc)
    cursor = (
        db[ARTICLES_COLLECTION]
        .find(filter_doc)
        .sort("created_at", -1)
        .skip(pagination.skip)
        .limit(pagination.page_size)
    )
    docs = [doc async for doc in cursor]
    items = await _items_from_docs(db, docs)
    return items, total
