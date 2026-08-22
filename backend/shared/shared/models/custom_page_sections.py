"""MongoDB custom page section list document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now
from shared.schemas.page_ad_placements_schemas import PageAdPlacementOut

CustomPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "topic",
    "ribbon_ad",
]


class CustomPageSectionItem(BaseModel):
    """One ordered section on a custom tab page."""

    section_type: CustomPageSectionType = "topic"
    slug: str
    label: str

    model_config = {
        "extra": "forbid",
    }


class CustomPageSections(BaseModel):
    """Ordered custom page sections for a page name and geo scope.

    Market-level docs use ``region_id=None``. Region boards set ``region_id``.
    """

    id: str = Field(..., alias="_id")
    page_name: str
    market_id: str
    region_id: str | None = None
    items: list[CustomPageSectionItem] = []
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
