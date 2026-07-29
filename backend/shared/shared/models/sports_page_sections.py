"""MongoDB sports page section list document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now

SportsPageSectionType = Literal["hero", "top_stories", "live", "world", "sport"]


class SportsPageSectionItem(BaseModel):
    """One ordered section on a sports page (hero, band, live, world, or sport)."""

    section_type: SportsPageSectionType = "sport"
    slug: str
    label: str

    model_config = {
        "extra": "forbid",
    }


class SportsPageSections(BaseModel):
    """Ordered sports page sections for a market or a state region.

    Market-level docs use ``region_id=None`` (countries without states, e.g. PR).
    State-level docs set ``region_id`` to the state region document id.
    """

    id: str = Field(..., alias="_id")
    market_id: str
    region_id: str | None = None
    items: list[SportsPageSectionItem] = []
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
