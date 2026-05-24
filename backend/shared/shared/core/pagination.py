"""Pagination helpers shared across services."""

from __future__ import annotations

from fastapi import Depends, Query
from pydantic import BaseModel, Field

from shared.core.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE


class PaginationParams(BaseModel):
    """Validated pagination parameters for list endpoints."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)

    @property
    def skip(self) -> int:
        """Number of documents to skip for the current page."""

        return (self.page - 1) * self.page_size


def get_pagination(
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
) -> PaginationParams:
    """Dependency that returns validated pagination parameters.

    Args:
        page: 1-indexed page number.
        page_size: Maximum number of items per page.

    Returns:
        Validated pagination parameters.
    """

    return PaginationParams(page=page, page_size=page_size)


PaginationDep = Depends(get_pagination)

