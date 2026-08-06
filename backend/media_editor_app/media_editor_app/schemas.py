"""API contracts owned by the independent media-editor application."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

MediaType = Literal["image", "video"]
ProcessingStatus = Literal["ready", "processing", "failed"]
StoryStatus = Literal["draft", "ready"]


class MediaMetadataUpdate(BaseModel):
    """Editable newsroom metadata for a media asset."""

    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20_000)
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


class MediaStoryCreate(BaseModel):
    """Payload that creates a reporter story media package."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2_000)


class MediaStoryUpdate(BaseModel):
    """Payload that updates a story pool, selected report order, and readiness."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2_000)
    pool_asset_ids: list[str] = Field(default_factory=list, max_length=200)
    selected_asset_ids: list[str] = Field(default_factory=list, max_length=100)
    status: StoryStatus = "draft"

    @model_validator(mode="after")
    def validate_unique_ids(self) -> "MediaStoryUpdate":
        """Ensure pool and report ID lists do not contain duplicates."""

        if len(self.pool_asset_ids) != len(set(self.pool_asset_ids)):
            raise ValueError("Story pool asset IDs must be unique")
        if len(self.selected_asset_ids) != len(set(self.selected_asset_ids)):
            raise ValueError("Selected report asset IDs must be unique")
        return self


class MediaVersionListOut(BaseModel):
    """Original upload plus every edited version in one picture family."""

    root_id: str
    items: list[MediaAssetOut]


class MediaStoryOut(MediaStoryUpdate):
    """Serialized story package with originals pool and ordered report selection."""

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
