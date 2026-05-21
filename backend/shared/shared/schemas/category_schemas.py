"""Category request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    """Request body for POST /categories."""

    name: str = Field(..., min_length=1, max_length=120)
    slug: str = Field(..., min_length=1, max_length=120)
    parent_id: str | None = None
    description: str | None = Field(None, max_length=2000)


class CategoryUpdate(BaseModel):
    """Request body for PATCH /categories/{id}."""

    name: str | None = Field(None, min_length=1, max_length=120)
    slug: str | None = Field(None, min_length=1, max_length=120)
    parent_id: str | None = None
    description: str | None = Field(None, max_length=2000)


class CategoryOut(BaseModel):
    """Response schema for categories."""

    id: str
    name: str
    slug: str
    parent_id: str | None
    description: str | None
    created_at: str

