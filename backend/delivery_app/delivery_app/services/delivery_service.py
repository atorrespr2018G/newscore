"""Public read-only aggregation service (delegates to shared read layer)."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.pagination import PaginationParams
from shared.read import article_reads, site_reads
from shared.schemas.article_schemas import ArticleDetailOut
from shared.schemas.common import PaginatedResponse


async def get_article_by_slug(db: AsyncIOMotorDatabase, *, slug: str) -> ArticleDetailOut:
    """Load a published article by slug."""

    return await article_reads.get_article_by_slug(db, slug=slug)


async def list_category_articles(
    db: AsyncIOMotorDatabase,
    *,
    category_slug: str,
    params: PaginationParams,
) -> PaginatedResponse:
    """List published articles in a category."""

    return await article_reads.list_category_articles(db, category_slug=category_slug, params=params)


async def search_published(db: AsyncIOMotorDatabase, *, query: str) -> list:
    """Search published articles."""

    items = await article_reads.search_published(db, query=query)
    return items


async def get_breaking(db: AsyncIOMotorDatabase) -> dict[str, Any] | None:
    """Load breaking news widget."""

    return await site_reads.get_breaking(db)


async def get_home_feed(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    """Assemble homepage feed."""

    return await site_reads.get_home_feed(db, market_code="us")
