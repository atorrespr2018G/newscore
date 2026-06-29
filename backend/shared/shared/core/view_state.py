"""Per-user workflow view last-seen tracking.

Backs the editorial workflow tab badges: each user has one ``last_seen_at``
timestamp per view (``placement``/``review``) so "new since you last opened
this tab" counts stay accurate across devices.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Final

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from shared.core.exceptions import ValidationError
from shared.read.collections import USER_VIEW_STATE_COLLECTION

VIEW_PLACEMENT: Final[str] = "placement"
VIEW_REVIEW: Final[str] = "review"
ALLOWED_VIEWS: Final[frozenset[str]] = frozenset({VIEW_PLACEMENT, VIEW_REVIEW})


def _utc_now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""

    return datetime.now(timezone.utc).isoformat()


def validate_view(view: str) -> str:
    """Validate a workflow view name.

    Args:
        view: Raw view identifier from the client.

    Returns:
        The normalized, validated view name.

    Raises:
        ValidationError: If the view is not a known workflow view.
    """

    normalized = view.strip().lower()
    if normalized not in ALLOWED_VIEWS:
        raise ValidationError(f"Unknown workflow view: {view}")
    return normalized


async def get_last_seen(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    view: str,
) -> str | None:
    """Return the user's last-seen timestamp for a view, or None if never seen.

    Args:
        db: Database connection.
        user_id: Authenticated user id.
        view: Workflow view name (already validated by the caller).

    Returns:
        ISO-8601 last-seen timestamp, or None when the user has not opened it.
    """

    doc = await db[USER_VIEW_STATE_COLLECTION].find_one(
        {"user_id": user_id, "view": view},
        {"last_seen_at": 1},
    )
    if doc is None:
        return None
    return doc.get("last_seen_at")


async def mark_seen(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    view: str,
) -> str:
    """Set the user's last-seen timestamp for a view to now.

    Args:
        db: Database connection.
        user_id: Authenticated user id.
        view: Workflow view name (already validated by the caller).

    Returns:
        The ISO-8601 timestamp that was stored.
    """

    now = _utc_now_iso()
    await db[USER_VIEW_STATE_COLLECTION].find_one_and_update(
        {"user_id": user_id, "view": view},
        {"$set": {"last_seen_at": now}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return now
