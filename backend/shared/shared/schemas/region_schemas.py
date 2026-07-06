"""Region request/response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


RegionKind = Literal[
    "world",
    "country",
    "state",
    "province",
    "county",
    "city",
    "town",
    "municipality",
    "district",
]

RegionVisibilityMode = Literal["upward_only", "explicit_only", "custom"]
LayoutScopeMode = Literal["exact", "inherit_from_ancestor"]


class RegionCreate(BaseModel):
    """Request body for creating a region node."""

    code: str = Field(..., min_length=1, max_length=120)
    name: str = Field(..., min_length=1, max_length=200)
    kind: RegionKind
    parent_id: str | None = None
    country_code: str | None = Field(None, min_length=2, max_length=8)
    is_active: bool = True
    default_locale: str | None = None
    labels: dict[str, str] = {}


class RegionUpdate(BaseModel):
    """Request body for updating mutable region fields."""

    name: str | None = Field(None, min_length=1, max_length=200)
    is_active: bool | None = None
    default_locale: str | None = None
    labels: dict[str, str] | None = None


class RegionMove(BaseModel):
    """Request body for reparenting a region."""

    new_parent_id: str


class RegionOut(BaseModel):
    """Response schema for region objects."""

    id: str
    code: str
    name: str
    kind: RegionKind
    parent_id: str | None
    ancestor_ids: list[str]
    depth: int
    path: str
    country_code: str | None
    is_active: bool
    default_locale: str | None
    labels: dict[str, str]
    created_at: str
    updated_at: str
