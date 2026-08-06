"""API contracts owned by the independent media-editor application."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

MediaType = Literal["image", "video"]
ProcessingStatus = Literal["ready", "processing", "failed"]
CollectionStatus = Literal["draft", "ready"]


class MediaMetadataUpdate(BaseModel):
    """Editable newsroom metadata for a media asset."""

    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2_000)
    alt_text: str | None = Field(default=None, max_length=500)
    credit: str | None = Field(default=None, max_length=200)
    tags: list[str] | None = Field(default=None, max_length=20)


class MediaAssetOut(MediaMetadataUpdate):
    """Serialized media asset returned to the standalone frontend."""

    id: str
    file_type: MediaType
    url: str
    preview_url: str | None = None
    original_filename: str
    uploader_id: str
    processing_status: ProcessingStatus
    width: int | None = None
    height: int | None = None
    duration: float | None = None
    version_of: str | None = None
    created_at: str


class MediaListOut(BaseModel):
    """Paginated media-library result."""

    items: list[MediaAssetOut]
    next_cursor: str | None = None


class MediaCollectionCreate(BaseModel):
    """Payload that creates a reporter-owned ordered media collection."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2_000)
    asset_ids: list[str] = Field(default_factory=list, max_length=100)


class MediaCollectionUpdate(MediaCollectionCreate):
    """Payload that replaces editable collection fields and ordering."""

    status: CollectionStatus = "draft"


class MediaCollectionOut(MediaCollectionUpdate):
    """Serialized ordered collection for newsroom handoff."""

    id: str
    owner_id: str
    created_at: str
    updated_at: str


class VideoEditInstruction(BaseModel):
    """Validated render instruction for the first video-editor release."""

    trim_start_seconds: float = Field(default=0, ge=0)
    trim_end_seconds: float | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, max_length=120)
    lower_third: str | None = Field(default=None, max_length=180)
    logo_url: HttpUrl | None = None
