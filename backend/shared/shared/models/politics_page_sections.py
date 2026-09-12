"""MongoDB Politics page section list document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now
from shared.schemas.page_ad_placements_schemas import PageAdPlacementOut

PoliticsPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "more_top_stories",
    "spotlight",
    "rail",
    "category",
    "ribbon_ad",
]


class PoliticsPageSectionItem(BaseModel):
    """One ordered section on the Politics page."""

    section_type: PoliticsPageSectionType = "category"
    slug: str
    label: str

    model_config = {
        "extra": "forbid",
    }


class PoliticsPageSections(BaseModel):
    """Ordered Politics-page sections for a market or a geo region.

    Market-level docs use ``region_id=None``. Region docs set ``region_id`` to the
    state, county, or town region document id.
    """

    id: str = Field(..., alias="_id")
    market_id: str
    region_id: str | None = None
    items: list[PoliticsPageSectionItem] = []
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
