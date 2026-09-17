"""Restore Top Stories (us-featured) on US-market homepage layouts and configs.

Earlier migrations stripped ``us-featured`` together with the trailing US
category. Top Stories belongs on every market homepage, including US.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient

LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
MARKETS_COLLECTION = "markets"
HOMEPAGE_PAGE_SECTIONS_COLLECTION = "homepage_page_sections"
HOMEPAGE_PAGE_NAME = "homepage"
US_MARKET_CODE = "us"
HERO_POSITION_KEY = "hero"
US_FEATURED_POSITION_KEY = "us-featured"
SECTION_TYPE_TOP_STORIES = "top_stories"
SECTION_TYPE_HERO = "hero"
SECTION_TYPE_RIBBON_AD = "ribbon_ad"
PRESENTATION_FEATURED_BAND = "featured_band"
TOP_STORIES_LABEL = "Top Stories"
TOP_STORIES_ARTICLE_LIMIT = 12


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


def _ensure_top_stories_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Insert Top Stories after the post-hero ribbon when missing."""

    if any(str(item.get("slug") or "") == US_FEATURED_POSITION_KEY for item in items):
        return list(items)

    top_stories = {
        "section_type": SECTION_TYPE_TOP_STORIES,
        "slug": US_FEATURED_POSITION_KEY,
        "label": TOP_STORIES_LABEL,
    }
    migrated: list[dict[str, Any]] = []
    inserted = False
    for index, item in enumerate(items):
        migrated.append(dict(item))
        if inserted:
            continue
        next_item = items[index + 1] if index + 1 < len(items) else None
        if item.get("section_type") == SECTION_TYPE_HERO:
            if next_item is None or next_item.get("section_type") != SECTION_TYPE_RIBBON_AD:
                migrated.append(dict(top_stories))
                inserted = True
            continue
        if (
            item.get("section_type") == SECTION_TYPE_RIBBON_AD
            and index > 0
            and items[index - 1].get("section_type") == SECTION_TYPE_HERO
        ):
            migrated.append(dict(top_stories))
            inserted = True
    if not inserted:
        migrated.insert(0, dict(top_stories))
    return migrated


async def _us_market_ids(db: Any) -> set[str]:
    """Return market document ids for the US market code."""

    ids: set[str] = set()
    async for market in db[MARKETS_COLLECTION].find(
        {"code": US_MARKET_CODE},
        {"_id": 1},
    ):
        ids.add(str(market["_id"]))
    return ids


async def _migrate_layout(db: Any, layout_id: str) -> bool:
    """Insert Top Stories when missing, and repair blank content_type on it."""

    slots = [
        slot
        async for slot in db[SLOTS_COLLECTION]
        .find({"layout_id": layout_id})
        .sort("order_index", 1)
    ]
    existing = next(
        (
            slot
            for slot in slots
            if str(slot.get("position_key") or "") == US_FEATURED_POSITION_KEY
        ),
        None,
    )
    now = _utc_now_iso()
    if existing is not None:
        content_type = str(existing.get("content_type") or "").strip().lower()
        if content_type == "articles":
            return False
        await db[SLOTS_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": {"content_type": "articles", "updated_at": now}},
        )
        return True

    insert_at = 0
    for index, slot in enumerate(slots):
        position_key = str(slot.get("position_key") or "")
        presentation = str(slot.get("presentation_type") or "").strip().lower()
        if position_key == HERO_POSITION_KEY:
            next_slot = slots[index + 1] if index + 1 < len(slots) else None
            next_is_ribbon = next_slot is not None and (
                str(next_slot.get("presentation_type") or "").strip().lower() == "ribbon_ad"
                or str(next_slot.get("position_key") or "").startswith("ad-ribbon")
            )
            insert_at = index + 2 if next_is_ribbon else index + 1
            break
        if presentation == "ribbon_ad" or position_key.startswith("ad-ribbon"):
            insert_at = index + 1

    slot_id = str(uuid4())
    top_stories_slot = {
        "_id": slot_id,
        "layout_id": layout_id,
        "position_key": US_FEATURED_POSITION_KEY,
        "order_index": insert_at,
        "display_name": TOP_STORIES_LABEL,
        "presentation_type": PRESENTATION_FEATURED_BAND,
        "content_type": "articles",
        "query_rule": {"mode": "latest", "limit": TOP_STORIES_ARTICLE_LIMIT},
        "pinned_article_ids": [],
        "pinned_ids": [],
        "draft_pinned_ids": [],
        "created_at": now,
        "updated_at": now,
    }
    await db[SLOTS_COLLECTION].insert_one(top_stories_slot)

    reordered = slots[:insert_at] + [top_stories_slot] + slots[insert_at:]
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


async def _migrate_sections_docs(db: Any, us_market_ids: set[str]) -> int:
    """Restore Top Stories in US-market homepage_page_sections documents."""

    updated = 0
    async for doc in db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].find({}):
        market_id = str(doc.get("market_id") or "")
        if market_id not in us_market_ids:
            continue
        items = list(doc.get("items") or [])
        migrated = _ensure_top_stories_items(items)
        if migrated == items:
            continue
        await db[HOMEPAGE_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": doc["_id"]},
            {"$set": {"items": migrated, "updated_at": _utc_now_iso()}},
        )
        updated += 1
    return updated


async def run() -> dict[str, int | bool]:
    """Restore Top Stories on US homepage layouts and section configs."""

    client = AsyncIOMotorClient(_mongo_uri())
    try:
        db = client[_mongo_db_name()]
        us_market_ids = await _us_market_ids(db)
        layout_ids = [
            str(layout["_id"])
            async for layout in db[LAYOUTS_COLLECTION].find(
                {
                    "page_name": HOMEPAGE_PAGE_NAME,
                    "is_active": True,
                    "market_id": {"$in": list(us_market_ids)},
                },
                {"_id": 1},
            )
        ]
        migrated_layouts = 0
        for layout_id in layout_ids:
            migrated_layouts += int(await _migrate_layout(db, layout_id))
        migrated_sections = await _migrate_sections_docs(db, us_market_ids)
        cache_invalidated = False
        if migrated_layouts or migrated_sections:
            try:
                from shared.core.events import publish_homepage_feed_invalidation

                await publish_homepage_feed_invalidation(all_markets=True)
                cache_invalidated = True
            except ImportError:
                # One-off runs may not have editable shared installed; data is still restored.
                cache_invalidated = False
        return {
            "matched_layouts": len(layout_ids),
            "migrated_layouts": migrated_layouts,
            "migrated_sections": migrated_sections,
            "cache_invalidated": cache_invalidated,
        }
    finally:
        client.close()


if __name__ == "__main__":
    print(asyncio.run(run()))
