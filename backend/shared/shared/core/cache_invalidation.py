"""Helpers to invalidate public read caches after editorial writes."""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.cache import invalidate_all_homepage_feeds, invalidate_homepage_feed
from shared.core.markets import DEFAULT_MARKET_CODE

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
    """Invalidate homepage feed cache for the given market ids."""

    codes = await market_codes_for_ids(db, market_ids)
    if not codes:
        await invalidate_all_homepage_feeds()
        return
    for code in codes:
        await invalidate_homepage_feed(code)


async def invalidate_homepage_for_layout(db: AsyncIOMotorDatabase, layout_id: str) -> None:
    """Invalidate homepage feed cache for the market tied to a layout."""

    layout = await db[LAYOUTS_COLLECTION].find_one({"_id": layout_id}, {"market_id": 1})
    if layout is None:
        await invalidate_all_homepage_feeds()
        return
    market_id = layout.get("market_id")
    if market_id:
        await invalidate_homepage_for_market_ids(db, [str(market_id)])
    else:
        await invalidate_homepage_feed(DEFAULT_MARKET_CODE)
