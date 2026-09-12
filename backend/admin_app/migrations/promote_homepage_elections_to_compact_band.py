"""Move the primary Election homepage slot into the Politics-style compact band."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
HOMEPAGE_PAGE_NAME = "homepage"
ELECTION_POSITION_KEY = "midterm-elections"
POLITICS_POSITION_KEY = "politics"
COMPACT_BAND_ARTICLE_LIMIT = 12


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mongo_uri() -> str:
    value = os.getenv("MONGO_URI")
    if not value:
        raise RuntimeError("Missing MONGO_URI")
    return value


def _mongo_db_name() -> str:
    value = os.getenv("MONGO_DB_NAME")
    if not value:
        raise RuntimeError("Missing MONGO_DB_NAME")
    return value


async def _migrate_layout(db: Any, layout_id: str) -> bool:
    slots = [
        slot
        async for slot in db[SLOTS_COLLECTION]
        .find({"layout_id": layout_id})
        .sort("order_index", 1)
    ]
    election_index = next(
        (index for index, slot in enumerate(slots) if slot.get("position_key") == ELECTION_POSITION_KEY),
        None,
    )
    politics_index = next(
        (index for index, slot in enumerate(slots) if slot.get("position_key") == POLITICS_POSITION_KEY),
        None,
    )
    if election_index is None or politics_index is None:
        return False

    election = slots.pop(election_index)
    query_rule = dict(election.get("query_rule") or {})
    needs_update = (
        election_index != politics_index + 1
        or election.get("presentation_type") != "grid_4"
        or query_rule.get("limit") != COMPACT_BAND_ARTICLE_LIMIT
    )
    if not needs_update:
        return False

    politics_index = next(
        index for index, slot in enumerate(slots) if slot.get("position_key") == POLITICS_POSITION_KEY
    )
    slots.insert(politics_index + 1, election)
    now = _utc_now_iso()

    for order_index, slot in enumerate(slots):
        fields: dict[str, Any] = {"order_index": order_index, "updated_at": now}
        if slot.get("position_key") == ELECTION_POSITION_KEY:
            election_query_rule = dict(slot.get("query_rule") or {})
            election_query_rule["limit"] = COMPACT_BAND_ARTICLE_LIMIT
            fields.update(
                {
                    "presentation_type": "grid_4",
                    "query_rule": election_query_rule,
                },
            )
        await db[SLOTS_COLLECTION].update_one({"_id": slot["_id"]}, {"$set": fields})
    return True


async def run() -> dict[str, int | bool]:
    """Promote Election across active market and region homepage layouts."""

    client = AsyncIOMotorClient(_mongo_uri())
    try:
        db = client[_mongo_db_name()]
        layout_ids = [
            str(layout["_id"])
            async for layout in db[LAYOUTS_COLLECTION].find(
                {"page_name": HOMEPAGE_PAGE_NAME, "is_active": True},
                {"_id": 1},
            )
        ]
        migrated = 0
        for layout_id in layout_ids:
            migrated += int(await _migrate_layout(db, layout_id))
        if migrated:
            from shared.core.events import publish_homepage_feed_invalidation

            await publish_homepage_feed_invalidation(all_markets=True)
        return {"matched_layouts": len(layout_ids), "migrated_layouts": migrated, "cache_invalidated": bool(migrated)}
    finally:
        client.close()


if __name__ == "__main__":
    print(asyncio.run(run()))