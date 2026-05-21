"""Search routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from delivery_app.services import cache_service, delivery_service
from shared.core.db import get_db
from shared.schemas.article_schemas import ArticleOut

router = APIRouter()

SEARCH_TTL_SECONDS = 20


@router.get("/search", response_model=list[ArticleOut])
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ArticleOut]:
    """Search published articles (cached)."""

    key = f"delivery:search:{q}"
    cached = await cache_service.get_json(key)
    if cached is not None:
        return [ArticleOut.model_validate(x) for x in cached]

    value = await delivery_service.search_published(db, query=q)
    await cache_service.set_json(key=key, value=[v.model_dump() for v in value], ttl_seconds=SEARCH_TTL_SECONDS)
    return value

