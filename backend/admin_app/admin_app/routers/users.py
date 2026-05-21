"""User and auth routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from admin_app.services import auth_service, user_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.schemas.user_schemas import LoginRequest, TokenResponse, UserCreate, UserOut, UserUpdate

router = APIRouter()


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> TokenResponse:
    """Issue a JWT for valid credentials."""

    return await auth_service.login(db, body)


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin")),
) -> UserOut:
    """Create a new user (admin only)."""

    return await user_service.create_user(db, body)


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin")),
) -> list[UserOut]:
    """List all users (admin only)."""

    return await user_service.list_users(db)


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin")),
) -> UserOut:
    """Update a user (admin only)."""

    return await user_service.update_user(db, user_id=user_id, body=body)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("admin")),
) -> None:
    """Delete a user (admin only)."""

    await user_service.delete_user(db, user_id=user_id)

