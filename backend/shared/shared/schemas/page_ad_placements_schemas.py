"""API schemas for page-level ad placements on Configuration pages."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

AdType = Literal["leaderboard", "ribbon", "rail", "tall", "square"]

AdLocation = Literal[
    "masthead",
    "after_hero",
    "before_section",
    "after_section",
    "hero_rail",
    "us_band",
    "editorial_band",
    "health_carousel",
]


class PageAdPlacementIn(BaseModel):
    """Incoming page ad placement from Configuration."""

    ad_type: AdType = "leaderboard"
    location: AdLocation
    enabled: bool = True
    anchor_slug: str | None = Field(default=None, max_length=80)


class PageAdPlacementOut(BaseModel):
    """Resolved page ad placement returned to clients and feeds."""

    ad_type: AdType
    location: AdLocation
    enabled: bool = True
    anchor_slug: str | None = None
