"""Remove Extra Stories, World watch, and Featured from homepage layouts."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
HOMEPAGE_PAGE_SECTIONS_COLLECTION = "homepage_page_sections"
HOMEPAGE_PAGE_NAME = "homepage"
SECTION_TYPE_RIBBON_AD = "ribbon_ad"
EXTRA_STORIES_POSITION_KEY = "more-top-stories-2"
WORLD_WATCH_POSITION_KEY = "midterm-elections-2"
FEATURED_RAIL_POSITION_KEY = "editorial-rail-2"
REMOVED_KEYS = frozenset(
    {
        EXTRA_STORIES_POSITION_KEY,
        WORLD_WATCH_POSITION_KEY,
        FEATURED_RAIL_POSITION_KEY,
    },
)


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
    return presentation == "ribbon_ad" or position_key.startswith("ad-ribbon")


def _strip_extra_stories_band_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop Extra Stories band rows and a ribbon immediately before Extra Stories."""

    migrated: list[dict[str, Any]] = []
    for item in items:
        slug = str(item.get("slug") or "")
        if slug in REMOVED_KEYS:
            if (
                slug == EXTRA_STORIES_POSITION_KEY
                and migrated
                and migrated[-1].get("section_type") == SECTION_TYPE_RIBBON_AD
            ):
                migrated.pop()
            continue
        migrated.append(dict(item))
    return migrated


async def _migrate_layout(db: Any, layout_id: str) -> bool:
    """Delete Extra Stories band slots and compact remaining order indexes."""

    slots = [
        slot
        async for slot in db[SLOTS_COLLECTION]
        .find({"layout_id": layout_id})
        .sort("order_index", 1)
    ]
    remove_ids: list[Any] = []
    kept: list[dict[str, Any]] = []
    for slot in slots:
        position_key = str(slot.get("position_key") or "")
        if position_key in REMOVED_KEYS:
            if (
                position_key == EXTRA_STORIES_POSITION_KEY
                and kept
                and _is_ribbon_slot(kept[-1])
            ):
                remove_ids.append(kept.pop()["_id"])
            remove_ids.append(slot["_id"])
            continue
        kept.append(slot)

    if not remove_ids:
        return False

    now = _utc_now_iso()
    await db[SLOTS_COLLECTION].delete_many({"_id": {"$in": remove_ids}})
    slot_ids: list[str] = []
    for order_index, slot in enumerate(kept):
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
    """Strip Extra Stories band rows from homepage_page_sections documents."""

    updated = 0
    async for doc in db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].find({}):
        items = list(doc.get("items") or [])
        migrated = _strip_extra_stories_band_items(items)
        if migrated == items:
            continue
        await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": doc["_id"]},
            {"$set": {"items": migrated, "updated_at": _utc_now_iso()}},
        )
        updated += 1
    return updated


async def run() -> dict[str, int | bool]:
    """Remove Extra Stories / World watch / Featured from homepage boards."""

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
