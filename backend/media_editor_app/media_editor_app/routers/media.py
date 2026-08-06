"""Authenticated media, story package, and handoff endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from media_editor_app.auth import TokenPayload, require_role
from media_editor_app.database import get_database
from media_editor_app.schemas import (
    MediaAssetOut,
    MediaListOut,
    MediaMetadataUpdate,
    MediaStoryCreate,
    MediaStoryOut,
    MediaStoryUpdate,
    MediaVersionListOut,
    VideoEditInstruction,
)
from media_editor_app.services import media_service, story_service

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
    story_id: str | None = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaAssetOut:
    """Upload an image or video and optionally attach it to a story originals pool."""

    try:
        asset = await media_service.upload_media(db, file=file, uploader_id=user.sub)
        if story_id:
            await story_service.add_asset_to_pool(
                db, story_id=story_id, owner_id=user.sub, asset_id=asset.id,
            )
        return asset
    except (LookupError, ValueError) as exc:
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


@router.get("/assets/{media_id}/versions", response_model=MediaVersionListOut)
async def browse_asset_versions(
    media_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaVersionListOut:
    """List the original upload and every edited version for one picture."""

    try:
        root_id, items = await media_service.list_versions(db, media_id=media_id, owner_id=user.sub)
        return MediaVersionListOut(root_id=root_id, items=items)
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


@router.post("/stories", response_model=MediaStoryOut, status_code=status.HTTP_201_CREATED)
async def create_story(
    payload: MediaStoryCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaStoryOut:
    """Create a draft story package with empty originals and report collections."""

    return await story_service.create_story(db, owner_id=user.sub, payload=payload)


@router.get("/stories", response_model=List[MediaStoryOut])
async def browse_stories(
    db: AsyncIOMotorDatabase = Depends(get_database), user: TokenPayload = _REPORTER_ACCESS,
) -> list[MediaStoryOut]:
    """List the caller's story media packages."""

    return await story_service.list_stories(db, owner_id=user.sub)


@router.get("/stories/{story_id}", response_model=MediaStoryOut)
async def read_story(
    story_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaStoryOut:
    """Return one owned story package."""

    try:
        return await story_service.get_story(db, story_id=story_id, owner_id=user.sub)
    except LookupError as exc:
        raise _client_error(exc) from exc


@router.put("/stories/{story_id}", response_model=MediaStoryOut)
async def replace_story(
    story_id: str,
    payload: MediaStoryUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    user: TokenPayload = _REPORTER_ACCESS,
) -> MediaStoryOut:
    """Replace story metadata, originals pool, report order, and readiness."""

    try:
        return await story_service.update_story(
            db, story_id=story_id, owner_id=user.sub, payload=payload,
        )
    except (LookupError, ValueError) as exc:
        raise _client_error(exc) from exc


@router.get("/handoff/stories/{story_id}", response_model=MediaStoryOut)
async def read_ready_handoff(
    story_id: str, db: AsyncIOMotorDatabase = Depends(get_database), user: TokenPayload = _REPORTER_ACCESS,
) -> MediaStoryOut:
    """Read a ready story through the future editor handoff boundary."""

    try:
        return await story_service.get_ready_story(db, story_id=story_id, owner_id=user.sub)
    except LookupError as exc:
        raise _client_error(exc) from exc
