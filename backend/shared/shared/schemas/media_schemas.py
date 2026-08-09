"""Media request/response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


MediaType = Literal["image", "video"]


class MediaOut(BaseModel):
    """Response schema for a stored media asset."""

    id: str
    file_type: MediaType
    url: str
    width: int | None = None
    height: int | None = None
    duration: float | None = None
    uploader_id: str
    created_at: str


class MediaRegisterExternal(BaseModel):
    """Register an already-hosted image/video URL into News Storage media."""

    file_type: MediaType
    url: HttpUrl
    width: int | None = Field(default=None, ge=1)
    height: int | None = Field(default=None, ge=1)
    duration: float | None = Field(default=None, ge=0)
    source_asset_id: str | None = Field(default=None, min_length=1, max_length=80)

