"""Layout and slot read operations."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.markets import DEFAULT_MARKET_CODE
from shared.core.regions import get_ancestor_chain
from shared.read.collections import LAYOUTS_COLLECTION, SLOTS_COLLECTION
from shared.read.market_reads import get_market_by_code


async def get_active_layout(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str | None = None,
    region_id: str | None = None,
    page_name: str = "homepage",
) -> dict[str, Any] | None:
    """Return active layout metadata and slot documents for market or region scope."""

    if region_id:
        region_layout = await _get_active_layout_by_region(db, region_id=region_id, page_name=page_name)
        if region_layout is not None:
            return region_layout

    if not market_id:
        return None

    layout = await db[LAYOUTS_COLLECTION].find_one(
        {"page_name": page_name, "market_id": market_id, "is_active": True},
    )
    if layout is None:
        return None

    layout_id = str(layout["_id"])
    # Resolve slots by their owning ``layout_id`` rather than the layout's
    # ``slot_ids`` array. The editor lists, edits, and publishes slots by
    # ``layout_id``, so a slot added outside the seed (or dropped from
    # ``slot_ids`` when the seed rebuilds that array) stays fully editable yet
    # would silently disappear from the live page if we filtered by
    # ``slot_ids``. Querying by ``layout_id`` keeps the live page consistent
    # with what editors see and pin.
    slots_cursor = db[SLOTS_COLLECTION].find({"layout_id": layout_id})
    slots = [s async for s in slots_cursor]
    slots.sort(key=lambda s: int(s.get("order_index") or 0))

    return {
        "layout_id": layout_id,
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
                "draft_pinned_ids": (
                    list(slot["draft_pinned_ids"])
                    if slot.get("draft_pinned_ids") is not None
                    else None
                ),
                "query_rule": slot.get("query_rule"),
            }
            for slot in slots
        ],
    }


async def _get_active_layout_by_region(
    db: AsyncIOMotorDatabase,
    *,
    region_id: str,
    page_name: str,
) -> dict[str, Any] | None:
    """Resolve region layout with nearest-ancestor fallback."""

    chain = await get_ancestor_chain(db, region_id)
    if not chain:
        return None

    for node in chain:
        current_region_id = str(node["_id"])
        layout = await db[LAYOUTS_COLLECTION].find_one(
            {
                "page_name": page_name,
                "region_id": current_region_id,
                "is_active": True,
            },
        )
        if layout is None:
            continue

        layout_id = str(layout["_id"])
        slots_cursor = db[SLOTS_COLLECTION].find({"layout_id": layout_id})
        slots = [s async for s in slots_cursor]
        slots.sort(key=lambda s: int(s.get("order_index") or 0))
        return {
            "layout_id": layout_id,
            "page_name": layout["page_name"],
            "market_id": layout.get("market_id"),
            "region_id": current_region_id,
            "resolved_region_id": current_region_id,
            "requested_region_id": region_id,
            "slots": [
                {
                    "id": str(slot["_id"]),
                    "position_key": slot.get("position_key"),
                    "content_type": str(slot.get("content_type") or "articles"),
                    "display_name": slot.get("display_name"),
                    "presentation_type": str(slot.get("presentation_type") or "grid_4"),
                    "pinned_ids": list(slot.get("pinned_ids") or []),
                    "draft_pinned_ids": (
                        list(slot["draft_pinned_ids"])
                        if slot.get("draft_pinned_ids") is not None
                        else None
                    ),
                    "query_rule": slot.get("query_rule"),
                }
                for slot in slots
            ],
        }

    return None


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
