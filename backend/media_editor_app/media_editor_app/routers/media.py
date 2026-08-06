"""Authenticated media, derivative, collection, and handoff endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from media_editor_app.auth import TokenPayload, require_role
from media_editor_app.database import get_database
from media_editor_app.schemas import (
    MediaAssetOut,
    MediaCollectionCreate,
    MediaCollectionOut,
    MediaCollectionUpdate,
    MediaListOut,
    MediaMetadataUpdate,
    VideoEditInstruction,
)
from media_editor_app.services import collection_service, media_service

router = APIRouter(prefix="/api/v1/media-editor", tags=["media-editor"])
_REPORTER_ACCESS = Depends(require_role("reporter", "editor"))


def _client_error(exc: Exception) -> HTTPException:
    """Map expected domain failures to a safe API response."""

    if isinstance(exc, LookupError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.post("/assets", response_model=MediaAssetOut, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaAssetOut:
    """Upload an image or video source asset."""

    try:
        return await media_service.upload_media(db, file=file, uploader_id=user.sub)
    except ValueError as exc:
        raise _client_error(exc) from exc


@router.get("/assets", response_model=MediaListOut)
async def browse_assets(
    cursor: str | None = None,
    file_type: str | None = Query(default=None, pattern="^(image|video)$"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaListOut:
    """Browse the caller's uploaded asset library."""

    items, next_cursor = await media_service.list_media(
        db, owner_id=user.sub, cursor=cursor, media_type=file_type,
    )
    return MediaListOut(items=items, next_cursor=next_cursor)


@router.get("/assets/{media_id}", response_model=MediaAssetOut)
async def read_asset(
    media_id: str, db: AsyncIOMotorDatabase = Depends(get_database), user: TokenPayload = _REPORTER_ACCESS,
) -> MediaAssetOut:
    """Return one caller-owned media asset."""

    try:
        return await media_service.get_media(db, media_id=media_id, owner_id=user.sub)
    except LookupError as exc:
        raise _client_error(exc) from exc


@router.patch("/assets/{media_id}", response_model=MediaAssetOut)
async def update_asset(
    media_id: str,
    payload: MediaMetadataUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaAssetOut:
    """Update editable newsroom metadata for one asset."""

    try:
        return await media_service.update_metadata(db, media_id=media_id, owner_id=user.sub, update=payload)
    except LookupError as exc:
        raise _client_error(exc) from exc


@router.delete("/assets/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    media_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> None:
    """Delete an owned original or edited media asset."""

    try:
        await media_service.delete_media(db, media_id=media_id, owner_id=user.sub)
    except LookupError as exc:
        raise _client_error(exc) from exc


@router.post("/assets/{media_id}/remove-background", response_model=MediaAssetOut)
async def remove_asset_background(
    media_id: str, db: AsyncIOMotorDatabase = Depends(get_database), user: TokenPayload = _REPORTER_ACCESS,
) -> MediaAssetOut:
    """Create a transparent image derivative with its background removed."""

    try:
        return await media_service.create_background_removed_version(db, media_id=media_id, owner_id=user.sub)
    except (LookupError, ValueError) as exc:
        raise _client_error(exc) from exc


@router.post("/assets/{media_id}/derivatives/image", response_model=MediaAssetOut)
async def save_image_derivative(
    media_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaAssetOut:
    """Save a browser-exported Filerobot image as an immutable version."""

    try:
        return await media_service.create_image_version(db, media_id=media_id, owner_id=user.sub, file=file)
    except (LookupError, ValueError) as exc:
        raise _client_error(exc) from exc


@router.post("/assets/{media_id}/render", response_model=MediaAssetOut)
async def render_asset_video(
    media_id: str,
    payload: VideoEditInstruction,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaAssetOut:
    """Render a basic FFmpeg video derivative."""

    try:
        return await media_service.create_video_version(
            db, media_id=media_id, owner_id=user.sub, instruction=payload,
        )
    except (LookupError, ValueError) as exc:
        raise _client_error(exc) from exc


@router.post("/collections", response_model=MediaCollectionOut, status_code=status.HTTP_201_CREATED)
async def create_collection(
    payload: MediaCollectionCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaCollectionOut:
    """Create a draft ordered media collection."""

    try:
        return await collection_service.create_collection(db, owner_id=user.sub, payload=payload)
    except ValueError as exc:
        raise _client_error(exc) from exc


@router.get("/collections", response_model=List[MediaCollectionOut])
async def browse_collections(
    db: AsyncIOMotorDatabase = Depends(get_database), user: TokenPayload = _REPORTER_ACCESS,
) -> list[MediaCollectionOut]:
    """List the caller's ordered media collections."""

    return await collection_service.list_collections(db, owner_id=user.sub)


@router.put("/collections/{collection_id}", response_model=MediaCollectionOut)
async def replace_collection(
    collection_id: str,
    payload: MediaCollectionUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaCollectionOut:
    """Replace a collection's title, metadata, order, and readiness state."""

    try:
        return await collection_service.update_collection(
            db, collection_id=collection_id, owner_id=user.sub, payload=payload,
        )
    except (LookupError, ValueError) as exc:
        raise _client_error(exc) from exc


@router.get("/handoff/collections/{collection_id}", response_model=MediaCollectionOut)
async def read_ready_handoff(
    collection_id: str, db: AsyncIOMotorDatabase = Depends(get_database), user: TokenPayload = _REPORTER_ACCESS,
) -> MediaCollectionOut:
    """Read a ready collection through the future editor handoff boundary."""

    try:
        return await collection_service.get_ready_collection(db, collection_id=collection_id, owner_id=user.sub)
    except LookupError as exc:
        raise _client_error(exc) from exc
