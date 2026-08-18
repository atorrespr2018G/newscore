"""Paginated archive reads for pin-only landing pages."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.markets import DEFAULT_MARKET_CODE
from shared.core.page_ad_placements import (
    PAGE_NAME_TECHNOLOGY,
    TECHNOLOGY_ARCHIVE_POSITION_KEY,
)
from shared.core.pagination import PaginationParams
from shared.read.article_reads import article_detail_out
from shared.read.collections import ARTICLES_COLLECTION
from shared.read.layout_reads import get_active_layout
from shared.read.loaders import AuthorNameLoader
from shared.read.market_reads import get_market_by_code
from shared.schemas.article_schemas import ArticleDetailOut
from shared.schemas.common import PaginatedResponse


def _compact_pinned_ids(pinned_ids: list[Any]) -> list[str]:
    """Drop empty placeholders while preserving pin order."""

    return [str(article_id).strip() for article_id in pinned_ids if str(article_id).strip()]


def _empty_connection(params: PaginationParams) -> PaginatedResponse:
    """Build an empty paginated archive payload."""

    return PaginatedResponse(
        items=[],
        total=0,
        page=params.page,
        page_size=params.page_size,
        has_more=False,
    )


def _slot_for_position(layout: dict[str, Any], position_key: str) -> dict[str, Any] | None:
    """Find a layout slot by position key."""

    normalized_key = position_key.strip().lower() or TECHNOLOGY_ARCHIVE_POSITION_KEY
    return next(
        (
            row
            for row in layout["slots"]
            if str(row.get("position_key") or "").strip().lower() == normalized_key
        ),
        None,
    )


async def _canonical_page_layout(
    db: AsyncIOMotorDatabase,
    *,
    page_name: str,
) -> dict[str, Any] | None:
    """Load the US market-level layout used by market-agnostic pages."""

    market = await get_market_by_code(db, DEFAULT_MARKET_CODE)
    if market is None:
        return None
    return await get_active_layout(
        db,
        market_id=str(market["_id"]),
        region_id=None,
        page_name=page_name.strip().lower() or PAGE_NAME_TECHNOLOGY,
    )


async def _published_archive_page(
    db: AsyncIOMotorDatabase,
    *,
    pinned_ids: list[str],
    params: PaginationParams,
    loader: AuthorNameLoader | None,
) -> PaginatedResponse:
    """Page published pin members newest first, without a market filter."""

    query: dict[str, Any] = {"_id": {"$in": pinned_ids}, "status": "published"}
    total = await db[ARTICLES_COLLECTION].count_documents(query)
    cursor = (
        db[ARTICLES_COLLECTION]
        .find(query)
        .sort("published_at", -1)
        .skip(params.skip)
        .limit(params.page_size)
    )
    docs = [doc async for doc in cursor]
    names = loader or AuthorNameLoader(db)
    await names.load_many([str(doc["author_id"]) for doc in docs])
    items: list[ArticleDetailOut] = []
    for doc in docs:
        author = await names.load(str(doc["author_id"]))
        items.append(article_detail_out(doc, author_name=author))
    shown = (params.page - 1) * params.page_size + len(items)
    return PaginatedResponse(
        items=[item.model_dump() for item in items],
        total=total,
        page=params.page,
        page_size=params.page_size,
        has_more=shown < total,
    )


async def list_page_archive_articles(
    db: AsyncIOMotorDatabase,
    *,
    page_name: str = PAGE_NAME_TECHNOLOGY,
    position_key: str = TECHNOLOGY_ARCHIVE_POSITION_KEY,
    params: PaginationParams,
    loader: AuthorNameLoader | None = None,
) -> PaginatedResponse:
    """List stories inserted on a page archive slot, newest first.

    Membership comes from placement pins on the canonical (US, market-level)
    layout. Results are not filtered by market or by the homepage Technology
    category — only articles placed on this page are returned, ordered by
    ``published_at`` descending.

    Args:
        db: Database connection.
        page_name: Layout page name such as ``technology``.
        position_key: Archive slot position key.
        params: 1-indexed pagination parameters.
        loader: Optional author name loader.

    Returns:
        Paginated article details for the archive.
    """

    layout = await _canonical_page_layout(db, page_name=page_name)
    if layout is None:
        return _empty_connection(params)
    slot = _slot_for_position(layout, position_key)
    if slot is None:
        return _empty_connection(params)
    pinned_ids = _compact_pinned_ids(list(slot.get("pinned_ids") or []))
    if not pinned_ids:
        return _empty_connection(params)
    return await _published_archive_page(
        db,
        pinned_ids=pinned_ids,
        params=params,
        loader=loader,
    )
