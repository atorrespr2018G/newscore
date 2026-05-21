"""Article lifecycle service (draft/review/publish/archive)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from news_storage_app.helpers.slug_helpers import slugify_title
from shared.core.exceptions import ConflictError, NotFoundError, ValidationError
from shared.schemas.article_schemas import ArticleCreate, ArticleDetailOut, ArticleOut, ArticleUpdate

ARTICLES_COLLECTION = "articles"
USERS_COLLECTION = "users"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _author_name(db: AsyncIOMotorDatabase, author_id: str) -> str:
    user = await db[USERS_COLLECTION].find_one({"_id": author_id}, {"full_name": 1})
    if user is None:
        return "Unknown"
    return str(user.get("full_name") or "Unknown")


def _to_article_out(doc: dict[str, Any], *, author_name: str) -> ArticleOut:
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


def _to_article_detail_out(doc: dict[str, Any], *, author_name: str) -> ArticleDetailOut:
    base = _to_article_out(doc, author_name=author_name)
    return ArticleDetailOut(
        **base.model_dump(),
        body=doc.get("body", ""),
        tags=list(doc.get("tags") or []),
        category_id=doc.get("category_id"),
        media_ids=list(doc.get("media_ids") or []),
        view_count=int(doc.get("view_count") or 0),
    )


async def _ensure_unique_slug(db: AsyncIOMotorDatabase, *, slug: str, exclude_id: str | None = None) -> str:
    candidate = slug
    suffix = 2
    while True:
        query: dict[str, Any] = {"slug": candidate}
        if exclude_id is not None:
            query["_id"] = {"$ne": exclude_id}
        exists = await db[ARTICLES_COLLECTION].find_one(query, {"_id": 1})
        if exists is None:
            return candidate
        candidate = f"{slug}-{suffix}"
        suffix += 1


async def create(db: AsyncIOMotorDatabase, body: ArticleCreate, *, author_id: str) -> ArticleOut:
    """Create a new article draft."""

    base_slug = slugify_title(body.title)
    if not base_slug:
        raise ValidationError("Title cannot produce a slug")
    slug = await _ensure_unique_slug(db, slug=base_slug)

    article_id = str(uuid4())
    now = _utc_now_iso()
    doc: dict[str, Any] = {
        "_id": article_id,
        "title": body.title,
        "slug": slug,
        "body": body.body,
        "status": "draft",
        "author_id": author_id,
        "category_id": body.category_id,
        "tags": body.tags,
        "thumbnail_url": body.thumbnail_url,
        "media_ids": [],
        "view_count": 0,
        "published_at": None,
        "created_at": now,
        "updated_at": now,
    }
    await db[ARTICLES_COLLECTION].insert_one(doc)
    return _to_article_out(doc, author_name=await _author_name(db, author_id))


async def get_by_id(db: AsyncIOMotorDatabase, article_id: str) -> dict[str, Any]:
    doc = await db[ARTICLES_COLLECTION].find_one({"_id": article_id})
    if doc is None:
        raise NotFoundError("Article not found")
    return doc


async def get_detail_by_id(db: AsyncIOMotorDatabase, article_id: str) -> ArticleDetailOut:
    doc = await get_by_id(db, article_id)
    return _to_article_detail_out(doc, author_name=await _author_name(db, str(doc["author_id"])))


async def list_all(db: AsyncIOMotorDatabase) -> list[ArticleOut]:
    cursor = db[ARTICLES_COLLECTION].find({}).sort("created_at", -1)
    items: list[ArticleOut] = []
    async for doc in cursor:
        items.append(_to_article_out(doc, author_name=await _author_name(db, str(doc["author_id"]))))
    return items


async def update(db: AsyncIOMotorDatabase, *, article_id: str, body: ArticleUpdate) -> ArticleDetailOut:
    update_doc: dict[str, Any] = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_doc:
        raise ValidationError("No fields to update")

    if "title" in update_doc:
        base_slug = slugify_title(str(update_doc["title"]))
        if not base_slug:
            raise ValidationError("Title cannot produce a slug")
        update_doc["slug"] = await _ensure_unique_slug(db, slug=base_slug, exclude_id=article_id)

    update_doc["updated_at"] = _utc_now_iso()
    doc = await db[ARTICLES_COLLECTION].find_one_and_update(
        {"_id": article_id},
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise NotFoundError("Article not found")
    return _to_article_detail_out(doc, author_name=await _author_name(db, str(doc["author_id"])))


async def publish(db: AsyncIOMotorDatabase, *, article_id: str) -> ArticleDetailOut:
    doc = await get_by_id(db, article_id)
    if doc["status"] == "archived":
        raise ConflictError("Cannot publish an archived article")

    now = _utc_now_iso()
    updated = await db[ARTICLES_COLLECTION].find_one_and_update(
        {"_id": article_id},
        {"$set": {"status": "published", "published_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise NotFoundError("Article not found")
    return _to_article_detail_out(updated, author_name=await _author_name(db, str(updated["author_id"])))


async def archive(db: AsyncIOMotorDatabase, *, article_id: str) -> ArticleDetailOut:
    now = _utc_now_iso()
    updated = await db[ARTICLES_COLLECTION].find_one_and_update(
        {"_id": article_id},
        {"$set": {"status": "archived", "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise NotFoundError("Article not found")
    return _to_article_detail_out(updated, author_name=await _author_name(db, str(updated["author_id"])))

