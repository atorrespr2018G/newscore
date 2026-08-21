"""API schemas for market and region entertainment page section lists."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.schemas.page_ad_placements_schemas import PageAdPlacementIn, PageAdPlacementOut

EntertainmentPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "entertainment",
    "ribbon_ad",
]


class EntertainmentPageSectionItemIn(BaseModel):
    """Incoming entertainment page section (label required; slug optional and derived when omitted)."""

    section_type: EntertainmentPageSectionType = "entertainment"
    label: str = Field(..., min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class EntertainmentPageSectionItemOut(BaseModel):
    """Resolved entertainment page section returned to clients."""

    section_type: EntertainmentPageSectionType
    slug: str
    label: str


class EntertainmentPageSectionsOut(BaseModel):
    """Entertainment section list for one market or region scope."""

    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    items: list[EntertainmentPageSectionItemOut]
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str


class EntertainmentPageSectionsUpdate(BaseModel):
    """Replace the ordered entertainment page section list for a market or region."""

    items: list[EntertainmentPageSectionItemIn]
    ads: list[PageAdPlacementIn] | None = None
