"""Search routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.services import search_service
from shared.core.db import get_db
from shared.schemas.article_schemas import ArticleOut

router = APIRouter()


@router.get("/search", response_model=list[ArticleOut])
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ArticleOut]:
    """Search articles using MongoDB full-text search."""

    return await search_service.search_articles(db, query=q)

