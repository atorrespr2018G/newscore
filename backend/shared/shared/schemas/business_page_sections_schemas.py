"""API schemas for market and region business page section lists."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.schemas.page_ad_placements_schemas import PageAdPlacementIn, PageAdPlacementOut

BusinessPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "business",
    "ribbon_ad",
]


class BusinessPageSectionItemIn(BaseModel):
    """Incoming business page section (label required; slug optional and derived when omitted)."""

    section_type: BusinessPageSectionType = "business"
    label: str = Field(..., min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class BusinessPageSectionItemOut(BaseModel):
    """Resolved business page section returned to clients."""

    section_type: BusinessPageSectionType
    slug: str
    label: str


class BusinessPageSectionsOut(BaseModel):
    """Business section list for one market or region scope."""

    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    items: list[BusinessPageSectionItemOut]
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str


class BusinessPageSectionsUpdate(BaseModel):
    """Replace the ordered business page section list for a market or region."""

    items: list[BusinessPageSectionItemIn]
    ads: list[PageAdPlacementIn] | None = None
