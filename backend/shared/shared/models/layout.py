"""MongoDB layout and slot document models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now


SlotContentType = Literal["articles", "breaking", "video", "ad"]


class Slot(BaseModel):
    """Represents a slot document as stored in MongoDB."""

    id: str = Field(..., alias="_id")
    layout_id: str
    position_key: str
    content_type: SlotContentType = "articles"
    display_name: str | None = None
    presentation_type: str = "grid_4"
    pinned_ids: list[str] = []
    draft_pinned_ids: list[str] | None = None
    query_rule: dict | None = None
    order_index: int = 0
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }


class Layout(BaseModel):
    """Represents a layout document as stored in MongoDB."""

    id: str = Field(..., alias="_id")
    page_name: str
    market_id: str | None = None
    slot_ids: list[str] = []
    is_active: bool = True
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }

