"""Market read operations."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.read.collections import MARKETS_COLLECTION


async def get_market_by_code(db: AsyncIOMotorDatabase, code: str) -> dict[str, Any] | None:
    """Load a market document by its short code (e.g. us, co)."""

    normalized = code.strip().lower()
    if not normalized:
        return None
    return await db[MARKETS_COLLECTION].find_one({"code": normalized})
