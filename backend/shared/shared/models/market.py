"""MongoDB market (edition) document model."""

from __future__ import annotations

from pydantic import BaseModel, Field

from shared.models.common import utc_now


class Market(BaseModel):
    """Geographic or editorial edition (e.g. USA, Colombia)."""

    id: str = Field(..., alias="_id")
    code: str = Field(..., min_length=2, max_length=16)
    country: str
    default_locale: str = "en-US"
    label: str
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
