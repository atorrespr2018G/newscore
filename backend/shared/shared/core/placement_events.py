"""Placement event capture and counting.

A placement is not its own record in the data model — it is an article id inside
a slot's ``pinned_ids``/``draft_pinned_ids`` array. To badge "newly placed"
stories we additionally log a lightweight event whenever an article id is added
to a slot, keyed by ``(article_id, slot_id)`` so re-dropping refreshes the time.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.read.collections import PLACEMENT_EVENTS_COLLECTION


def _utc_now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""

    return datetime.now(timezone.utc).isoformat()


def compute_added_ids(old_ids: list[str] | None, new_ids: list[str] | None) -> list[str]:
    """Return ids present in ``new_ids`` but not in ``old_ids``, order-preserved.

    Args:
        old_ids: Previously pinned article ids (None treated as empty).
        new_ids: Newly pinned article ids (None treated as empty).

    Returns:
        Article ids added by this change, in their order within ``new_ids``.
    """

    previous = set(old_ids or [])
    seen: set[str] = set()
    added: list[str] = []
    for article_id in new_ids or []:
        if article_id not in previous and article_id not in seen:
            seen.add(article_id)
            added.append(article_id)
    return added


async def record_placements(
    db: AsyncIOMotorDatabase,
    *,
    article_ids: list[str],
    slot_id: str,
    market_id: str | None,
) -> None:
    """Upsert a placement event per newly placed article id.

    Keyed on ``(article_id, slot_id)`` so a story re-dropped into the same slot
    simply refreshes ``placed_at`` instead of creating duplicate events.

    Args:
        db: Database connection.
        article_ids: Article ids newly added to the slot.
        slot_id: Slot the articles were pinned into.
        market_id: Market scope for the slot's layout, if resolvable.
    """

    if not article_ids:
        return

    now = _utc_now_iso()
    collection = db[PLACEMENT_EVENTS_COLLECTION]
    for article_id in article_ids:
        update: dict[str, Any] = {
            "$set": {
                "article_id": article_id,
                "slot_id": slot_id,
                "market_id": market_id,
                "placed_at": now,
            }
        }
        await collection.update_one(
            {"article_id": article_id, "slot_id": slot_id},
            update,
            upsert=True,
        )


async def count_new_placements(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    since: str | None,
) -> int:
    """Count placement events for a market newer than a last-seen timestamp.

    Args:
        db: Database connection.
        market_id: Market scope to count within.
        since: ISO-8601 last-seen timestamp; None counts all events.

    Returns:
        Number of placement events with ``placed_at`` strictly after ``since``.
    """

    query: dict[str, Any] = {"market_id": market_id}
    if since is not None:
        query["placed_at"] = {"$gt": since}
    return await db[PLACEMENT_EVENTS_COLLECTION].count_documents(query)
