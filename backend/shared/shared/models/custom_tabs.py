"""MongoDB custom tab registry document model."""

from __future__ import annotations

from pydantic import BaseModel, Field

from shared.models.common import utc_now


class CustomTab(BaseModel):
    """Admin-created category tab shown under masthead More and Configuration.

    Each tab belongs to one market and applies across that market's full geo tree
    (country, states/counties, or towns).
    """

    id: str = Field(..., alias="_id")
    slug: str
    label: str
    market_code: str
    sort_order: int = 0
    created_at: str = Field(default_factory=lambda: utc_now().isoformat())
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
