"""Layout and slot request/response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SlotContentType = Literal["articles", "breaking", "video", "ad"]


class LayoutCreate(BaseModel):
    """Request body for POST /layouts."""

    page_name: str = Field(..., min_length=1, max_length=120)
    market_id: str = Field(..., min_length=1)
    is_active: bool = True


class LayoutUpdate(BaseModel):
    """Request body for PATCH /layouts/{id}."""

    is_active: bool | None = None


class LayoutOut(BaseModel):
    """Response schema for layouts."""

    id: str
    page_name: str
    market_id: str | None
    slot_ids: list[str]
    is_active: bool
    updated_at: str


class SlotCreate(BaseModel):
    """Request body for POST /slots."""

    layout_id: str
    position_key: str = Field(..., min_length=1, max_length=120)
    content_type: SlotContentType = "articles"
    display_name: str | None = Field(None, min_length=1, max_length=120)
    presentation_type: str = Field("grid_4", min_length=1, max_length=120)
    order_index: int = 0


class SlotUpdate(BaseModel):
    """Request body for PATCH /slots/{id}."""

    position_key: str | None = Field(None, min_length=1, max_length=120)
    content_type: SlotContentType | None = None
    display_name: str | None = Field(None, min_length=1, max_length=120)
    presentation_type: str | None = Field(None, min_length=1, max_length=120)
    pinned_ids: list[str] | None = None
    draft_pinned_ids: list[str] | None = None
    query_rule: dict | None = None
    order_index: int | None = None


class SlotOut(BaseModel):
    """Response schema for slots."""

    id: str
    layout_id: str
    position_key: str
    content_type: SlotContentType
    display_name: str | None
    presentation_type: str
    pinned_ids: list[str]
    draft_pinned_ids: list[str] | None = None
    query_rule: dict | None
    order_index: int
    updated_at: str


class PublishPlacementsOut(BaseModel):
    """Response schema for publishing staged homepage placements."""

    layout_id: str
    page_name: str
    market_code: str
    published_slot_count: int


class ArticlePlacementOut(BaseModel):
    """Resolved placement for one article within a layout slot."""

    page_name: str
    position_key: str
    display_name: str
    position: int


class ArticlePlacementsOut(BaseModel):
    """Article id to placement list lookup for editor tooling."""

    placements: dict[str, list[ArticlePlacementOut]]

