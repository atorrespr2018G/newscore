"""Search service using MongoDB text index on articles."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.schemas.article_schemas import ArticleOut
from news_storage_app.services.article_service import _author_name, _to_article_out

ARTICLES_COLLECTION = "articles"


async def search_articles(db: AsyncIOMotorDatabase, *, query: str) -> list[ArticleOut]:
    """Search articles by text query.

    Args:
        db: MongoDB database handle.
        query: Search string.

    Returns:
        Matching articles sorted by textScore.
    """

    cursor = (
        db[ARTICLES_COLLECTION]
        .find({"$text": {"$search": query}}, {"score": {"$meta": "textScore"}})
        .sort([("score", {"$meta": "textScore"})])
        .limit(50)
    )
    items: list[ArticleOut] = []
    async for doc in cursor:
        items.append(_to_article_out(doc, author_name=await _author_name(db, str(doc["author_id"]))))
    return items

