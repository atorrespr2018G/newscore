"""Article lifecycle service (draft/review/publish/archive)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.audit import write_event
from news_storage_app.helpers.slug_helpers import slugify_title
from shared.core.cache_invalidation import invalidate_homepage_for_market_ids
from shared.core.exceptions import ConflictError, NotFoundError, ValidationError
from shared.core.pagination import PaginationParams
from shared.read.article_reads import article_detail_out, article_out
from shared.read.collections import MARKETS_COLLECTION
from shared.read.loaders import AuthorNameLoader
from shared.repositories.article_repository import ArticleRepository
from news_storage_app.services.media_service import MEDIA_COLLECTION
from shared.schemas.article_schemas import (
    DEFAULT_MAX_IMAGE_COUNT,
    ArticleCreate,
    ArticleDetailOut,
    ArticleOut,
    ArticleUpdate,
)

MEDIA_IMAGE_TYPE = "image"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _validate_market_ids(db: AsyncIOMotorDatabase, market_ids: list[str]) -> list[str]:
    if not market_ids:
        raise ValidationError("At least one market_id is required")

    normalized = [str(mid).strip() for mid in market_ids if str(mid).strip()]
    if not normalized:
        raise ValidationError("At least one market_id is required")

    for market_id in normalized:
        exists = await db[MARKETS_COLLECTION].find_one({"_id": market_id}, {"_id": 1})
        if exists is None:
            raise ValidationError(f"Unknown market_id: {market_id}")

    return normalized


def _resolve_max_image_count(existing: dict[str, Any], requested: int | None) -> int:
    """Resolve the effective max image count for an article document."""

    if requested is not None:
        return requested
    stored = existing.get("max_image_count")
    if stored is not None:
        return int(stored)
    return DEFAULT_MAX_IMAGE_COUNT


def _validate_media_ids(
    media_ids: list[str],
    *,
    max_image_count: int,
) -> list[str]:
    """Normalize and validate ordered media ids against the image cap."""

    normalized = [str(media_id).strip() for media_id in media_ids if str(media_id).strip()]
    if len(normalized) > max_image_count:
        raise ValidationError(
            f"Article has {len(normalized)} images but max_image_count is {max_image_count}"
        )
    return normalized


async def _thumbnail_from_media_ids(
    db: AsyncIOMotorDatabase,
    media_ids: list[str],
) -> str | None:
    """Return the URL of the first image asset in media_ids order.

    Args:
        db: Database connection.
        media_ids: Ordered media id list attached to the article.

    Returns:
        Public URL for the lead image, or None when no image media exists.
    """

    if not media_ids:
        return None

    cursor = db[MEDIA_COLLECTION].find(
        {"_id": {"$in": media_ids}, "file_type": MEDIA_IMAGE_TYPE},
        {"_id": 1, "url": 1},
    )
    docs = {str(doc["_id"]): doc async for doc in cursor}
    for media_id in media_ids:
        doc = docs.get(media_id)
        url = doc.get("url") if doc else None
        if isinstance(url, str) and url.strip():
            return url.strip()
    return None


async def _resolve_thumbnail_url(
    db: AsyncIOMotorDatabase,
    *,
    media_ids: list[str],
    explicit: str | None,
) -> str | None:
    """Resolve thumbnail_url from an explicit value or the first attached image.

    Args:
        db: Database connection.
        media_ids: Ordered media id list attached to the article.
        explicit: Caller-provided thumbnail URL, if any.

    Returns:
        Resolved thumbnail URL or None.
    """

    if explicit:
        return explicit
    return await _thumbnail_from_media_ids(db, media_ids)


async def _ensure_unique_slug(
    repo: ArticleRepository,
    *,
    slug: str,
    exclude_id: str | None = None,
) -> str:
    candidate = slug
    suffix = 2
    while await repo.slug_exists(candidate, exclude_id=exclude_id):
        candidate = f"{slug}-{suffix}"
        suffix += 1
    return candidate


async def _invalidate_article_feed(db: AsyncIOMotorDatabase, doc: dict[str, Any]) -> None:
    market_ids = [str(mid) for mid in (doc.get("market_ids") or [])]
    await invalidate_homepage_for_market_ids(db, market_ids)


async def create(
    db: AsyncIOMotorDatabase,
    body: ArticleCreate,
    *,
    author_id: str,
    actor_id: str | None = None,
    actor_role: str | None = None,
) -> ArticleOut:
    """Create a new draft article.

    Args:
        db: Database connection.
        body: Validated article payload.
        author_id: Author user id for the draft.
        actor_id: Optional auditing actor id.

    Returns:
        Newly created article summary.

    Raises:
        ValidationError: If the title cannot produce a slug or market ids are invalid.
    """

    repo = ArticleRepository(db)
    base_slug = slugify_title(body.title)
    if not base_slug:
        raise ValidationError("Title cannot produce a slug")
    slug = await _ensure_unique_slug(repo, slug=base_slug)
    market_ids = await _validate_market_ids(db, body.market_ids)
    max_image_count = DEFAULT_MAX_IMAGE_COUNT
    if body.max_image_count is not None:
        if actor_role == "reporter":
            raise ValidationError("Reporters cannot set max_image_count")
        max_image_count = body.max_image_count
    media_ids = _validate_media_ids(body.media_ids, max_image_count=max_image_count)
    thumbnail_url = await _resolve_thumbnail_url(
        db,
        media_ids=media_ids,
        explicit=body.thumbnail_url,
    )

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
        "market_ids": market_ids,
        "tags": body.tags,
        "thumbnail_url": thumbnail_url,
        "media_ids": media_ids,
        "video_url": body.video_url,
        "max_image_count": max_image_count,
        "view_count": 0,
        "published_at": None,
        "created_at": now,
        "updated_at": now,
    }
    await repo.insert(doc)
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="article.create",
            resource_type="article",
            resource_id=article_id,
        )
    loader = AuthorNameLoader(db)
    return article_out(doc, author_name=await loader.load(author_id))


async def get_by_id(db: AsyncIOMotorDatabase, article_id: str) -> dict[str, Any]:
    """Load an article document by id.

    Args:
        db: Database connection.
        article_id: Article id to load.

    Returns:
        Raw article document.

    Raises:
        NotFoundError: If the article does not exist.
    """

    repo = ArticleRepository(db)
    doc = await repo.find_by_id(article_id)
    if doc is None:
        raise NotFoundError("Article not found")
    return doc


async def get_detail_by_id(db: AsyncIOMotorDatabase, article_id: str) -> ArticleDetailOut:
    """Load an article detail DTO by id.

    Args:
        db: Database connection.
        article_id: Article id to load.

    Returns:
        Article detail payload.

    Raises:
        NotFoundError: If the article does not exist.
    """

    doc = await get_by_id(db, article_id)
    loader = AuthorNameLoader(db)
    return article_detail_out(doc, author_name=await loader.load(str(doc["author_id"])))


async def list_all(
    db: AsyncIOMotorDatabase,
    pagination: PaginationParams,
) -> tuple[list[ArticleOut], int]:
    """List paginated article summaries.

    Args:
        db: Database connection.
        pagination: Pagination parameters.

    Returns:
        A tuple of mapped articles and total count.
    """

    repo = ArticleRepository(db)
    total = await repo.count_all()
    docs = await repo.list_paginated(pagination)
    loader = AuthorNameLoader(db)
    await loader.load_many([str(doc["author_id"]) for doc in docs])
    items = [
        article_out(doc, author_name=await loader.load(str(doc["author_id"])))
        for doc in docs
    ]
    return items, total


async def update(
    db: AsyncIOMotorDatabase,
    *,
    article_id: str,
    body: ArticleUpdate,
    actor_id: str | None = None,
    actor_role: str | None = None,
) -> ArticleDetailOut:
    """Update editable article fields.

    Args:
        db: Database connection.
        article_id: Article id to update.
        body: Partial update payload.
        actor_id: Optional auditing actor id.

    Returns:
        Updated article detail payload.

    Raises:
        ValidationError: If no fields are provided or market/title data is invalid.
        NotFoundError: If the article does not exist.
    """

    repo = ArticleRepository(db)
    existing = await get_by_id(db, article_id)
    update_doc: dict[str, Any] = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_doc:
        raise ValidationError("No fields to update")

    if actor_role == "reporter" and "max_image_count" in update_doc:
        raise ValidationError("Reporters cannot change max_image_count")

    if "market_ids" in update_doc:
        update_doc["market_ids"] = await _validate_market_ids(db, list(update_doc["market_ids"]))

    effective_max = _resolve_max_image_count(
        existing,
        update_doc.get("max_image_count"),
    )
    if "max_image_count" in update_doc:
        effective_max = int(update_doc["max_image_count"])

    pending_media_ids = (
        list(update_doc["media_ids"])
        if "media_ids" in update_doc
        else list(existing.get("media_ids") or [])
    )
    if "media_ids" in update_doc or "max_image_count" in update_doc:
        normalized_media = _validate_media_ids(pending_media_ids, max_image_count=effective_max)
        if "media_ids" in update_doc:
            update_doc["media_ids"] = normalized_media
        elif len(normalized_media) > effective_max:
            raise ValidationError(
                f"Article has {len(normalized_media)} images but max_image_count is {effective_max}"
            )

    if "media_ids" in update_doc and "thumbnail_url" not in update_doc:
        update_doc["thumbnail_url"] = await _resolve_thumbnail_url(
            db,
            media_ids=pending_media_ids,
            explicit=None,
        )

    if "title" in update_doc:
        base_slug = slugify_title(str(update_doc["title"]))
        if not base_slug:
            raise ValidationError("Title cannot produce a slug")
        update_doc["slug"] = await _ensure_unique_slug(repo, slug=base_slug, exclude_id=article_id)

    update_doc["updated_at"] = _utc_now_iso()
    doc = await repo.find_one_and_update(article_id, update_doc)
    if doc is None:
        raise NotFoundError("Article not found")

    status_changed = "status" in update_doc and update_doc["status"] != existing.get("status")
    market_ids_changed = "market_ids" in update_doc and update_doc["market_ids"] != list(
        existing.get("market_ids") or []
    )
    if doc.get("status") == "published" or status_changed:
        await _invalidate_article_feed(db, doc)
    if market_ids_changed and existing.get("status") == "published":
        old_market_ids = [str(mid) for mid in (existing.get("market_ids") or [])]
        combined = list({*old_market_ids, *[str(mid) for mid in (doc.get("market_ids") or [])]})
        await invalidate_homepage_for_market_ids(db, combined)

    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="article.update",
            resource_type="article",
            resource_id=article_id,
        )
    loader = AuthorNameLoader(db)
    return article_detail_out(doc, author_name=await loader.load(str(doc["author_id"])))


async def publish(
    db: AsyncIOMotorDatabase,
    *,
    article_id: str,
    actor_id: str | None = None,
) -> ArticleDetailOut:
    """Publish an article.

    Args:
        db: Database connection.
        article_id: Article id to publish.
        actor_id: Optional auditing actor id.

    Returns:
        Published article detail payload.

    Raises:
        ConflictError: If attempting to publish an archived article.
        NotFoundError: If the article does not exist.
    """

    repo = ArticleRepository(db)
    doc = await get_by_id(db, article_id)
    if doc["status"] == "archived":
        raise ConflictError("Cannot publish an archived article")

    now = _utc_now_iso()
    updated = await repo.find_one_and_update(
        article_id,
        {"status": "published", "published_at": now, "updated_at": now},
    )
    if updated is None:
        raise NotFoundError("Article not found")

    await _invalidate_article_feed(db, updated)
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="article.publish",
            resource_type="article",
            resource_id=article_id,
        )
    loader = AuthorNameLoader(db)
    return article_detail_out(updated, author_name=await loader.load(str(updated["author_id"])))


async def archive(
    db: AsyncIOMotorDatabase,
    *,
    article_id: str,
    actor_id: str | None = None,
) -> ArticleDetailOut:
    """Archive an article.

    Args:
        db: Database connection.
        article_id: Article id to archive.
        actor_id: Optional auditing actor id.

    Returns:
        Archived article detail payload.

    Raises:
        NotFoundError: If the article does not exist.
    """

    existing = await get_by_id(db, article_id)
    repo = ArticleRepository(db)
    now = _utc_now_iso()
    updated = await repo.find_one_and_update(
        article_id,
        {"status": "archived", "updated_at": now},
    )
    if updated is None:
        raise NotFoundError("Article not found")

    if existing.get("status") == "published":
        await _invalidate_article_feed(db, updated)

    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="article.archive",
            resource_type="article",
            resource_id=article_id,
        )
    loader = AuthorNameLoader(db)
    return article_detail_out(updated, author_name=await loader.load(str(updated["author_id"])))
