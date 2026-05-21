"""Media upload routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.services import media_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.schemas.media_schemas import MediaOut

router = APIRouter(prefix="/media")


@router.post("/image", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("reporter", "editor")),
) -> MediaOut:
    """Upload an image."""

    return await media_service.upload_image(db, file=file, uploader_id=current_user.sub)


@router.post("/video", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
async def upload_video(
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("reporter", "editor")),
) -> MediaOut:
    """Upload a video."""

    return await media_service.upload_video(db, file=file, uploader_id=current_user.sub)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    media_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("reporter", "editor")),
) -> None:
    """Delete a media asset."""

    await media_service.delete_media(db, media_id=media_id)

