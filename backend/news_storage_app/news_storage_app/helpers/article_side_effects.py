"""Audit, cache invalidation, and timestamp helpers for article mutations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.audit import write_event
from shared.core.cache_invalidation import invalidate_homepage_for_article, invalidate_homepage_for_market_ids


def _utc_now_iso() -> str:
    """Return the current UTC timestamp as an ISO-8601 string.

    Returns:
        ISO-8601 timestamp for the current instant in UTC.
    """

    return datetime.now(timezone.utc).isoformat()


async def _invalidate_article_feed(db: AsyncIOMotorDatabase, doc: dict[str, Any]) -> None:
    """Invalidate homepage feed caches for the article's markets.

    Args:
        db: Database connection.
        doc: Article document whose markets should be invalidated.
    """

    await invalidate_homepage_for_article(db, doc)


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
