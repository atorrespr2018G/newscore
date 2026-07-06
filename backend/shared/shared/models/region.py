"""MongoDB geographic region document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now


RegionKind = Literal[
    "world",
    "country",
    "state",
    "province",
    "county",
    "city",
    "town",
    "municipality",
    "district",
]


class Region(BaseModel):
    """Represents a hierarchical geographic region document."""

    id: str = Field(..., alias="_id")
    code: str = Field(..., min_length=1, max_length=120)
    name: str = Field(..., min_length=1, max_length=200)
    kind: RegionKind
    parent_id: str | None = None
    ancestor_ids: list[str] = []
    depth: int = 0
    path: str = Field(..., min_length=1, max_length=500)
    country_code: str | None = None
    is_active: bool = True
    default_locale: str | None = None
    labels: dict[str, str] = {}
    created_at: str = Field(default_factory=lambda: utc_now().isoformat())
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
