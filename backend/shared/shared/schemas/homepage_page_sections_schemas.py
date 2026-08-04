"""API schemas for market and region main (homepage) page section lists."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.schemas.page_ad_placements_schemas import PageAdPlacementIn, PageAdPlacementOut

HomepagePageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "more_top_stories",
    "spotlight",
    "rail",
    "category",
]


class HomepagePageSectionItemIn(BaseModel):
    """Incoming main-page section (label required; slug optional and derived when omitted)."""

    section_type: HomepagePageSectionType = "category"
    label: str = Field(..., min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class HomepagePageSectionItemOut(BaseModel):
    """Resolved main-page section returned to clients."""

    section_type: HomepagePageSectionType
    slug: str
    label: str


class HomepagePageSectionsOut(BaseModel):
    """Main-page section list for one market or region scope."""

    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    items: list[HomepagePageSectionItemOut]
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str


class HomepagePageSectionsUpdate(BaseModel):
    """Replace the ordered main-page section list for a market or region."""

    items: list[HomepagePageSectionItemIn]
    ads: list[PageAdPlacementIn] | None = None
