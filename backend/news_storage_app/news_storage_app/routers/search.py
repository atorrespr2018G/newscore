"""Search routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.services import search_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.pagination import PaginationDep, PaginationParams
from shared.schemas.common import PaginatedResponse

router = APIRouter()


@router.get("/search", response_model=PaginatedResponse)
async def search(
    q: str | None = Query(None, max_length=200),
    category_id: str | None = Query(None, max_length=100),
    created_from: str | None = Query(None, max_length=40),
    created_to: str | None = Query(None, max_length=40),
    article_id: str | None = Query(None, max_length=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    pagination: PaginationParams = PaginationDep,
    _: TokenPayload = Depends(require_role("reporter", "editor", "admin")),
) -> PaginatedResponse:
    """Search articles by title/slug, category, created-date range, or exact id.

    Filters combine with AND; a non-empty ``article_id`` overrides the others and
    matches across all statuses.
    """

    items, total = await search_service.search_articles(
        db,
        query=q,
        category_id=category_id,
        created_from=created_from,
        created_to=created_to,
        article_id=article_id,
        pagination=pagination,
    )
    return PaginatedResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        has_more=(pagination.skip + len(items)) < total,
    )
