"""API schemas for market and region health page section lists."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.schemas.page_ad_placements_schemas import PageAdPlacementIn, PageAdPlacementOut

HealthPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "health",
    "ribbon_ad",
]


class HealthPageSectionItemIn(BaseModel):
    """Incoming health page section (label required; slug optional and derived when omitted)."""

    section_type: HealthPageSectionType = "health"
    label: str = Field(..., min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class HealthPageSectionItemOut(BaseModel):
    """Resolved health page section returned to clients."""

    section_type: HealthPageSectionType
    slug: str
    label: str


class HealthPageSectionsOut(BaseModel):
    """Health section list for one market or region scope."""

    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    items: list[HealthPageSectionItemOut]
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str


class HealthPageSectionsUpdate(BaseModel):
    """Replace the ordered health page section list for a market or region."""

    items: list[HealthPageSectionItemIn]
    ads: list[PageAdPlacementIn] | None = None
