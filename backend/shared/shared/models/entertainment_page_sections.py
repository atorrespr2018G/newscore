"""MongoDB entertainment page section list document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now
from shared.schemas.page_ad_placements_schemas import PageAdPlacementOut

EntertainmentPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "entertainment",
    "ribbon_ad",
]


class EntertainmentPageSectionItem(BaseModel):
    """One ordered section on an entertainment page (hero, band, live, topic, or ad)."""

    section_type: EntertainmentPageSectionType = "entertainment"
    slug: str
    label: str

    model_config = {
        "extra": "forbid",
    }


class EntertainmentPageSections(BaseModel):
    """Ordered entertainment page sections for a market or a state region.

    Market-level docs use ``region_id=None`` (countries without states, e.g. PR).
    State-level docs set ``region_id`` to the state region document id.
    """

    id: str = Field(..., alias="_id")
    market_id: str
    region_id: str | None = None
    items: list[EntertainmentPageSectionItem] = []
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
