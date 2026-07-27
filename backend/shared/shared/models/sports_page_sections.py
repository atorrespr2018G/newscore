"""MongoDB sports page section list document model."""

from __future__ import annotations

from pydantic import BaseModel, Field

from shared.models.common import utc_now


class SportsPageSectionItem(BaseModel):
    """One ordered sport row on a market sports page."""

    slug: str
    label: str

    model_config = {
        "extra": "forbid",
    }


class SportsPageSections(BaseModel):
    """Per-market ordered list of sports page section rows."""

    id: str = Field(..., alias="_id")
    market_id: str
    items: list[SportsPageSectionItem] = []
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
