"""MongoDB media document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now


MediaType = Literal["image", "video"]


class MediaAsset(BaseModel):
    """Represents a media asset document as stored in MongoDB."""

    id: str = Field(..., alias="_id")
    file_type: MediaType
    url: str
    width: int | None = None
    height: int | None = None
    duration: float | None = None
    uploader_id: str
    created_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }

