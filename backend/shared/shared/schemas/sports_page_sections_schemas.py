"""API schemas for market and region sports page section lists."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.schemas.page_ad_placements_schemas import PageAdPlacementIn, PageAdPlacementOut

SportsPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "world",
    "sport",
    "ribbon_ad",
]


class SportsPageSectionItemIn(BaseModel):
    """Incoming sports page section (label required; slug optional and derived when omitted)."""

    section_type: SportsPageSectionType = "sport"
    label: str = Field(..., min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class SportsPageSectionItemOut(BaseModel):
    """Resolved sports page section returned to clients."""

    section_type: SportsPageSectionType
    slug: str
    label: str


class SportsPageSectionsOut(BaseModel):
    """Sports section list for one market or region scope."""

    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    items: list[SportsPageSectionItemOut]
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str


class SportsPageSectionsUpdate(BaseModel):
    """Replace the ordered sports page section list for a market or region."""

    items: list[SportsPageSectionItemIn]
    ads: list[PageAdPlacementIn] | None = None
