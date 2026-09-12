"""API schemas for market and region Politics page section lists."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.schemas.page_ad_placements_schemas import PageAdPlacementIn, PageAdPlacementOut

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


class PoliticsPageSectionItemIn(BaseModel):
    """Incoming Politics-page section (label required; slug optional and derived when omitted)."""

    section_type: PoliticsPageSectionType = "category"
    label: str = Field(..., min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class PoliticsPageSectionItemOut(BaseModel):
    """Resolved Politics-page section returned to clients."""

    section_type: PoliticsPageSectionType
    slug: str
    label: str


class PoliticsPageSectionsOut(BaseModel):
    """Politics-page section list for one market or region scope."""

    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    items: list[PoliticsPageSectionItemOut]
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str


class PoliticsPageSectionsUpdate(BaseModel):
    """Replace the ordered Politics-page section list for a market or region."""

    items: list[PoliticsPageSectionItemIn]
    ads: list[PageAdPlacementIn] | None = None
