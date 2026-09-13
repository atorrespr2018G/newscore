"""Remove the USA / Top Stories band from US-market homepage layouts only.

Puerto Rico and other markets keep the USA module. World page Top Stories
(``us-featured``) is left unchanged.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
MARKETS_COLLECTION = "markets"
HOMEPAGE_PAGE_SECTIONS_COLLECTION = "homepage_page_sections"
HOMEPAGE_PAGE_NAME = "homepage"
SECTION_TYPE_RIBBON_AD = "ribbon_ad"
US_MARKET_CODE = "us"
HERO_POSITION_KEY = "hero"
USA_HOMEPAGE_SECTION_KEYS = frozenset({"us-featured", "us"})


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


def _is_post_hero_ribbon(kept: list[dict[str, Any]]) -> bool:
    """Return whether the last kept slot is the ribbon immediately after Hero."""

    if len(kept) < 2 or not _is_ribbon_slot(kept[-1]):
        return False
    return str(kept[-2].get("position_key") or "") == HERO_POSITION_KEY


def _strip_usa_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop USA homepage rows and a non-post-hero ribbon immediately before them."""

    migrated: list[dict[str, Any]] = []
    for item in items:
        slug = str(item.get("slug") or "")
        if slug in USA_HOMEPAGE_SECTION_KEYS:
            preceding_is_post_hero = (
                len(migrated) >= 2
                and migrated[-1].get("section_type") == SECTION_TYPE_RIBBON_AD
                and migrated[-2].get("section_type") == "hero"
            )
            if (
                migrated
                and migrated[-1].get("section_type") == SECTION_TYPE_RIBBON_AD
                and not preceding_is_post_hero
            ):
                migrated.pop()
            continue
        migrated.append(dict(item))
    return migrated


async def _us_market_id(db: Any) -> str | None:
    """Return the USA market document id, if it exists."""

    market = await db[MARKETS_COLLECTION].find_one({"code": US_MARKET_CODE}, {"_id": 1})
    if market is None:
        return None
    return str(market["_id"])


async def _migrate_layout(db: Any, layout_id: str) -> bool:
    """Delete USA homepage slots and compact remaining order indexes."""

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
        if position_key in USA_HOMEPAGE_SECTION_KEYS:
            if kept and _is_ribbon_slot(kept[-1]) and not _is_post_hero_ribbon(kept):
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


async def _migrate_sections_docs(db: Any, market_id: str) -> int:
    """Strip USA rows from US-market homepage_page_sections documents."""

    updated = 0
    async for doc in db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].find({"market_id": market_id}):
        items = list(doc.get("items") or [])
        migrated = _strip_usa_items(items)
        if migrated == items:
            continue
        await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": doc["_id"]},
            {"$set": {"items": migrated, "updated_at": _utc_now_iso()}},
        )
        updated += 1
    return updated


async def run() -> dict[str, int | bool]:
    """Remove the USA section from USA homepage boards across regions."""

    client = AsyncIOMotorClient(_mongo_uri())
    try:
        db = client[_mongo_db_name()]
        market_id = await _us_market_id(db)
        if market_id is None:
            return {
                "matched_layouts": 0,
                "migrated_layouts": 0,
                "migrated_sections": 0,
                "cache_invalidated": False,
            }
        layout_ids = [
            str(layout["_id"])
            async for layout in db[LAYOUTS_COLLECTION].find(
                {
                    "page_name": HOMEPAGE_PAGE_NAME,
                    "is_active": True,
                    "market_id": market_id,
                },
                {"_id": 1},
            )
        ]
        migrated_layouts = 0
        for layout_id in layout_ids:
            migrated_layouts += int(await _migrate_layout(db, layout_id))
        migrated_sections = await _migrate_sections_docs(db, market_id)
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
