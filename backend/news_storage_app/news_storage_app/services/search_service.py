"""Search service for editor article lookup by title or slug."""

from __future__ import annotations

import re
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.pagination import PaginationParams
from shared.read.article_reads import article_out
from shared.read.collections import ARTICLES_COLLECTION
from shared.read.loaders import AuthorNameLoader
from shared.schemas.article_schemas import ArticleOut


def _build_title_slug_filter(query: str) -> dict[str, Any]:
    """Build a case-insensitive title/slug substring filter.

    Args:
        query: Raw search text from the client.

    Returns:
        MongoDB filter matching title or slug substrings.
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


async def search_articles(
    db: AsyncIOMotorDatabase,
    *,
    query: str,
    pagination: PaginationParams,
) -> tuple[list[ArticleOut], int]:
    """Search articles by title or slug substring."""

    filter_doc = _build_title_slug_filter(query)
    total = await db[ARTICLES_COLLECTION].count_documents(filter_doc)
    cursor = (
        db[ARTICLES_COLLECTION]
        .find(filter_doc)
        .sort("created_at", -1)
        .skip(pagination.skip)
        .limit(pagination.page_size)
    )
    docs = [doc async for doc in cursor]
    loader = AuthorNameLoader(db)
    await loader.load_many([str(doc["author_id"]) for doc in docs])
    items = [
        article_out(doc, author_name=await loader.load(str(doc["author_id"])))
        for doc in docs
    ]
    return items, total
