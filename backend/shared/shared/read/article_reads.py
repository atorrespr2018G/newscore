"""Published article read operations."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import NotFoundError
from shared.core.pagination import PaginationParams
from shared.read.collections import ARTICLES_COLLECTION, CATEGORIES_COLLECTION
from shared.read.loaders import AuthorNameLoader
from shared.schemas.article_schemas import ArticleDetailOut, ArticleOut
from shared.schemas.common import PaginatedResponse


def article_out(doc: dict[str, Any], *, author_name: str) -> ArticleOut:
    """Map a Mongo article document to ArticleOut."""

    return ArticleOut(
        id=str(doc["_id"]),
        title=doc["title"],
        slug=doc["slug"],
        status=doc["status"],
        author_name=author_name,
        thumbnail_url=doc.get("thumbnail_url"),
        created_at=doc.get("created_at", ""),
        published_at=doc.get("published_at"),
    )


def article_detail_out(doc: dict[str, Any], *, author_name: str) -> ArticleDetailOut:
    """Map a Mongo article document to ArticleDetailOut."""

    base = article_out(doc, author_name=author_name)
    return ArticleDetailOut(
        **base.model_dump(),
        body=str(doc.get("body") or ""),
        tags=list(doc.get("tags") or []),
        category_id=doc.get("category_id"),
        media_ids=list(doc.get("media_ids") or []),
        view_count=int(doc.get("view_count") or 0),
    )


async def get_article_by_id(
    db: AsyncIOMotorDatabase,
    *,
    article_id: str,
    loader: AuthorNameLoader | None = None,
) -> ArticleDetailOut | None:
    """Load a published article by id."""

    doc = await db[ARTICLES_COLLECTION].find_one({"_id": article_id, "status": "published"})
    if doc is None:
        return None
    names = loader or AuthorNameLoader(db)
    author = await names.load(str(doc["author_id"]))
    return article_detail_out(doc, author_name=author)


async def get_article_by_slug(
    db: AsyncIOMotorDatabase,
    *,
    slug: str,
    market_id: str | None = None,
    loader: AuthorNameLoader | None = None,
) -> ArticleDetailOut:
    """Load a published article by slug, optionally scoped to a market."""

    q: dict[str, Any] = {"slug": slug, "status": "published"}
    if market_id:
        q["market_ids"] = market_id
    doc = await db[ARTICLES_COLLECTION].find_one(q)
    if doc is None:
        raise NotFoundError("Article not found")
    names = loader or AuthorNameLoader(db)
    author = await names.load(str(doc["author_id"]))
    return article_detail_out(doc, author_name=author)


async def list_category_articles(
    db: AsyncIOMotorDatabase,
    *,
    category_slug: str,
    params: PaginationParams,
    market_id: str | None = None,
    loader: AuthorNameLoader | None = None,
) -> PaginatedResponse:
    """List published articles for a category slug."""

    category = await db[CATEGORIES_COLLECTION].find_one({"slug": category_slug})
    if category is None:
        raise NotFoundError("Category not found")

    category_id = str(category["_id"])
    query: dict[str, Any] = {"status": "published", "category_id": category_id}
    if market_id:
        query["market_ids"] = market_id
    total = await db[ARTICLES_COLLECTION].count_documents(query)
    cursor = (
        db[ARTICLES_COLLECTION]
        .find(query)
        .sort("published_at", -1)
        .skip((params.page - 1) * params.page_size)
        .limit(params.page_size)
    )
    docs = [d async for d in cursor]
    names = loader or AuthorNameLoader(db)
    author_ids = [str(d["author_id"]) for d in docs]
    await names.load_many(author_ids)

    items: list[ArticleOut] = []
    for doc in docs:
        author = await names.load(str(doc["author_id"]))
        items.append(article_out(doc, author_name=author))

    return PaginatedResponse(
        items=[i.model_dump() for i in items],
        total=total,
        page=params.page,
        page_size=params.page_size,
        has_more=((params.page - 1) * params.page_size + len(items)) < total,
    )


async def search_published(
    db: AsyncIOMotorDatabase,
    *,
    query: str,
    market_id: str | None = None,
    loader: AuthorNameLoader | None = None,
) -> list[ArticleOut]:
    """Full-text search over published articles."""

    q: dict[str, Any] = {"status": "published", "$text": {"$search": query}}
    if market_id:
        q["market_ids"] = market_id
    cursor = (
        db[ARTICLES_COLLECTION]
        .find(q, {"score": {"$meta": "textScore"}})
        .sort([("score", {"$meta": "textScore"})])
        .limit(50)
    )
    docs = [d async for d in cursor]
    names = loader or AuthorNameLoader(db)
    await names.load_many([str(d["author_id"]) for d in docs])

    items: list[ArticleOut] = []
    for doc in docs:
        author = await names.load(str(doc["author_id"]))
        items.append(article_out(doc, author_name=author))
    return items


async def list_published_by_ids(
    db: AsyncIOMotorDatabase,
    *,
    article_ids: list[str],
    market_id: str | None = None,
    town: str | None = None,
    loader: AuthorNameLoader | None = None,
) -> list[ArticleOut]:
    """Load published articles by id list, preserving input order where possible."""

    if not article_ids:
        return []

    q: dict[str, Any] = {"_id": {"$in": article_ids}, "status": "published"}
    if market_id:
        q["market_ids"] = market_id
    if town:
        q["town_id"] = town.strip()
    cursor = db[ARTICLES_COLLECTION].find(q).limit(50)
    docs = {str(d["_id"]): d async for d in cursor}
    names = loader or AuthorNameLoader(db)
    await names.load_many([str(d["author_id"]) for d in docs.values()])

    items: list[ArticleOut] = []
    for aid in article_ids:
        doc = docs.get(aid)
        if doc is None:
            continue
        author = await names.load(str(doc["author_id"]))
        items.append(article_out(doc, author_name=author))
    return items
