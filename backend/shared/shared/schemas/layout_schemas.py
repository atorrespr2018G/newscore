"""Layout and slot request/response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SlotContentType = Literal["articles", "breaking", "video", "ad"]


class LayoutCreate(BaseModel):
    """Request body for POST /layouts."""

    page_name: str = Field(..., min_length=1, max_length=120)
    is_active: bool = True


class LayoutUpdate(BaseModel):
    """Request body for PATCH /layouts/{id}."""

    is_active: bool | None = None


class LayoutOut(BaseModel):
    """Response schema for layouts."""

    id: str
    page_name: str
    slot_ids: list[str]
    is_active: bool
    updated_at: str


class SlotCreate(BaseModel):
    """Request body for POST /slots."""

    layout_id: str
    position_key: str = Field(..., min_length=1, max_length=120)
    content_type: SlotContentType = "articles"
    order_index: int = 0


class SlotUpdate(BaseModel):
    """Request body for PATCH /slots/{id}."""

    position_key: str | None = Field(None, min_length=1, max_length=120)
    content_type: SlotContentType | None = None
    pinned_ids: list[str] | None = None
    query_rule: dict | None = None
    order_index: int | None = None


class SlotOut(BaseModel):
    """Response schema for slots."""

    id: str
    layout_id: str
    position_key: str
    content_type: SlotContentType
    pinned_ids: list[str]
    query_rule: dict | None
    order_index: int
    updated_at: str

