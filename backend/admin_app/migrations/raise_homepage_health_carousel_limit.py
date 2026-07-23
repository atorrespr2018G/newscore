"""Raise homepage Live (health) carousel slot limit from 10 to 20.

Keeps market and region-owned homepage layouts aligned with the frontend
carousel capacity for the health position.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"

HEALTH_POSITION_KEY = "health"
HEALTH_CAROUSEL_EXTENDED_LIMIT = 20
HOMEPAGE_PAGE_NAME = "homepage"


def _utc_now_iso() -> str:
    """Return an ISO-8601 UTC timestamp."""

    return datetime.now(timezone.utc).isoformat()


def _mongo_uri() -> str:
    """Resolve Mongo connection URI from the environment."""

    value = os.getenv("MONGO_URI")
    if not value:
        raise RuntimeError("Missing MONGO_URI")
    return value


def _mongo_db_name() -> str:
    """Resolve Mongo database name from the environment."""

    value = os.getenv("MONGO_DB_NAME")
    if not value:
        raise RuntimeError("Missing MONGO_DB_NAME")
    return value


async def _homepage_layout_ids(db: Any) -> list[str]:
    """Return ids for active homepage layouts (market and region boards)."""

    cursor = db[LAYOUTS_COLLECTION].find(
        {"page_name": HOMEPAGE_PAGE_NAME, "is_active": True},
        {"_id": 1},
    )
    return [str(doc["_id"]) async for doc in cursor]


async def _invalidate_homepage_feed_cache() -> None:
    """Publish homepage-feed cache invalidation after slot limits change."""

    from shared.core.events import publish_homepage_feed_invalidation

    await publish_homepage_feed_invalidation(all_markets=True)


async def run() -> dict[str, Any]:
    """Update query_rule.limit for homepage Live (health) carousel slots."""

    client = AsyncIOMotorClient(_mongo_uri())
    try:
        db = client[_mongo_db_name()]
        layout_ids = await _homepage_layout_ids(db)
        if not layout_ids:
            return {"matched_layouts": 0, "modified_slots": 0}

        result = await db[SLOTS_COLLECTION].update_many(
            {
                "layout_id": {"$in": layout_ids},
                "position_key": HEALTH_POSITION_KEY,
            },
            {
                "$set": {
                    "query_rule.limit": HEALTH_CAROUSEL_EXTENDED_LIMIT,
                    "updated_at": _utc_now_iso(),
                },
            },
        )
        await _invalidate_homepage_feed_cache()
        return {
            "matched_layouts": len(layout_ids),
            "matched_slots": int(result.matched_count),
            "modified_slots": int(result.modified_count),
            "cache_invalidated": True,
        }
    finally:
        client.close()


if __name__ == "__main__":
    print(asyncio.run(run()))
