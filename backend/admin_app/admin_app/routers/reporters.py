"""Reporter profile routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from admin_app.services import user_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.schemas.user_schemas import ReporterBioUpdate, UserOut

router = APIRouter(prefix="/reporters")


@router.get("", response_model=list[UserOut])
async def list_reporters(
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin", "editor")),
) -> list[UserOut]:
    """List users with reporter role."""

    users = await user_service.list_users(db)
    return [u for u in users if u.role == "reporter"]


@router.patch("/{reporter_id}/bio", response_model=UserOut)
async def update_reporter_bio(
    reporter_id: str,
    body: ReporterBioUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin", "editor", "reporter")),
) -> UserOut:
    """Update a reporter bio."""

    return await user_service.update_reporter_bio(db, reporter_id=reporter_id, bio=body.bio)

