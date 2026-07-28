"""Ensure US/PR geo regions and one exact layout per country/state/county/town.

Creates independent homepage and world placement boards for:
- United States + all states + all Florida counties
- Puerto Rico + all municipalities

Also creates per-US-state sports boards (PR-shaped section lists) and deactivates
legacy market layouts for uk/ca/au when present.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

from shared.core.layout_ensure import ensure_us_pr_geo_layouts
from shared.core.sports_page_sections_sync import ensure_us_state_sports_sections

MARKETS_COLLECTION = "markets"
LAYOUTS_COLLECTION = "layouts"

# Same ordered list as Puerto Rico Sports (seed_dev.PR_SPORT_SECTION_LABELS).
PR_SHAPED_SPORT_SECTION_LABELS: list[str] = [
    "Baseball",
    "Basketball",
    "Boxing",
    "Volleyball",
    "Soccer",
    "Surfing",
    "Track and Field",
    "Tennis",
    "Golf",
    "Horse Racing",
]


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


async def _deactivate_legacy_market_layouts(db: Any) -> int:
    """Deactivate homepage layouts for retired market codes."""

    legacy_codes = ("uk", "ca", "au")
    markets = db[MARKETS_COLLECTION].find({"code": {"$in": list(legacy_codes)}}, {"_id": 1})
    market_ids = [str(doc["_id"]) async for doc in markets]
    if not market_ids:
        return 0

    result = await db[LAYOUTS_COLLECTION].update_many(
        {"market_id": {"$in": market_ids}},
        {"$set": {"is_active": False, "updated_at": _utc_now_iso()}},
    )
    return int(result.modified_count)


async def run() -> dict[str, Any]:
    """Ensure full US/PR geo region layouts and deactivate legacy markets."""

    client = AsyncIOMotorClient(_mongo_uri())
    try:
        db = client[_mongo_db_name()]
        ensured = await ensure_us_pr_geo_layouts(db)
        sports_sections = await ensure_us_state_sports_sections(
            db,
            labels=PR_SHAPED_SPORT_SECTION_LABELS,
        )
        deactivated_legacy_layouts = await _deactivate_legacy_market_layouts(db)
        return {
            **ensured,
            "us_state_sports_sections": sports_sections,
            "deactivated_legacy_layouts": deactivated_legacy_layouts,
        }
    finally:
        client.close()


if __name__ == "__main__":
    print(asyncio.run(run()))
