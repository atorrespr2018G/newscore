"""MongoDB category document model."""

from __future__ import annotations

from pydantic import BaseModel, Field

from shared.models.common import utc_now


class Category(BaseModel):
    """Represents a category document as stored in MongoDB."""

    id: str = Field(..., alias="_id")
    name: str
    slug: str
    parent_id: str | None = None
    description: str | None = None
    created_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }

