"""Helpers to invalidate public read caches after editorial writes."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.events import publish_homepage_feed_invalidation
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.core.regions import resolve_region_codes

MARKETS_COLLECTION = "markets"
LAYOUTS_COLLECTION = "layouts"


async def market_codes_for_ids(db: AsyncIOMotorDatabase, market_ids: list[str]) -> list[str]:
    """Resolve market document ids to lowercase market codes."""

    if not market_ids:
        return []
    cursor = db[MARKETS_COLLECTION].find({"_id": {"$in": market_ids}}, {"code": 1})
    codes: list[str] = []
    async for doc in cursor:
        code = str(doc.get("code") or "").strip().lower()
        if code:
            codes.append(code)
    return codes


async def invalidate_homepage_for_market_ids(
    db: AsyncIOMotorDatabase,
    market_ids: list[str],
) -> None:
    """Publish homepage feed cache invalidation for the given market ids."""

    codes = await market_codes_for_ids(db, market_ids)
    if not codes:
        await publish_homepage_feed_invalidation(all_markets=True)
        return
    await publish_homepage_feed_invalidation(market_codes=codes)


async def invalidate_homepage_for_region_ids(
    db: AsyncIOMotorDatabase,
    region_ids: list[str],
) -> None:
    """Publish homepage feed cache invalidation for the given region ids."""

    codes = await resolve_region_codes(db, region_ids)
    if not codes:
        return
    await publish_homepage_feed_invalidation(region_codes=codes)


async def invalidate_homepage_for_article(db: AsyncIOMotorDatabase, doc: dict[str, Any]) -> None:
    """Invalidate homepage feed cache for scopes affected by an article."""

    region_ids = [str(rid) for rid in (doc.get("effective_region_ids") or []) if str(rid).strip()]
    if region_ids:
        await invalidate_homepage_for_region_ids(db, region_ids)
        return

    market_ids = [str(mid) for mid in (doc.get("market_ids") or []) if str(mid).strip()]
    await invalidate_homepage_for_market_ids(db, market_ids)


async def invalidate_homepage_for_layout(db: AsyncIOMotorDatabase, layout_id: str) -> None:
    """Invalidate homepage feed cache for region or market tied to a layout."""

    layout = await db[LAYOUTS_COLLECTION].find_one({"_id": layout_id}, {"market_id": 1, "region_id": 1})
    if layout is None:
        await publish_homepage_feed_invalidation(all_markets=True)
        return

    region_id = layout.get("region_id")
    if region_id:
        await invalidate_homepage_for_region_ids(db, [str(region_id)])
        return

    market_id = layout.get("market_id")
    if market_id:
        await invalidate_homepage_for_market_ids(db, [str(market_id)])
    else:
        await publish_homepage_feed_invalidation(market_codes=[DEFAULT_MARKET_CODE])
