"""Reporter profile routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from admin_app.services import user_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.exceptions import PermissionError
from shared.core.pagination import PaginationDep, PaginationParams
from shared.schemas.common import PaginatedResponse
from shared.schemas.user_schemas import ReporterBioUpdate, UserOut

router = APIRouter(prefix="/reporters")


@router.get("", response_model=PaginatedResponse)
async def list_reporters(
    db: AsyncIOMotorDatabase = Depends(get_db),
    pagination: PaginationParams = PaginationDep,
    _: TokenPayload = Depends(require_role("admin", "editor")),
) -> PaginatedResponse:
    """List users with reporter role."""

    items, total = await user_service.list_reporters(db, pagination)
    return PaginatedResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        has_more=(pagination.skip + len(items)) < total,
    )


@router.patch("/{reporter_id}/bio", response_model=UserOut)
async def update_reporter_bio(
    reporter_id: str,
    body: ReporterBioUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("admin", "editor", "reporter")),
) -> UserOut:
    """Update a reporter bio."""

    if current_user.role == "reporter" and current_user.sub != reporter_id:
        raise PermissionError("Cannot update another reporter's bio")

    return await user_service.update_reporter_bio(db, reporter_id=reporter_id, bio=body.bio)
