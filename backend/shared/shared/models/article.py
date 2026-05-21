"""MongoDB article document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from shared.models.common import utc_now


ArticleStatusType = Literal["draft", "review", "published", "archived"]


class Article(BaseModel):
    """Represents an article document as stored in MongoDB."""

    id: str = Field(..., alias="_id")
    title: str = Field(..., max_length=200)
    slug: str = Field(..., max_length=120)
    body: str
    status: ArticleStatusType = "draft"
    author_id: str
    category_id: str | None = None
    tags: list[str] = []
    thumbnail_url: str | None = None
    media_ids: list[str] = []
    view_count: int = 0
    published_at: str | None = None
    created_at: str = Field(default_factory=lambda: utc_now().isoformat())
    updated_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }

