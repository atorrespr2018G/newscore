"""Media request/response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


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

