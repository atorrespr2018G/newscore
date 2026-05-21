"""Common request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel


class PaginatedResponse(BaseModel):
    """Generic paginated response wrapper."""

    items: list
    total: int
    page: int
    page_size: int
    has_more: bool

