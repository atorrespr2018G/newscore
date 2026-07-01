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

from shared.read.collections import PLACEMENT_EVENTS_COLLECTION, SLOTS_COLLECTION


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


def article_has_staged_unpublished_placement(slot: dict[str, Any], article_id: str) -> bool:
    """Return whether an article is staged in a slot but not yet published live.

    Matches the frontend draft-minus-live highlight: the slot must still carry a
    ``draft_pinned_ids`` array and the article must appear there but not in live
    ``pinned_ids``.

    Args:
        slot: Slot document from MongoDB.
        article_id: Article id to test.

    Returns:
        True when the article is a staged-but-unpublished pin in the slot.
    """

    draft_ids = slot.get("draft_pinned_ids")
    if draft_ids is None:
        return False
    pinned_ids = {value for value in (slot.get("pinned_ids") or []) if value and str(value).strip()}
    return article_id in draft_ids and article_id not in pinned_ids


async def clear_placement_events(
    db: AsyncIOMotorDatabase,
    *,
    slot_id: str,
    article_ids: list[str],
) -> None:
    """Delete placement events for article ids promoted to the live layout.

    Args:
        db: Database connection.
        slot_id: Slot whose staged pins were published.
        article_ids: Article ids cleared from the unpublished placement badge.
    """

    if not article_ids:
        return
    await db[PLACEMENT_EVENTS_COLLECTION].delete_many(
        {"slot_id": slot_id, "article_id": {"$in": article_ids}},
    )


async def count_new_placements(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    since: str | None,
) -> int:
    """Count still-unpublished placements newer than a last-seen timestamp.

    Only events whose ``(article_id, slot_id)`` pair remains staged in
    ``draft_pinned_ids`` but absent from live ``pinned_ids`` are counted, so the
    Placement tab badge drops to zero once homepage placements are published.

    Args:
        db: Database connection.
        market_id: Market scope to count within.
        since: ISO-8601 last-seen timestamp; None counts all matching events.

    Returns:
        Number of unpublished placement events with ``placed_at`` after ``since``.
    """

    query: dict[str, Any] = {"market_id": market_id}
    if since is not None:
        query["placed_at"] = {"$gt": since}

    events = db[PLACEMENT_EVENTS_COLLECTION].find(query, {"article_id": 1, "slot_id": 1})
    slots = db[SLOTS_COLLECTION]
    slot_cache: dict[str, dict[str, Any] | None] = {}
    total = 0

    async for event in events:
        slot_id = str(event.get("slot_id") or "")
        article_id = str(event.get("article_id") or "")
        if not slot_id or not article_id:
            continue
        if slot_id not in slot_cache:
            slot_cache[slot_id] = await slots.find_one({"_id": slot_id})
        slot = slot_cache[slot_id]
        if slot is not None and article_has_staged_unpublished_placement(slot, article_id):
            total += 1
    return total
