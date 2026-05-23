"""Layout and slot read operations."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.markets import DEFAULT_MARKET_CODE
from shared.read.collections import LAYOUTS_COLLECTION, SLOTS_COLLECTION
from shared.read.market_reads import get_market_by_code


async def get_active_layout(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    page_name: str = "homepage",
) -> dict[str, Any] | None:
    """Return active layout metadata and slot documents for a market and page."""

    layout = await db[LAYOUTS_COLLECTION].find_one(
        {"page_name": page_name, "market_id": market_id, "is_active": True},
    )
    if layout is None:
        return None

    slot_ids = list(layout.get("slot_ids") or [])
    slots_cursor = db[SLOTS_COLLECTION].find({"_id": {"$in": slot_ids}})
    slots = [s async for s in slots_cursor]
    slots.sort(key=lambda s: int(s.get("order_index") or 0))

    return {
        "layout_id": str(layout["_id"]),
        "page_name": layout["page_name"],
        "market_id": market_id,
        "slots": [
            {
                "id": str(slot["_id"]),
                "position_key": slot.get("position_key"),
                "content_type": str(slot.get("content_type") or "articles"),
                "display_name": slot.get("display_name"),
                "presentation_type": str(slot.get("presentation_type") or "grid_4"),
                "pinned_ids": list(slot.get("pinned_ids") or []),
                "query_rule": slot.get("query_rule"),
            }
            for slot in slots
        ],
    }


async def get_active_homepage_layout(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str = DEFAULT_MARKET_CODE,
) -> dict[str, Any] | None:
    """Return active homepage layout for a market code (defaults to US)."""

    market = await get_market_by_code(db, market_code)
    if market is None:
        return None
    return await get_active_layout(db, market_id=str(market["_id"]), page_name="homepage")
