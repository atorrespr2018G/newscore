"""Article creation pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.helpers.article_media import (
    _assert_image_cap,
    _normalize_media_ids,
    _resolve_thumbnail_url,
)
from news_storage_app.helpers.article_side_effects import _utc_now_iso, _write_audit
from news_storage_app.helpers.article_slug import _ensure_unique_slug
from news_storage_app.helpers.article_validation import (
    _resolve_create_max_image_count,
    _validate_category_ids,
    _validate_market_ids,
)
from news_storage_app.helpers.slug_helpers import slugify_title
from shared.core.exceptions import ValidationError
from shared.helpers.html_sanitize import sanitize_article_html
from shared.read.loaders import AuthorNameLoader
from shared.repositories.article_repository import ArticleRepository
from shared.read.article_reads import article_out
from shared.schemas.article_schemas import ArticleCreate, ArticleOut


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
