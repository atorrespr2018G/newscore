"""Unit tests for the extended editor search service."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))
if str(_ROOT / "news_storage_app") not in sys.path:
    sys.path.insert(0, str(_ROOT / "news_storage_app"))

from news_storage_app.services.search_service import (
    _build_created_at_filter,
    _build_location_filter,
    _build_search_filter,
    search_articles,
)
from shared.core.pagination import PaginationParams


def test_created_at_filter_widens_bare_to_date() -> None:
    """A bare created_to date is widened to include the whole day."""

    result = _build_created_at_filter("2026-01-01", "2026-01-31")
    assert result["created_at"]["$gte"] == "2026-01-01"
    assert result["created_at"]["$lte"].startswith("2026-01-31T23:59:59")


def test_created_at_filter_empty_when_no_bounds() -> None:
    """No date bounds yields no created_at clause."""

    assert _build_created_at_filter(None, None) == {}
    assert _build_created_at_filter("", "  ") == {}


def test_search_filter_combines_with_and() -> None:
    """Title, category, and date filters combine under a single $and."""

    result = _build_search_filter(
        query="bridge",
        category_id="cat-1",
        created_from="2026-01-01",
        created_to=None,
    )
    assert "$and" in result
    assert len(result["$and"]) == 3


def test_search_filter_single_clause_not_wrapped() -> None:
    """A lone clause is returned directly without an $and wrapper."""

    result = _build_search_filter(
        query=None,
        category_id="cat-1",
        created_from=None,
        created_to=None,
    )
    assert "$and" not in result
    assert result == {"$or": [{"category_id": "cat-1"}, {"category_ids": "cat-1"}]}


def test_search_filter_empty_when_no_inputs() -> None:
    """No inputs yields an empty (match-all) filter."""

    assert _build_search_filter(
        query=None, category_id=None, created_from=None, created_to=None
    ) == {}


def test_location_filter_region_with_legacy_fallback() -> None:
    """Region id and legacy market/town combine under $or."""

    result = _build_location_filter(
        region_id="reg-us-fl",
        market_id="mkt-us",
        town="fl",
    )
    assert result == {
        "$or": [
            {"effective_region_ids": "reg-us-fl"},
            {"market_ids": "mkt-us", "town_id": "fl"},
        ]
    }


def test_location_filter_region_only() -> None:
    """Region id alone yields an effective_region_ids clause."""

    assert _build_location_filter(
        region_id="reg-us",
        market_id=None,
        town=None,
    ) == {"effective_region_ids": "reg-us"}


def test_search_filter_includes_location() -> None:
    """Location joins the other filters under $and."""

    result = _build_search_filter(
        query=None,
        category_id=None,
        created_from=None,
        created_to=None,
        region_id="reg-us",
        market_id="mkt-us",
        town=None,
    )
    assert result == {
        "$or": [
            {"effective_region_ids": "reg-us"},
            {"market_ids": "mkt-us"},
        ]
    }

class _AsyncCursor:
    """Minimal async-iterable cursor stub yielding a fixed list of docs."""

    def __init__(self, docs: list[dict]) -> None:
        self._docs = docs

    def __aiter__(self) -> "_AsyncCursor":
        self._iter = iter(self._docs)
        return self

    async def __anext__(self) -> dict:
        try:
            return next(self._iter)
        except StopIteration as stop:
            raise StopAsyncIteration from stop


def _mock_db_with_article(doc: dict | None) -> MagicMock:
    """Build a mock db whose articles collection returns ``doc`` by id."""

    db = MagicMock()
    collection = MagicMock()
    collection.find_one = AsyncMock(return_value=doc)
    # The author-name loader iterates a users cursor; yield no users so names
    # resolve to the "Unknown" fallback.
    collection.find = MagicMock(return_value=_AsyncCursor([]))
    db.__getitem__ = MagicMock(return_value=collection)
    return db


@pytest.mark.asyncio
async def test_article_id_override_returns_single_across_status() -> None:
    """A non-empty article_id resolves one article and ignores other filters."""

    doc = {
        "_id": "a1",
        "title": "Draft story",
        "slug": "draft-story",
        "status": "draft",
        "author_id": "u1",
        "thumbnail_url": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "published_at": None,
    }
    db = _mock_db_with_article(doc)
    # Author name loader resolves to empty without a users collection lookup.
    items, total = await search_articles(
        db,
        query="ignored",
        category_id="ignored",
        article_id="a1",
        pagination=PaginationParams(page=1, page_size=10),
    )
    assert total == 1
    assert len(items) == 1
    assert items[0].id == "a1"
    assert items[0].status == "draft"


@pytest.mark.asyncio
async def test_article_id_override_missing_returns_empty() -> None:
    """An unknown article_id yields no results and a zero total."""

    db = _mock_db_with_article(None)
    items, total = await search_articles(
        db,
        article_id="missing",
        pagination=PaginationParams(page=1, page_size=10),
    )
    assert items == []
    assert total == 0
