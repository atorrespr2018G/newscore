"""Search service for editor article lookup.

Supports a single-field title/slug substring search plus optional structured
filters (category, created-date range) combined with AND. An exact article-id
lookup overrides every other filter and matches across all statuses.
"""

from __future__ import annotations

import re
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.pagination import PaginationParams
from shared.read.article_reads import article_out
from shared.read.collections import ARTICLES_COLLECTION
from shared.read.loaders import AuthorNameLoader
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


def _build_search_filter(
    *,
    query: str | None,
    category_id: str | None,
    created_from: str | None,
    created_to: str | None,
) -> dict[str, Any]:
    """Combine the title/slug, category, and date filters with AND.

    Args:
        query: Title/slug substring text.
        category_id: Category id to match against legacy or multi-category fields.
        created_from: Inclusive created-date lower bound.
        created_to: Inclusive created-date upper bound.

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

    if not clauses:
        return {}
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


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
    pagination: PaginationParams,
) -> tuple[list[ArticleOut], int]:
    """Search articles by title/slug, category, and created-date range.

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
        pagination: Page/size parameters.

    Returns:
        A tuple of the matching article rows and the total match count.
    """

    if article_id and article_id.strip():
        return await _search_by_article_id(db, article_id)

    filter_doc = _build_search_filter(
        query=query,
        category_id=category_id,
        created_from=created_from,
        created_to=created_to,
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
