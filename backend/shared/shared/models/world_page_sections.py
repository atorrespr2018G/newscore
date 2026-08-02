"""MongoDB World page section list document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now

WorldPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "more_top_stories",
    "spotlight",
    "rail",
    "category",
]


class WorldPageSectionItem(BaseModel):
    """One ordered section on the World page."""

    section_type: WorldPageSectionType = "category"
    slug: str
    label: str

    model_config = {
        "extra": "forbid",
    }


class WorldPageSections(BaseModel):
    """Ordered World-page sections for a market or a geo region.

    Market-level docs use ``region_id=None``. Region docs set ``region_id`` to the
    state, county, or town region document id.
    """

    id: str = Field(..., alias="_id")
    market_id: str
    region_id: str | None = None
    items: list[WorldPageSectionItem] = []
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
