"""Seed Style and Travel landing layouts for every market.

Copies the Technology hero/Top Stories/Live/archive stack onto ``style`` and
``travel`` page names so homepage headings open working landings.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from seed_dev import (
    STYLE_CATEGORY_SLUG,
    TRAVEL_CATEGORY_SLUG,
    _ensure_market_style_page,
    _ensure_market_travel_page,
)

CATEGORIES_COLLECTION = "categories"
MARKETS_COLLECTION = "markets"


def _mongo_uri() -> str:
    """Resolve Mongo connection URI from the environment."""

    value = os.getenv("MONGO_URI")
    if not value:
        raise RuntimeError("Missing MONGO_URI")
    return value


def _mongo_db_name() -> str:
    """Resolve Mongo database name from the environment."""

    value = os.getenv("MONGO_DB_NAME")
    if not value:
        raise RuntimeError("Missing MONGO_DB_NAME")
    return value


async def _slug_to_category_id(db: Any) -> dict[str, str]:
    """Map category slugs to document ids.

    Args:
        db: Mongo database.

    Returns:
        Slug to category id map.
    """

    cursor = db[CATEGORIES_COLLECTION].find({}, {"slug": 1})
    return {str(doc["slug"]): str(doc["_id"]) async for doc in cursor}


async def _ensure_market_landings(
    db: Any,
    market: dict[str, Any],
    slug_to_id: dict[str, str],
) -> None:
    """Create Style and Travel landings for one market.

    Args:
        db: Mongo database.
        market: Market document.
        slug_to_id: Category slug to id map.
    """

    display_name_key = str(market.get("display_name_key") or "display_name_us")
    market_id = str(market["_id"])
    market_code = str(market.get("code") or "")
    await _ensure_market_style_page(
        db,
        market_id=market_id,
        market_code=market_code,
        display_name_key=display_name_key,
        slug_to_category_id=slug_to_id,
    )
    await _ensure_market_travel_page(
        db,
        market_id=market_id,
        market_code=market_code,
        display_name_key=display_name_key,
        slug_to_category_id=slug_to_id,
    )


async def run() -> dict[str, Any]:
    """Create Style and Travel landing layouts for each market.

    Returns:
        Count of markets processed.
    """

    client = AsyncIOMotorClient(_mongo_uri())
    try:
        db = client[_mongo_db_name()]
        slug_to_id = await _slug_to_category_id(db)
        if STYLE_CATEGORY_SLUG not in slug_to_id or TRAVEL_CATEGORY_SLUG not in slug_to_id:
            raise RuntimeError("Missing style or travel category")
        markets = [doc async for doc in db[MARKETS_COLLECTION].find({})]
        for market in markets:
            await _ensure_market_landings(db, market, slug_to_id)
        return {"markets": len(markets)}
    finally:
        client.close()


if __name__ == "__main__":
    print(asyncio.run(run()))
