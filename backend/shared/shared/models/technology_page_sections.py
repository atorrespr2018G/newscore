"""MongoDB technology page section list document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now
from shared.schemas.page_ad_placements_schemas import PageAdPlacementOut

TechnologyPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "archive",
    "ribbon_ad",
]


class TechnologyPageSectionItem(BaseModel):
    """One ordered section on a technology page (hero, band, live, archive, or ad)."""

    section_type: TechnologyPageSectionType = "archive"
    slug: str
    label: str

    model_config = {
        "extra": "forbid",
    }


class TechnologyPageSections(BaseModel):
    """Ordered technology page sections for a market or a state region.

    Market-level docs use ``region_id=None`` (countries without states, e.g. PR).
    State-level docs set ``region_id`` to the state region document id.
    """

    id: str = Field(..., alias="_id")
    market_id: str
    region_id: str | None = None
    items: list[TechnologyPageSectionItem] = []
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
