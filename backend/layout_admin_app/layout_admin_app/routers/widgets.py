"""Widget routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import widget_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db

router = APIRouter(prefix="/widgets")


@router.get("/breaking")
async def get_breaking_widget(db: AsyncIOMotorDatabase = Depends(get_db)) -> dict[str, Any] | None:
    """Get breaking-news widget payload."""

    return await widget_service.get_widget(db, widget_key="breaking")


@router.put("/breaking")
async def set_breaking_widget(
    payload: dict[str, Any] = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> dict[str, Any]:
    """Set breaking-news widget payload."""

    return await widget_service.set_widget(db, widget_key="breaking", payload=payload)

