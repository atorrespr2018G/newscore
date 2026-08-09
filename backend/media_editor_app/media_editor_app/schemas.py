"""API contracts owned by the independent media-editor application."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

MediaType = Literal["image", "video"]
ProcessingStatus = Literal["ready", "processing", "failed"]
StoryStatus = Literal["draft", "ready"]

_MAX_VIDEO_SEGMENTS: int = 20


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


class VideoSegment(BaseModel):
    """One included time range from a source video, in seconds."""

    start_seconds: float = Field(ge=0)
    end_seconds: float = Field(gt=0)

    @model_validator(mode="after")
    def validate_range(self) -> "VideoSegment":
        """Ensure the segment has a positive duration."""

        if self.end_seconds <= self.start_seconds:
            raise ValueError("Segment end time must be after its start time")
        return self


class VideoEditInstruction(BaseModel):
    """Ordered segments (and optional overlays) for rendering one shorter MP4."""

    segments: list[VideoSegment] = Field(default_factory=list, max_length=_MAX_VIDEO_SEGMENTS)
    # Legacy single-trim fields — used when segments is empty.
    trim_start_seconds: float = Field(default=0, ge=0)
    trim_end_seconds: float | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, max_length=120)
    lower_third: str | None = Field(default=None, max_length=180)
    logo_url: HttpUrl | None = None

    @model_validator(mode="after")
    def ensure_segments(self) -> "VideoEditInstruction":
        """Require at least one segment, deriving from legacy trim fields when needed."""

        if self.segments:
            return self
        if self.trim_end_seconds is None:
            raise ValueError("Provide at least one segment (or trim_end_seconds)")
        self.segments = [
            VideoSegment(start_seconds=self.trim_start_seconds, end_seconds=self.trim_end_seconds),
        ]
        return self


_MAX_MERGE_VIDEOS: int = 20


class VideoMergeInstruction(BaseModel):
    """Ordered owned video asset IDs to concatenate into one MP4."""

    asset_ids: list[str] = Field(min_length=2, max_length=_MAX_MERGE_VIDEOS)

    @model_validator(mode="after")
    def validate_unique_ids(self) -> "VideoMergeInstruction":
        """Reject duplicate IDs in the merge order."""

        if len(self.asset_ids) != len(set(self.asset_ids)):
            raise ValueError("Merge asset IDs must be unique")
        return self
