"""API schemas for the custom tab registry."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CustomTabOut(BaseModel):
    """One registered custom tab scoped to a market."""

    slug: str
    label: str
    market_code: str
    sort_order: int
    created_at: str
    updated_at: str


class CustomTabCreate(BaseModel):
    """Create a custom tab for one market and seed its geo section boards."""

    label: str = Field(..., min_length=1, max_length=80)
    market_code: str = Field(..., min_length=1, max_length=16)
    slug: str | None = Field(default=None, min_length=1, max_length=80)


class CustomTabUpdate(BaseModel):
    """Rename or reorder an existing custom tab."""

    label: str | None = Field(default=None, min_length=1, max_length=80)
    sort_order: int | None = None


class CustomTabListOut(BaseModel):
    """Ordered custom tabs for More and Configuration."""

    items: list[CustomTabOut]
