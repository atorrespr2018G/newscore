"""Tag routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.services import tag_service
from shared.core.db import get_db

router = APIRouter()


@router.get("/tags", response_model=list[str])
async def list_tags(db: AsyncIOMotorDatabase = Depends(get_db)) -> list[str]:
    """List distinct tags used by articles."""

    return await tag_service.list_tags(db)

