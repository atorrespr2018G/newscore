"""Layout and slot read operations."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.read.collections import LAYOUTS_COLLECTION, SLOTS_COLLECTION


async def get_active_homepage_layout(db: AsyncIOMotorDatabase) -> dict[str, Any] | None:
    """Return active homepage layout metadata and slot documents."""

    layout = await db[LAYOUTS_COLLECTION].find_one({"page_name": "homepage", "is_active": True})
    if layout is None:
        return None

    slot_ids = list(layout.get("slot_ids") or [])
    slots_cursor = db[SLOTS_COLLECTION].find({"_id": {"$in": slot_ids}})
    slots = [s async for s in slots_cursor]
    slots.sort(key=lambda s: int(s.get("order_index") or 0))

    return {
        "layout_id": str(layout["_id"]),
        "page_name": layout["page_name"],
        "slots": [
            {
                "id": str(slot["_id"]),
                "position_key": slot.get("position_key"),
                "content_type": str(slot.get("content_type") or "articles"),
                "pinned_ids": list(slot.get("pinned_ids") or []),
                "query_rule": slot.get("query_rule"),
            }
            for slot in slots
        ],
    }
