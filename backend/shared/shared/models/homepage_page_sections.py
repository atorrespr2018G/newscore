"""MongoDB main (homepage) page section list document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now

HomepagePageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "more_top_stories",
    "spotlight",
    "rail",
    "category",
]


class HomepagePageSectionItem(BaseModel):
    """One ordered section on the main landing page."""

    section_type: HomepagePageSectionType = "category"
    slug: str
    label: str

    model_config = {
        "extra": "forbid",
    }


class HomepagePageSections(BaseModel):
    """Ordered main-page sections for a market or a geo region.

    Market-level docs use ``region_id=None``. Region docs set ``region_id`` to the
    state, county, or town region document id.
    """

    id: str = Field(..., alias="_id")
    market_id: str
    region_id: str | None = None
    items: list[HomepagePageSectionItem] = []
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
