"""Article request/response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ArticleStatusType = Literal["draft", "review", "published", "archived"]

DEFAULT_MAX_IMAGE_COUNT = 5


class ArticleCreate(BaseModel):
    """Request body for POST /articles."""

    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=10)
    category_id: str | None = None
    market_ids: list[str] = Field(..., min_length=1)
    tags: list[str] = []
    thumbnail_url: str | None = None
    media_ids: list[str] = []
    video_url: str | None = None
    max_image_count: int | None = Field(None, ge=1, le=20)


class ArticleUpdate(BaseModel):
    """Request body for PATCH /articles/{id}. All fields optional."""

    title: str | None = Field(None, min_length=3, max_length=200)
    body: str | None = Field(None, min_length=10)
    category_id: str | None = None
    market_ids: list[str] | None = Field(None, min_length=1)
    tags: list[str] | None = None
    thumbnail_url: str | None = None
    media_ids: list[str] | None = None
    video_url: str | None = None
    max_image_count: int | None = Field(None, ge=1, le=20)
    status: ArticleStatusType | None = None


class ArticleOut(BaseModel):
    """Response schema for article objects returned to clients."""

    id: str
    title: str
    slug: str
    status: ArticleStatusType
    author_name: str
    thumbnail_url: str | None
    video_url: str | None = None
    created_at: str
    published_at: str | None


class ArticleDetailOut(ArticleOut):
    """Response schema for a full article detail view."""

    body: str
    tags: list[str]
    category_id: str | None
    market_ids: list[str]
    media_ids: list[str]
    max_image_count: int
    view_count: int

