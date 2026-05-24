"""Search service using MongoDB text index on articles."""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.services.article_service import _to_article_out
from shared.core.pagination import PaginationParams
from shared.read.loaders import AuthorNameLoader
from shared.schemas.article_schemas import ArticleOut

ARTICLES_COLLECTION = "articles"


async def search_articles(
    db: AsyncIOMotorDatabase,
    *,
    query: str,
    pagination: PaginationParams,
) -> tuple[list[ArticleOut], int]:
    """Search articles by text query."""

    filter_doc = {"$text": {"$search": query}}
    total = await db[ARTICLES_COLLECTION].count_documents(filter_doc)
    cursor = (
        db[ARTICLES_COLLECTION]
        .find(filter_doc, {"score": {"$meta": "textScore"}})
        .sort([("score", {"$meta": "textScore"})])
        .skip(pagination.skip)
        .limit(pagination.page_size)
    )
    docs = [doc async for doc in cursor]
    loader = AuthorNameLoader(db)
    await loader.load_many([str(doc["author_id"]) for doc in docs])
    items = [
        _to_article_out(doc, author_name=await loader.load(str(doc["author_id"])))
        for doc in docs
    ]
    return items, total
