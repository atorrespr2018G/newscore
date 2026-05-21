"""Layout routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import layout_service, slot_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.schemas.layout_schemas import LayoutCreate, LayoutOut, LayoutUpdate, SlotOut

router = APIRouter(prefix="/layouts")


@router.post("", response_model=LayoutOut, status_code=status.HTTP_201_CREATED)
async def create_layout(
    body: LayoutCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> LayoutOut:
    """Create a layout."""

    return await layout_service.create(db, body)


@router.get("", response_model=list[LayoutOut])
async def list_layouts(
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> list[LayoutOut]:
    """List layouts."""

    return await layout_service.list_all(db)


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
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> LayoutOut:
    """Get active layout for a page (public read)."""

    return await layout_service.get_by_page_name(db, page_name)


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
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> LayoutOut:
    """Update a layout."""

    return await layout_service.update(db, layout_id=layout_id, body=body)


@router.delete("/{layout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_layout(
    layout_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> None:
    """Delete a layout and its slots."""

    await layout_service.delete(db, layout_id=layout_id)

