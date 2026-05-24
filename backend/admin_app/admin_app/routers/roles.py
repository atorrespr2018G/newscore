"""Role management routes."""

from __future__ import annotations

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from admin_app.services import user_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.schemas.user_schemas import UserOut, UserRoleType

router = APIRouter()


class AssignRoleRequest(BaseModel):
    """Request body for POST /users/{id}/role."""

    role: UserRoleType = Field(..., description="Role to assign")


@router.get("/roles", response_model=list[str])
async def list_roles() -> list[str]:
    """List supported roles."""

    return ["admin", "editor", "reporter", "viewer"]


@router.post("/users/{user_id}/role", response_model=UserOut)
async def assign_role(
    user_id: str,
    body: AssignRoleRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("admin")),
) -> UserOut:
    """Assign a role to a user (admin only)."""

    return await user_service.assign_role(db, user_id=user_id, role=body.role, actor_id=current_user.sub)

