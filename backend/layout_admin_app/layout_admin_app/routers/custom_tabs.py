"""Custom tab registry routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import custom_tabs_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.schemas.custom_tabs_schemas import (
    CustomTabCreate,
    CustomTabListOut,
    CustomTabOut,
    CustomTabUpdate,
)

router = APIRouter(prefix="/custom-tabs")


@router.get("", response_model=CustomTabListOut)
async def list_custom_tabs(
    market: str | None = Query(
        None,
        description="When set, only tabs for this market code are returned",
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> CustomTabListOut:
    """Return custom tabs (filter by market for masthead More)."""

    return await custom_tabs_service.list_tabs(db, market_code=market)


@router.get("/{slug}", response_model=CustomTabOut)
async def get_custom_tab(
    slug: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> CustomTabOut:
    """Return one custom tab by slug."""

    return await custom_tabs_service.get_tab(db, slug)


@router.post("", response_model=CustomTabOut, status_code=201)
async def create_custom_tab(
    body: CustomTabCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> CustomTabOut:
    """Create a custom tab for one market and seed that market's geo boards."""

    return await custom_tabs_service.create_tab(db, body)


@router.patch("/{slug}", response_model=CustomTabOut)
async def update_custom_tab(
    slug: str,
    body: CustomTabUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> CustomTabOut:
    """Rename or reorder a custom tab."""

    return await custom_tabs_service.update_tab(db, slug, body)


@router.delete("/{slug}", status_code=204)
async def delete_custom_tab(
    slug: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> None:
    """Delete a custom tab and its market-scoped section documents."""

    await custom_tabs_service.delete_tab(db, slug)
