"""Insert a horizontal ribbon advertisement between Government and Live."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient

LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
HOMEPAGE_PAGE_SECTIONS_COLLECTION = "homepage_page_sections"
HOMEPAGE_PAGE_NAME = "homepage"
SECTION_TYPE_RIBBON_AD = "ribbon_ad"
SECTION_TYPE_LIVE = "live"
PRESENTATION_RIBBON_AD = "ribbon_ad"
PRESENTATION_LIVE_CAROUSEL = "live_carousel"
LIVE_POSITION_KEY = "health"
RIBBON_AD_POSITION_KEY = "ad-ribbon"
RIBBON_AD_LABEL = "Ribbon Advertisement"


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


def _is_ribbon_slot(slot: dict[str, Any]) -> bool:
    """Return whether a layout slot is a ribbon advertisement."""

    presentation = str(slot.get("presentation_type") or "").strip().lower()
    position_key = str(slot.get("position_key") or "").strip().lower()
    return presentation == PRESENTATION_RIBBON_AD or position_key.startswith("ad-ribbon")


def _is_live_slot(slot: dict[str, Any]) -> bool:
    """Return whether a layout slot is the Live carousel."""

    presentation = str(slot.get("presentation_type") or "").strip().lower()
    position_key = str(slot.get("position_key") or "").strip().lower()
    return presentation == PRESENTATION_LIVE_CAROUSEL or position_key == LIVE_POSITION_KEY


def _next_ribbon_slug(used_slugs: set[str]) -> str:
    """Allocate the next unused ad-ribbon slug."""

    if RIBBON_AD_POSITION_KEY not in used_slugs:
        return RIBBON_AD_POSITION_KEY
    suffix = 2
    while f"{RIBBON_AD_POSITION_KEY}-{suffix}" in used_slugs:
        suffix += 1
    return f"{RIBBON_AD_POSITION_KEY}-{suffix}"


def _ensure_ribbon_before_live_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Insert a ribbon_ad row immediately before Live when missing."""

    migrated: list[dict[str, Any]] = []
    used_slugs = {str(item.get("slug") or "") for item in items}
    for item in items:
        if item.get("section_type") == SECTION_TYPE_LIVE:
            previous_is_ribbon = (
                bool(migrated) and migrated[-1].get("section_type") == SECTION_TYPE_RIBBON_AD
            )
            if not previous_is_ribbon:
                ribbon_slug = _next_ribbon_slug(used_slugs)
                used_slugs.add(ribbon_slug)
                migrated.append(
                    {
                        "section_type": SECTION_TYPE_RIBBON_AD,
                        "slug": ribbon_slug,
                        "label": RIBBON_AD_LABEL,
                    },
                )
        migrated.append(dict(item))
    return migrated


async def _migrate_layout(db: Any, layout_id: str) -> bool:
    """Insert a ribbon slot immediately before Live when one is missing."""

    slots = [
        slot
        async for slot in db[SLOTS_COLLECTION]
        .find({"layout_id": layout_id})
        .sort("order_index", 1)
    ]
    live_index = next((index for index, slot in enumerate(slots) if _is_live_slot(slot)), None)
    if live_index is None:
        return False
    if live_index > 0 and _is_ribbon_slot(slots[live_index - 1]):
        return False

    used_slugs = {str(slot.get("position_key") or "") for slot in slots}
    ribbon_slug = _next_ribbon_slug(used_slugs)
    now = _utc_now_iso()
    ribbon_id = str(uuid4())
    ribbon_slot = {
        "_id": ribbon_id,
        "layout_id": layout_id,
        "position_key": ribbon_slug,
        "order_index": live_index,
        "display_name": RIBBON_AD_LABEL,
        "presentation_type": PRESENTATION_RIBBON_AD,
        "query_rule": {"mode": "latest", "limit": 0},
        "pinned_article_ids": [],
        "created_at": now,
        "updated_at": now,
    }
    await db[SLOTS_COLLECTION].insert_one(ribbon_slot)

    reordered = slots[:live_index] + [ribbon_slot] + slots[live_index:]
    slot_ids: list[str] = []
    for order_index, slot in enumerate(reordered):
        slot_ids.append(str(slot["_id"]))
        await db[SLOTS_COLLECTION].update_one(
            {"_id": slot["_id"]},
            {"$set": {"order_index": order_index, "updated_at": now}},
        )
    await db[LAYOUTS_COLLECTION].update_one(
        {"_id": layout_id},
        {"$set": {"slot_ids": slot_ids, "updated_at": now}},
    )
    return True


async def _migrate_sections_docs(db: Any) -> int:
    """Ensure homepage_page_sections docs include a ribbon before Live."""

    updated = 0
    async for doc in db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].find({}):
        items = list(doc.get("items") or [])
        migrated = _ensure_ribbon_before_live_items(items)
        if migrated == items:
            continue
        await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": doc["_id"]},
            {"$set": {"items": migrated, "updated_at": _utc_now_iso()}},
        )
        updated += 1
    return updated


async def run() -> dict[str, int | bool]:
    """Add a Government→Live ribbon across homepage layouts and section configs."""

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
        migrated_layouts = 0
        for layout_id in layout_ids:
            migrated_layouts += int(await _migrate_layout(db, layout_id))
        migrated_sections = await _migrate_sections_docs(db)
        if migrated_layouts or migrated_sections:
            from shared.core.events import publish_homepage_feed_invalidation

            await publish_homepage_feed_invalidation(all_markets=True)
        return {
            "matched_layouts": len(layout_ids),
            "migrated_layouts": migrated_layouts,
            "migrated_sections": migrated_sections,
            "cache_invalidated": bool(migrated_layouts or migrated_sections),
        }
    finally:
        client.close()


if __name__ == "__main__":
    print(asyncio.run(run()))
