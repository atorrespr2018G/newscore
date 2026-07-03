"""Article lifecycle transitions (review, publish, archive)."""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.helpers.article_side_effects import (
    _invalidate_article_feed,
    _utc_now_iso,
    _write_audit,
)
from news_storage_app.services.article_read_service import get_by_id
from shared.core.exceptions import ConflictError, NotFoundError
from shared.read.article_reads import article_detail_out
from shared.read.loaders import AuthorNameLoader
from shared.repositories.article_repository import ArticleRepository
from shared.schemas.article_schemas import ArticleDetailOut


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
