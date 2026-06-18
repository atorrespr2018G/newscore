"""Search routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.services import search_service
from shared.core.db import get_db
from shared.core.pagination import PaginationDep, PaginationParams
from shared.schemas.common import PaginatedResponse

router = APIRouter()


@router.get("/search", response_model=PaginatedResponse)
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
    pagination: PaginationParams = PaginationDep,
) -> PaginatedResponse:
    """Search articles by title or slug substring."""

    items, total = await search_service.search_articles(db, query=q, pagination=pagination)
    return PaginatedResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        has_more=(pagination.skip + len(items)) < total,
    )
