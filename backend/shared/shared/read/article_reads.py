"""Published article read operations."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import NotFoundError
from shared.core.pagination import PaginationParams
from shared.read.collections import ARTICLES_COLLECTION, CATEGORIES_COLLECTION
from shared.read.loaders import AuthorNameLoader
from shared.schemas.article_schemas import (
    DEFAULT_MAX_IMAGE_COUNT,
    STORY_GROUPS_LIMIT,
    STORY_UPDATES_LIMIT,
    ArticleDetailOut,
    ArticleOut,
    StoryGroupOut,
)
from shared.schemas.common import PaginatedResponse

SEARCH_RESULTS_LIMIT = 50
PUBLISHED_IDS_LOOKUP_LIMIT = 50


def article_out(doc: dict[str, Any], *, author_name: str) -> ArticleOut:
    """Map a Mongo article document to ArticleOut."""

    return ArticleOut(
        id=str(doc["_id"]),
        title=doc["title"],
        slug=doc["slug"],
        status=doc["status"],
        author_name=author_name,
        thumbnail_url=doc.get("thumbnail_url"),
        video_url=doc.get("video_url"),
        category_ids=_category_ids_from_doc(doc),
        created_at=doc.get("created_at", ""),
        published_at=doc.get("published_at"),
        review_submitted_at=doc.get("review_submitted_at"),
    )


def article_detail_out(doc: dict[str, Any], *, author_name: str) -> ArticleDetailOut:
    """Map a Mongo article document to ArticleDetailOut."""

    base = article_out(doc, author_name=author_name)
    return ArticleDetailOut(
        **base.model_dump(),
        body=str(doc.get("body") or ""),
        tags=list(doc.get("tags") or []),
        category_id=doc.get("category_id"),
        story_id=doc.get("story_id"),
        international_potential=doc.get("international_potential"),
        market_ids=[str(mid) for mid in (doc.get("market_ids") or [])],
        media_ids=list(doc.get("media_ids") or []),
        max_image_count=int(doc.get("max_image_count") or DEFAULT_MAX_IMAGE_COUNT),
        view_count=int(doc.get("view_count") or 0),
    )


def _category_ids_from_doc(doc: dict[str, Any]) -> list[str]:
    """Return the article's category ids, falling back to the legacy single id.

    Older articles only persist ``category_id``; newer articles persist a
    ``category_ids`` list. This normalizes both shapes into one list.

    Args:
        doc: Raw article document.

    Returns:
        Ordered, de-duplicated category id list.
    """

    raw_ids = [str(cid) for cid in (doc.get("category_ids") or []) if str(cid).strip()]
    primary = doc.get("category_id")
    if primary and str(primary) not in raw_ids:
        raw_ids.insert(0, str(primary))
    return raw_ids


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
    # Match both legacy single-category articles and multi-category articles
    # that include this category in their category_ids list.
    query: dict[str, Any] = {
        "status": "published",
        "$or": [{"category_id": category_id}, {"category_ids": category_id}],
    }
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


async def list_story_updates(
    db: AsyncIOMotorDatabase,
    *,
    story_id: str,
    exclude_id: str,
    market_id: str | None = None,
    loader: AuthorNameLoader | None = None,
    limit: int = STORY_UPDATES_LIMIT,
) -> list[ArticleDetailOut]:
    """List other published articles in the same story, newest-first.

    Args:
        db: Database connection.
        story_id: Shared story grouping id assigned by editors.
        exclude_id: Article id to omit (the one the reader is viewing).
        market_id: Optional market scope to keep follow-ups in the same market.
        loader: Optional author name loader.
        limit: Maximum number of follow-ups to return.

    Returns:
        Story follow-up articles ordered newest-first.
    """

    query: dict[str, Any] = {
        "status": "published",
        "story_id": story_id,
        "_id": {"$ne": exclude_id},
    }
    if market_id:
        query["market_ids"] = market_id
    cursor = (
        db[ARTICLES_COLLECTION].find(query).sort("published_at", -1).limit(limit)
    )
    docs = [d async for d in cursor]
    names = loader or AuthorNameLoader(db)
    await names.load_many([str(d["author_id"]) for d in docs])

    items: list[ArticleDetailOut] = []
    for doc in docs:
        author = await names.load(str(doc["author_id"]))
        items.append(article_detail_out(doc, author_name=author))
    return items


async def list_story_groups(
    db: AsyncIOMotorDatabase,
    *,
    limit: int = STORY_GROUPS_LIMIT,
) -> list[StoryGroupOut]:
    """List distinct editor-assigned story groups with their article counts.

    Spans every article status because editors group drafts before publishing.
    Articles without a story id (None or empty string) are excluded so the
    combobox only surfaces real groups.

    Args:
        db: Database connection.
        limit: Maximum number of groups to return.

    Returns:
        Story groups ordered by article count (largest first), then by id.
    """

    # Sort by updated_at before grouping so the most recently edited article in
    # each group provides the representative sample_title.
    pipeline = [
        {"$match": {"story_id": {"$nin": [None, ""]}}},
        {"$sort": {"updated_at": -1}},
        {
            "$group": {
                "_id": "$story_id",
                "article_count": {"$sum": 1},
                "sample_title": {"$first": "$title"},
            }
        },
        {"$sort": {"article_count": -1, "_id": 1}},
        {"$limit": limit},
    ]
    cursor = db[ARTICLES_COLLECTION].aggregate(pipeline)
    return [
        StoryGroupOut(
            id=str(row["_id"]),
            article_count=int(row["article_count"]),
            sample_title=str(row.get("sample_title") or ""),
        )
        async for row in cursor
    ]


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
        .limit(SEARCH_RESULTS_LIMIT)
    )
    docs = [d async for d in cursor]
    names = loader or AuthorNameLoader(db)
    await names.load_many([str(d["author_id"]) for d in docs])

    items: list[ArticleOut] = []
    for doc in docs:
        author = await names.load(str(doc["author_id"]))
        items.append(article_out(doc, author_name=author))
    return items


PREVIEWABLE_STATUSES = ("draft", "review", "published")


async def list_by_ids_for_preview(
    db: AsyncIOMotorDatabase,
    *,
    article_ids: list[str],
    market_id: str | None = None,
    town: str | None = None,
    loader: AuthorNameLoader | None = None,
    require_market: bool = True,
) -> list[ArticleOut]:
    """Load draft, review, or published articles by id list for editor preview.

    Args:
        db: Database connection.
        article_ids: Ordered article ids to resolve.
        market_id: Optional market scope.
        town: Optional town scope.
        loader: Optional author name loader.
        require_market: When False, pinned editorial ids resolve even if the
            article is not tagged for the active market.

    Returns:
        Previewable articles in the same order as the requested ids.
    """

    if not article_ids:
        return []

    q: dict[str, Any] = {
        "_id": {"$in": article_ids},
        "status": {"$in": list(PREVIEWABLE_STATUSES)},
    }
    if market_id and require_market:
        q["market_ids"] = market_id
    if town:
        q["town_id"] = town.strip()
    cursor = db[ARTICLES_COLLECTION].find(q).limit(PUBLISHED_IDS_LOOKUP_LIMIT)
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


async def list_published_by_ids(
    db: AsyncIOMotorDatabase,
    *,
    article_ids: list[str],
    market_id: str | None = None,
    town: str | None = None,
    loader: AuthorNameLoader | None = None,
    require_market: bool = True,
) -> list[ArticleOut]:
    """Load published articles by id list, preserving input order where possible.

    Args:
        db: Database connection.
        article_ids: Ordered article ids to resolve.
        market_id: Optional market scope for query-fill reads.
        town: Optional town scope.
        loader: Optional author name loader.
        require_market: When False, pinned editorial ids resolve even if the
            article is not tagged for the active market.

    Returns:
        Published articles in the same order as the requested ids.
    """

    if not article_ids:
        return []

    q: dict[str, Any] = {"_id": {"$in": article_ids}, "status": "published"}
    if market_id and require_market:
        q["market_ids"] = market_id
    if town:
        q["town_id"] = town.strip()
    cursor = db[ARTICLES_COLLECTION].find(q).limit(PUBLISHED_IDS_LOOKUP_LIMIT)
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
