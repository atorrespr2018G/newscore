"""Category routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.services import category_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.schemas.category_schemas import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories")


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> CategoryOut:
    """Create a category."""

    return await category_service.create(db, body)


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[CategoryOut]:
    """List categories (public)."""

    return await category_service.list_all(db)


@router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: str,
    body: CategoryUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> CategoryOut:
    """Update a category."""

    return await category_service.update(db, category_id=category_id, body=body)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> None:
    """Delete a category."""

    await category_service.delete(db, category_id=category_id)

