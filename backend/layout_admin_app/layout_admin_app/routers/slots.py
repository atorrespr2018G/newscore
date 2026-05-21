"""Slot routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import slot_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.schemas.layout_schemas import SlotCreate, SlotOut, SlotUpdate

router = APIRouter(prefix="/slots")


@router.post("", response_model=SlotOut, status_code=status.HTTP_201_CREATED)
async def create_slot(
    body: SlotCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> SlotOut:
    """Create a slot."""

    return await slot_service.create(db, body)


@router.patch("/{slot_id}", response_model=SlotOut)
async def update_slot(
    slot_id: str,
    body: SlotUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> SlotOut:
    """Update a slot."""

    return await slot_service.update(db, slot_id=slot_id, body=body)


@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_slot(
    slot_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> None:
    """Delete a slot."""

    await slot_service.delete(db, slot_id=slot_id)

