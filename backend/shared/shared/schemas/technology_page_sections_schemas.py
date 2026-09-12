"""API schemas for market and region technology page section lists."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.schemas.page_ad_placements_schemas import PageAdPlacementIn, PageAdPlacementOut

TechnologyPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "archive",
    "ribbon_ad",
]


class TechnologyPageSectionItemIn(BaseModel):
    """Incoming technology page section (label required; slug optional and derived when omitted)."""

    section_type: TechnologyPageSectionType = "archive"
    label: str = Field(..., min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class TechnologyPageSectionItemOut(BaseModel):
    """Resolved technology page section returned to clients."""

    section_type: TechnologyPageSectionType
    slug: str
    label: str


class TechnologyPageSectionsOut(BaseModel):
    """Technology section list for one market or region scope."""

    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    items: list[TechnologyPageSectionItemOut]
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str


class TechnologyPageSectionsUpdate(BaseModel):
    """Replace the ordered technology page section list for a market or region."""

    items: list[TechnologyPageSectionItemIn]
    ads: list[PageAdPlacementIn] | None = None
