"""Homepage feed routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from delivery_app.services import cache_service, delivery_service
from shared.core.db import get_db

router = APIRouter()

FEED_CACHE_KEY = "delivery:feed:homepage"
FEED_TTL_SECONDS = 15


@router.get("/feed")
async def get_feed(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict:
    """Return the homepage feed (cached)."""

    cached = await cache_service.get_json(FEED_CACHE_KEY)
    if cached is not None:
        return cached

    value = await delivery_service.get_home_feed(db)
    await cache_service.set_json(key=FEED_CACHE_KEY, value=value, ttl_seconds=FEED_TTL_SECONDS)
    return value

