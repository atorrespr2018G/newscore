"""API schemas for custom tab page section lists."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.schemas.page_ad_placements_schemas import PageAdPlacementIn, PageAdPlacementOut

CustomPageSectionType = Literal[
    "hero",
    "top_stories",
    "live",
    "topic",
    "ribbon_ad",
]


class CustomPageSectionItemIn(BaseModel):
    """Incoming custom page section (label required; slug optional)."""

    section_type: CustomPageSectionType = "topic"
    label: str = Field(..., min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class CustomPageSectionItemOut(BaseModel):
    """Resolved custom page section returned to clients."""

    section_type: CustomPageSectionType
    slug: str
    label: str


class CustomPageSectionsOut(BaseModel):
    """Custom section list for one page name and geo scope."""

    page_name: str
    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    items: list[CustomPageSectionItemOut]
    ads: list[PageAdPlacementOut] = Field(default_factory=list)
    updated_at: str


class CustomPageSectionsUpdate(BaseModel):
    """Replace the ordered custom page section list for a scope."""

    items: list[CustomPageSectionItemIn]
    ads: list[PageAdPlacementIn] | None = None
