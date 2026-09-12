"""Collapse back-to-back homepage ribbon advertisement slots into one."""

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
PRESENTATION_RIBBON_AD = "ribbon_ad"


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


def _collapse_ribbon_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop consecutive ribbon_ad rows, keeping the first of each run."""

    migrated: list[dict[str, Any]] = []
    for item in items:
        if (
            item.get("section_type") == SECTION_TYPE_RIBBON_AD
            and migrated
            and migrated[-1].get("section_type") == SECTION_TYPE_RIBBON_AD
        ):
            continue
        migrated.append(dict(item))
    return migrated


async def _migrate_layout(db: Any, layout_id: str) -> bool:
    """Remove consecutive ribbon slots and compact remaining order indexes."""

    slots = [
        slot
        async for slot in db[SLOTS_COLLECTION]
        .find({"layout_id": layout_id})
        .sort("order_index", 1)
    ]
    kept: list[dict[str, Any]] = []
    remove_ids: list[Any] = []
    previous_was_ribbon = False
    for slot in slots:
        is_ribbon = _is_ribbon_slot(slot)
        if is_ribbon and previous_was_ribbon:
            remove_ids.append(slot["_id"])
            continue
        kept.append(slot)
        previous_was_ribbon = is_ribbon

    if not remove_ids:
        return False

    now = _utc_now_iso()
    await db[SLOTS_COLLECTION].delete_many({"_id": {"$in": remove_ids}})
    for order_index, slot in enumerate(kept):
        await db[SLOTS_COLLECTION].update_one(
            {"_id": slot["_id"]},
            {"$set": {"order_index": order_index, "updated_at": now}},
        )
    return True


async def _migrate_sections_docs(db: Any) -> int:
    """Collapse consecutive ribbons in stored homepage_page_sections documents."""

    updated = 0
    async for doc in db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].find({}):
        items = list(doc.get("items") or [])
        migrated = _collapse_ribbon_items(items)
        if migrated == items:
            continue
        await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": doc["_id"]},
            {"$set": {"items": migrated, "updated_at": _utc_now_iso()}},
        )
        updated += 1
    return updated


async def run() -> dict[str, int | bool]:
    """Collapse stacked homepage ribbons across layouts and section configs."""

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
