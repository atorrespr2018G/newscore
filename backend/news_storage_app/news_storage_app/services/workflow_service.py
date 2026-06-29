"""Workflow badge logic for the news storage app (review tab)."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.view_state import VIEW_REVIEW, get_last_seen
from shared.read.collections import ARTICLES_COLLECTION

REVIEW_STATUS = "review"


async def count_new_reviews_for_user(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
) -> int:
    """Count stories that entered review since the user last opened the Review tab.

    Args:
        db: Database connection.
        user_id: Authenticated user id.

    Returns:
        Number of in-review articles with ``review_submitted_at`` newer than the
        user's last-seen timestamp.
    """

    last_seen = await get_last_seen(db, user_id=user_id, view=VIEW_REVIEW)
    query: dict[str, Any] = {"status": REVIEW_STATUS}
    if last_seen is not None:
        query["review_submitted_at"] = {"$gt": last_seen}
    return await db[ARTICLES_COLLECTION].count_documents(query)
