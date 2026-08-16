"""API schemas for market and region government page section lists."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.schemas.page_ad_placements_schemas import PageAdPlacementIn, PageAdPlacementOut

GovernmentPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "world",
    "topic",
    "ribbon_ad",
]


class GovernmentPageSectionItemIn(BaseModel):
    """Incoming government page section (label required; slug optional and derived when omitted)."""

    section_type: GovernmentPageSectionType = "topic"
    label: str = Field(..., min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class GovernmentPageSectionItemOut(BaseModel):
    """Resolved government page section returned to clients."""

    section_type: GovernmentPageSectionType
    slug: str
    label: str


class GovernmentPageSectionsOut(BaseModel):
    """Government section list for one market or region scope."""

    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    items: list[GovernmentPageSectionItemOut]
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str


class GovernmentPageSectionsUpdate(BaseModel):
    """Replace the ordered government page section list for a market or region."""

    items: list[GovernmentPageSectionItemIn]
    ads: list[PageAdPlacementIn] | None = None
