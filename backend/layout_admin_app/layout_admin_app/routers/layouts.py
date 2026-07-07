"""Layout routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import layout_service, slot_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.exceptions import NotFoundError
from shared.core.regions import get_region_by_code, resolve_region_code_from_legacy
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.core.pagination import PaginationDep, PaginationParams
from shared.read.market_reads import get_market_by_code
from shared.schemas.common import PaginatedResponse
from shared.read.placement_reads import get_article_placements
from shared.read.site_reads import get_home_feed_preview
from shared.schemas.layout_schemas import (
    ArticlePlacementsOut,
    LayoutCreate,
    LayoutOut,
    LayoutUpdate,
    PublishPlacementsOut,
    SlotOut,
)

router = APIRouter(prefix="/layouts")


@router.post("", response_model=LayoutOut, status_code=status.HTTP_201_CREATED)
async def create_layout(
    body: LayoutCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> LayoutOut:
    """Create a layout."""

    return await layout_service.create(db, body, actor_id=current_user.sub)


@router.get("", response_model=PaginatedResponse)
async def list_layouts(
    db: AsyncIOMotorDatabase = Depends(get_db),
    pagination: PaginationParams = PaginationDep,
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> PaginatedResponse:
    """List layouts with pagination."""

    items, total = await layout_service.list_all(db, pagination)
    return PaginatedResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        has_more=(pagination.skip + len(items)) < total,
    )


@router.get("/placements", response_model=ArticlePlacementsOut)
async def get_layout_placements(
    market: str = Query(DEFAULT_MARKET_CODE),
    town: str | None = Query(None),
    region_code: str | None = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> ArticlePlacementsOut:
    """Resolve article placements across homepage and world layouts."""

    return ArticlePlacementsOut(
        placements=await get_article_placements(
            db,
            market_code=market,
            town=town,
            region_code=region_code,
        )
    )


@router.get("/preview-feed")
async def get_preview_feed(
    market: str = Query(DEFAULT_MARKET_CODE),
    town: str | None = Query(None),
    region_code: str | None = Query(None),
    page_name: str = Query("homepage"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> dict:
    """Return homepage feed preview with draft pins resolved (editor-only)."""

    return await get_home_feed_preview(
        db,
        market_code=market,
        town=town,
        region_code=region_code,
        page_name=page_name,
    )


@router.post("/publish-placements", response_model=PublishPlacementsOut)
async def publish_layout_placements(
    market: str = Query(DEFAULT_MARKET_CODE),
    town: str | None = Query(None),
    region_code: str | None = Query(None),
    page_name: str = Query("homepage"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> PublishPlacementsOut:
    """Promote staged homepage placements to the live layout."""

    return await layout_service.publish_placements(
        db,
        page_name=page_name,
        market_code=market,
        town=town,
        region_code=region_code,
        actor_id=current_user.sub,
    )


@router.get("/{layout_id}", response_model=LayoutOut)
async def get_layout(
    layout_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> LayoutOut:
    """Get a layout by id."""

    return await layout_service.get_by_id(db, layout_id)


@router.get("/page/{page_name}", response_model=LayoutOut)
async def get_layout_for_page(
    page_name: str,
    market: str = Query(DEFAULT_MARKET_CODE),
    town: str | None = Query(None),
    region_code: str | None = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> LayoutOut:
    """Get active layout for a page and market (public read)."""

    requested_region_code = (region_code or "").strip().lower() or None
    if not requested_region_code and town:
        requested_region_code = await resolve_region_code_from_legacy(
            db,
            market_code=market,
            town=town,
        )

    region_id: str | None = None
    if requested_region_code:
        region = await get_region_by_code(db, requested_region_code)
        if region is not None:
            region_id = str(region["_id"])

    market_doc = await get_market_by_code(db, market)
    if market_doc is None:
        raise NotFoundError("Market not found")
    return await layout_service.get_by_page_name(
        db,
        page_name,
        market_id=str(market_doc["_id"]),
        region_id=region_id,
    )


@router.get("/{layout_id}/slots", response_model=list[SlotOut])
async def list_slots_for_layout(
    layout_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[SlotOut]:
    """List slots for a layout (public read)."""

    return await slot_service.list_for_layout(db, layout_id)


@router.patch("/{layout_id}", response_model=LayoutOut)
async def update_layout(
    layout_id: str,
    body: LayoutUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> LayoutOut:
    """Update a layout."""

    return await layout_service.update(db, layout_id=layout_id, body=body, actor_id=current_user.sub)


@router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layout(
    layout_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> None:
    """Delete a layout and its slots."""

    await layout_service.delete(db, layout_id=layout_id, actor_id=current_user.sub)
