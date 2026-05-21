"""Breaking news routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from delivery_app.services import cache_service, delivery_service
from shared.core.db import get_db

router = APIRouter()

BREAKING_CACHE_KEY = "delivery:breaking"
BREAKING_TTL_SECONDS = 10


@router.get("/breaking")
async def get_breaking(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict | None:
    """Return breaking news widget payload (cached)."""

    cached = await cache_service.get_json(BREAKING_CACHE_KEY)
    if cached is not None:
        return cached

    value = await delivery_service.get_breaking(db)
    await cache_service.set_json(key=BREAKING_CACHE_KEY, value=value, ttl_seconds=BREAKING_TTL_SECONDS)
    return value

