"""API schemas for geo-scoped landing page enablement."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PageVisibilityOut(BaseModel):
    """Enablement for one landing page at one market/region scope."""

    page_name: str
    market_id: str
    market_code: str
    region_id: str | None = None
    region_code: str | None = None
    is_enabled: bool = True
    is_effectively_enabled: bool = True
    disabled_by_region_code: str | None = None
    inherited: bool = False
    updated_at: str


class PageVisibilityUpdate(BaseModel):
    """Set whether a landing page is enabled at the selected geo."""

    is_enabled: bool = Field(..., description="False hides the page here and in nested geos.")
