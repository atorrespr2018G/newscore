"""Audit log routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from admin_app.services import audit_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.pagination import PaginationParams, get_pagination

router = APIRouter()


@router.get("/audit-logs")
async def list_audit_logs(
    params: PaginationParams = Depends(get_pagination),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin")),
) -> dict[str, Any]:
    """List audit logs (admin only)."""

    return await audit_service.list_events(db, params)

