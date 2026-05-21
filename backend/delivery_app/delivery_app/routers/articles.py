"""Article read routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from delivery_app.services import cache_service, delivery_service
from shared.core.db import get_db
from shared.schemas.article_schemas import ArticleDetailOut

router = APIRouter(prefix="/articles")

ARTICLE_TTL_SECONDS = 60


@router.get("/{slug}", response_model=ArticleDetailOut)
async def get_article(slug: str, db: AsyncIOMotorDatabase = Depends(get_db)) -> ArticleDetailOut:
    """Get a published article by slug (cached)."""

    key = f"delivery:article:{slug}"
    cached = await cache_service.get_json(key)
    if cached is not None:
        return ArticleDetailOut.model_validate(cached)

    value = await delivery_service.get_article_by_slug(db, slug=slug)
    await cache_service.set_json(key=key, value=value.model_dump(), ttl_seconds=ARTICLE_TTL_SECONDS)
    return value

