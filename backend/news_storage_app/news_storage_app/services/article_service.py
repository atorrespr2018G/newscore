"""Article lifecycle service (draft/review/publish/archive)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.audit import write_event
from news_storage_app.helpers.slug_helpers import slugify_title
from shared.core.cache_invalidation import invalidate_homepage_for_market_ids
from shared.core.exceptions import ConflictError, NotFoundError, ValidationError
from shared.core.pagination import PaginationParams
from shared.helpers.html_sanitize import sanitize_article_html
from shared.read.article_reads import (
    article_detail_out,
    article_out,
    list_story_groups as read_story_groups,
)
from shared.read.collections import CATEGORIES_COLLECTION, MARKETS_COLLECTION
from shared.read.loaders import AuthorNameLoader
from shared.repositories.article_repository import ArticleRepository
from news_storage_app.services.media_service import MEDIA_COLLECTION
from shared.schemas.article_schemas import (
    DEFAULT_MAX_IMAGE_COUNT,
    MAX_CATEGORY_COUNT,
    MIN_CATEGORY_COUNT,
    ArticleCreate,
    ArticleDetailOut,
    ArticleOut,
    ArticleUpdate,
    StoryGroupOut,
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


async def _validate_category_ids(db: AsyncIOMotorDatabase, category_ids: list[str]) -> list[str]:
    """Normalize and validate the selected category ids.

    Enforces the editorial rule that a story belongs to between one and three
    sections, with no duplicates, and that every id exists.

    Args:
        db: Database connection.
        category_ids: Raw category ids submitted by the client.

    Returns:
        Ordered, de-duplicated category id list.

    Raises:
        ValidationError: If the count is out of range or an id is unknown.
    """

    normalized: list[str] = []
    for cid in category_ids:
        clean = str(cid).strip()
        if clean and clean not in normalized:
            normalized.append(clean)

    if len(normalized) < MIN_CATEGORY_COUNT:
        raise ValidationError(f"Select at least {MIN_CATEGORY_COUNT} category")
    if len(normalized) > MAX_CATEGORY_COUNT:
        raise ValidationError(f"Select no more than {MAX_CATEGORY_COUNT} categories")

    for category_id in normalized:
        exists = await db[CATEGORIES_COLLECTION].find_one({"_id": category_id}, {"_id": 1})
        if exists is None:
            raise ValidationError(f"Unknown category_id: {category_id}")

    return normalized


def _resolve_max_image_count(existing: dict[str, Any], requested: int | None) -> int:
    """Resolve the effective max image count for an article document."""

    if requested is not None:
        return requested
    stored = existing.get("max_image_count")
    if stored is not None:
        return int(stored)
    return DEFAULT_MAX_IMAGE_COUNT


def _normalize_media_ids(media_ids: list[str]) -> list[str]:
    """Strip blanks from an ordered media id list, preserving order.

    Args:
        media_ids: Raw ordered media ids (images and/or videos).

    Returns:
        Cleaned, order-preserving media id list.
    """

    return [str(media_id).strip() for media_id in media_ids if str(media_id).strip()]


async def _count_image_media_ids(db: AsyncIOMotorDatabase, media_ids: list[str]) -> int:
    """Count how many of the given media ids reference image assets.

    Videos and unknown ids are excluded so only images are capped.

    Args:
        db: Database connection.
        media_ids: Ordered media ids attached to the article.

    Returns:
        Number of image-type media among the ids.
    """

    if not media_ids:
        return 0
    return await db[MEDIA_COLLECTION].count_documents(
        {"_id": {"$in": media_ids}, "file_type": MEDIA_IMAGE_TYPE}
    )


async def _assert_image_cap(
    db: AsyncIOMotorDatabase,
    media_ids: list[str],
    *,
    max_image_count: int,
) -> None:
    """Enforce that the article's image media stay within the image cap.

    Videos may be attached freely via ``media_ids``; only images count toward
    ``max_image_count`` so a story can carry multiple videos alongside images.

    Args:
        db: Database connection.
        media_ids: Normalized ordered media ids (images and/or videos).
        max_image_count: Maximum allowed image assets.

    Raises:
        ValidationError: If the image count exceeds ``max_image_count``.
    """

    image_count = await _count_image_media_ids(db, media_ids)
    if image_count > max_image_count:
        raise ValidationError(
            f"Article has {image_count} images but max_image_count is {max_image_count}"
        )


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


async def _write_audit(
    db: AsyncIOMotorDatabase,
    *,
    actor_id: str | None,
    action: str,
    article_id: str,
) -> None:
    """Record an article audit event when an actor id is present.

    Args:
        db: Database connection.
        actor_id: Acting user id, or None to skip auditing.
        action: Audit action name (e.g. ``article.create``).
        article_id: Affected article id.
    """

    if not actor_id:
        return
    await write_event(
        db,
        user_id=actor_id,
        action=action,
        resource_type="article",
        resource_id=article_id,
    )


def _resolve_create_max_image_count(body: ArticleCreate, actor_role: str | None) -> int:
    """Resolve the image cap for a new article, enforcing the reporter limit.

    Args:
        body: Validated article payload.
        actor_role: Role of the acting user, if known.

    Returns:
        Effective max image count for the new article.

    Raises:
        ValidationError: If a reporter attempts to set ``max_image_count``.
    """

    if body.max_image_count is None:
        return DEFAULT_MAX_IMAGE_COUNT
    if actor_role == "reporter":
        raise ValidationError("Reporters cannot set max_image_count")
    return body.max_image_count


@dataclass(frozen=True)
class _PreparedArticleFields:
    """Validated, derived fields ready to persist for a new article."""

    slug: str
    market_ids: list[str]
    category_ids: list[str]
    media_ids: list[str]
    thumbnail_url: str | None
    max_image_count: int


async def _prepare_new_article(
    db: AsyncIOMotorDatabase,
    *,
    body: ArticleCreate,
    actor_role: str | None,
) -> _PreparedArticleFields:
    """Validate inputs and resolve the derived fields for a new article.

    Args:
        db: Database connection.
        body: Validated article payload.
        actor_role: Role of the acting user, if known.

    Returns:
        Bundle of validated slug, markets, media, thumbnail, and image cap.

    Raises:
        ValidationError: If the title cannot produce a slug or inputs are invalid.
    """

    base_slug = slugify_title(body.title)
    if not base_slug:
        raise ValidationError("Title cannot produce a slug")
    repo = ArticleRepository(db)
    slug = await _ensure_unique_slug(repo, slug=base_slug)
    market_ids = await _validate_market_ids(db, body.market_ids)
    category_ids = await _validate_category_ids(db, body.category_ids)
    max_image_count = _resolve_create_max_image_count(body, actor_role)
    media_ids = _normalize_media_ids(body.media_ids)
    await _assert_image_cap(db, media_ids, max_image_count=max_image_count)
    thumbnail_url = await _resolve_thumbnail_url(db, media_ids=media_ids, explicit=body.thumbnail_url)
    return _PreparedArticleFields(
        slug=slug,
        market_ids=market_ids,
        category_ids=category_ids,
        media_ids=media_ids,
        thumbnail_url=thumbnail_url,
        max_image_count=max_image_count,
    )


def _new_article_doc(
    body: ArticleCreate,
    *,
    author_id: str,
    fields: _PreparedArticleFields,
) -> dict[str, Any]:
    """Assemble the persisted document for a new draft article.

    Args:
        body: Validated article payload.
        author_id: Author user id for the draft.
        fields: Validated, derived fields for the article.

    Returns:
        The article document ready to insert.
    """

    now = _utc_now_iso()
    return {
        "_id": str(uuid4()),
        "title": body.title,
        "slug": fields.slug,
        # Body is editor-authored HTML; sanitize to a safe allowlist before storage.
        "body": sanitize_article_html(body.body),
        "status": "draft",
        "author_id": author_id,
        # category_id keeps the primary section for legacy single-category reads.
        "category_id": fields.category_ids[0],
        "category_ids": fields.category_ids,
        # story_id groups multiple articles covering the same event; set by editors.
        "story_id": body.story_id,
        "international_potential": body.international_potential,
        "market_ids": fields.market_ids,
        "tags": body.tags,
        "thumbnail_url": fields.thumbnail_url,
        "media_ids": fields.media_ids,
        "video_url": body.video_url,
        "max_image_count": fields.max_image_count,
        "view_count": 0,
        "published_at": None,
        "created_at": now,
        "updated_at": now,
    }


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
        actor_role: Role of the acting user, if known.

    Returns:
        Newly created article summary.

    Raises:
        ValidationError: If the title cannot produce a slug or market ids are invalid.
    """

    repo = ArticleRepository(db)
    fields = await _prepare_new_article(db, body=body, actor_role=actor_role)
    doc = _new_article_doc(body, author_id=author_id, fields=fields)
    await repo.insert(doc)
    await _write_audit(db, actor_id=actor_id, action="article.create", article_id=doc["_id"])
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


async def list_story_groups(db: AsyncIOMotorDatabase) -> list[StoryGroupOut]:
    """List distinct editor-assigned story groups for the editor combobox.

    Args:
        db: Database connection.

    Returns:
        Story groups ordered by article count, largest first.
    """

    return await read_story_groups(db)


def _build_update_doc(body: ArticleUpdate) -> dict[str, Any]:
    """Collect the non-null fields from an update payload.

    Args:
        body: Partial update payload.

    Returns:
        Mapping of fields to update.

    Raises:
        ValidationError: If no fields are provided.
    """

    update_doc: dict[str, Any] = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_doc:
        raise ValidationError("No fields to update")
    # Body edits are editor-authored HTML; sanitize before persisting.
    if "body" in update_doc:
        update_doc["body"] = sanitize_article_html(update_doc["body"])
    return update_doc


def _check_reporter_permissions(update_doc: dict[str, Any], actor_role: str | None) -> None:
    """Reject reporter attempts to change the image cap.

    Args:
        update_doc: Pending update fields.
        actor_role: Role of the acting user, if known.

    Raises:
        ValidationError: If a reporter tries to change ``max_image_count``.
    """

    if actor_role == "reporter" and "max_image_count" in update_doc:
        raise ValidationError("Reporters cannot change max_image_count")


async def _normalize_update_media(
    db: AsyncIOMotorDatabase,
    *,
    existing: dict[str, Any],
    update_doc: dict[str, Any],
) -> None:
    """Validate media ids against the image cap and resolve the thumbnail.

    Mutates ``update_doc`` in place with normalized media and thumbnail values.

    Args:
        db: Database connection.
        existing: Current persisted article document.
        update_doc: Pending update fields.

    Raises:
        ValidationError: If the media count exceeds the effective image cap.
    """

    effective_max = _resolve_max_image_count(existing, update_doc.get("max_image_count"))
    if "max_image_count" in update_doc:
        effective_max = int(update_doc["max_image_count"])

    pending_media_ids = (
        list(update_doc["media_ids"])
        if "media_ids" in update_doc
        else list(existing.get("media_ids") or [])
    )
    if "media_ids" in update_doc or "max_image_count" in update_doc:
        normalized_media = _normalize_media_ids(pending_media_ids)
        await _assert_image_cap(db, normalized_media, max_image_count=effective_max)
        if "media_ids" in update_doc:
            update_doc["media_ids"] = normalized_media

    if "media_ids" in update_doc and "thumbnail_url" not in update_doc:
        update_doc["thumbnail_url"] = await _resolve_thumbnail_url(
            db,
            media_ids=pending_media_ids,
            explicit=None,
        )


async def _normalize_update_categories(
    db: AsyncIOMotorDatabase,
    *,
    update_doc: dict[str, Any],
) -> None:
    """Validate updated category ids and resync the primary category_id.

    Mutates ``update_doc`` in place with normalized category ids and the
    derived primary ``category_id`` when categories are being changed.

    Args:
        db: Database connection.
        update_doc: Pending update fields.

    Raises:
        ValidationError: If the category selection is out of range or invalid.
    """

    if "category_ids" not in update_doc:
        return
    normalized = await _validate_category_ids(db, list(update_doc["category_ids"]))
    update_doc["category_ids"] = normalized
    update_doc["category_id"] = normalized[0]


async def _apply_slug_update(
    repo: ArticleRepository,
    *,
    update_doc: dict[str, Any],
    article_id: str,
) -> None:
    """Derive a unique slug when the title changes.

    Mutates ``update_doc`` in place with the new slug when applicable.

    Args:
        repo: Article repository.
        update_doc: Pending update fields.
        article_id: Article id being updated.

    Raises:
        ValidationError: If the new title cannot produce a slug.
    """

    if "title" not in update_doc:
        return
    base_slug = slugify_title(str(update_doc["title"]))
    if not base_slug:
        raise ValidationError("Title cannot produce a slug")
    update_doc["slug"] = await _ensure_unique_slug(repo, slug=base_slug, exclude_id=article_id)


async def _invalidate_feeds_for_update(
    db: AsyncIOMotorDatabase,
    *,
    existing: dict[str, Any],
    doc: dict[str, Any],
    update_doc: dict[str, Any],
) -> None:
    """Invalidate homepage caches affected by a status or market change.

    Args:
        db: Database connection.
        existing: Article document prior to the update.
        doc: Article document after the update.
        update_doc: Fields that were applied.
    """

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
        actor_role: Role of the acting user, if known.

    Returns:
        Updated article detail payload.

    Raises:
        ValidationError: If no fields are provided or market/title data is invalid.
        NotFoundError: If the article does not exist.
    """

    repo = ArticleRepository(db)
    existing = await get_by_id(db, article_id)
    update_doc = _build_update_doc(body)
    _check_reporter_permissions(update_doc, actor_role)
    if "market_ids" in update_doc:
        update_doc["market_ids"] = await _validate_market_ids(db, list(update_doc["market_ids"]))
    await _normalize_update_categories(db, update_doc=update_doc)
    await _normalize_update_media(db, existing=existing, update_doc=update_doc)
    await _apply_slug_update(repo, update_doc=update_doc, article_id=article_id)

    update_doc["updated_at"] = _utc_now_iso()
    doc = await repo.find_one_and_update(article_id, update_doc)
    if doc is None:
        raise NotFoundError("Article not found")

    await _invalidate_feeds_for_update(db, existing=existing, doc=doc, update_doc=update_doc)
    await _write_audit(db, actor_id=actor_id, action="article.update", article_id=article_id)
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
    await _write_audit(db, actor_id=actor_id, action="article.publish", article_id=article_id)
    loader = AuthorNameLoader(db)
    return article_detail_out(updated, author_name=await loader.load(str(updated["author_id"])))


async def submit_for_review(
    db: AsyncIOMotorDatabase,
    *,
    article_id: str,
    actor_id: str | None = None,
) -> ArticleDetailOut:
    """Move a draft article into the review queue.

    Args:
        db: Database connection.
        article_id: Article id to submit for review.
        actor_id: Optional auditing actor id.

    Returns:
        Updated article detail payload in ``review`` status.

    Raises:
        ConflictError: If the article is not currently a draft.
        NotFoundError: If the article does not exist.
    """

    repo = ArticleRepository(db)
    doc = await get_by_id(db, article_id)
    if doc["status"] != "draft":
        raise ConflictError("Only draft articles can be submitted for review")

    now = _utc_now_iso()
    # review_submitted_at marks when the story entered the queue so the Review
    # tab badge can count stories newer than the editor's last visit.
    updated = await repo.find_one_and_update(
        article_id,
        {"status": "review", "review_submitted_at": now, "updated_at": now},
    )
    if updated is None:
        raise NotFoundError("Article not found")

    await _write_audit(db, actor_id=actor_id, action="article.submit_for_review", article_id=article_id)
    loader = AuthorNameLoader(db)
    return article_detail_out(updated, author_name=await loader.load(str(updated["author_id"])))


async def approve(
    db: AsyncIOMotorDatabase,
    *,
    article_id: str,
    actor_id: str | None = None,
) -> ArticleDetailOut:
    """Approve an in-review article and publish it.

    Reuses the existing publish side effects (cache invalidation, audit) after
    enforcing that the article is currently awaiting review.

    Args:
        db: Database connection.
        article_id: Article id to approve.
        actor_id: Optional auditing actor id.

    Returns:
        Published article detail payload.

    Raises:
        ConflictError: If the article is not currently in review.
        NotFoundError: If the article does not exist.
    """

    doc = await get_by_id(db, article_id)
    if doc["status"] != "review":
        raise ConflictError("Only articles in review can be approved")
    return await publish(db, article_id=article_id, actor_id=actor_id)


async def send_back(
    db: AsyncIOMotorDatabase,
    *,
    article_id: str,
    actor_id: str | None = None,
) -> ArticleDetailOut:
    """Send an in-review article back to draft for further edits.

    Args:
        db: Database connection.
        article_id: Article id to send back.
        actor_id: Optional auditing actor id.

    Returns:
        Updated article detail payload in ``draft`` status.

    Raises:
        ConflictError: If the article is not currently in review.
        NotFoundError: If the article does not exist.
    """

    repo = ArticleRepository(db)
    doc = await get_by_id(db, article_id)
    if doc["status"] != "review":
        raise ConflictError("Only articles in review can be sent back")

    now = _utc_now_iso()
    updated = await repo.find_one_and_update(
        article_id,
        {"status": "draft", "updated_at": now},
    )
    if updated is None:
        raise NotFoundError("Article not found")

    await _write_audit(db, actor_id=actor_id, action="article.send_back", article_id=article_id)
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

    await _write_audit(db, actor_id=actor_id, action="article.archive", article_id=article_id)
    loader = AuthorNameLoader(db)
    return article_detail_out(updated, author_name=await loader.load(str(updated["author_id"])))
