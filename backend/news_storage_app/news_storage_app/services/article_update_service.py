"""Article update pipeline."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.helpers.article_media import (
    _assert_image_cap,
    _normalize_media_ids,
    _resolve_max_image_count,
    _resolve_thumbnail_url,
)
from news_storage_app.helpers.article_side_effects import (
    _invalidate_feeds_for_update,
    _utc_now_iso,
    _write_audit,
)
from news_storage_app.helpers.article_slug import _apply_slug_update
from news_storage_app.helpers.article_validation import (
    _check_reporter_permissions,
    _validate_category_ids,
    _validate_market_ids,
)
from news_storage_app.services.article_read_service import get_by_id
from shared.core.exceptions import NotFoundError, ValidationError
from shared.helpers.html_sanitize import sanitize_article_html
from shared.read.article_reads import article_detail_out
from shared.read.loaders import AuthorNameLoader
from shared.repositories.article_repository import ArticleRepository
from shared.schemas.article_schemas import ArticleDetailOut, ArticleUpdate


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
