"""Category feed routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from delivery_app.services import cache_service, delivery_service
from shared.core.db import get_db
from shared.core.pagination import PaginationParams, get_pagination

router = APIRouter(prefix="/category")

CATEGORY_TTL_SECONDS = 30


@router.get("/{slug}")
async def get_category_articles(
    slug: str,
    params: PaginationParams = Depends(get_pagination),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Get paginated published articles for a category (cached)."""

    key = f"delivery:category:{slug}:p{params.page}:s{params.page_size}"
    cached = await cache_service.get_json(key)
    if cached is not None:
        return cached

    value = await delivery_service.list_category_articles(db, category_slug=slug, params=params)
    await cache_service.set_json(key=key, value=value.model_dump(), ttl_seconds=CATEGORY_TTL_SECONDS)
    return value.model_dump()

