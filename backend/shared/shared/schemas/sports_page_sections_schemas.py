"""API schemas for market and region sports page section lists."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SportsPageSectionItemIn(BaseModel):
    """Incoming sport row (label required; slug optional and derived when omitted)."""

    label: str = Field(..., min_length=1, max_length=80)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class SportsPageSectionItemOut(BaseModel):
    """Resolved sport row returned to clients."""

    slug: str
    label: str


class SportsPageSectionsOut(BaseModel):
    """Sports section list for one market or region scope."""

    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    items: list[SportsPageSectionItemOut]
    updated_at: str


class SportsPageSectionsUpdate(BaseModel):
    """Replace the ordered sports section list for a market or region."""

    items: list[SportsPageSectionItemIn]
