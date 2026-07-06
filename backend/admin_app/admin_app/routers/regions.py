"""Region administration routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from admin_app.services import region_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.schemas.region_schemas import RegionCreate, RegionMove, RegionOut, RegionUpdate

router = APIRouter(prefix="/regions")


@router.get("", response_model=list[RegionOut])
async def list_regions(
    parent_id: str | None = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin", "editor")),
) -> list[RegionOut]:
    """List regions under a parent id (or roots when parent_id is null)."""

    return await region_service.list_regions(db, parent_id=parent_id)


@router.get("/{region_id}", response_model=RegionOut)
async def get_region(
    region_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin", "editor")),
) -> RegionOut:
    """Get a region by id."""

    return await region_service.get_region(db, region_id)


@router.post("", response_model=RegionOut, status_code=status.HTTP_201_CREATED)
async def create_region(
    body: RegionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin")),
) -> RegionOut:
    """Create a region node."""

    return await region_service.create_region(db, body)


@router.patch("/{region_id}", response_model=RegionOut)
async def update_region(
    region_id: str,
    body: RegionUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin")),
) -> RegionOut:
    """Update mutable region fields."""

    return await region_service.update_region(db, region_id, body)


@router.post("/{region_id}/move", response_model=RegionOut)
async def move_region(
    region_id: str,
    body: RegionMove,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin")),
) -> RegionOut:
    """Re-parent a region node and recompute descendants."""

    return await region_service.move_region(db, region_id, body)
