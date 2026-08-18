"""Unit tests for pin-only page archive reads."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.pagination import PaginationParams
from shared.read.collections import ARTICLES_COLLECTION
from shared.read.page_archive_reads import list_page_archive_articles


class _EmptyAsyncCursor:
    """Async cursor that records sort/skip/limit and yields nothing."""

    def __init__(self) -> None:
        self.sort_args: tuple[object, ...] | None = None
        self.skip_args: tuple[object, ...] | None = None
        self.limit_args: tuple[object, ...] | None = None

    def sort(self, *args: object) -> _EmptyAsyncCursor:
        self.sort_args = args
        return self

    def skip(self, *args: object) -> _EmptyAsyncCursor:
        self.skip_args = args
        return self

    def limit(self, *args: object) -> _EmptyAsyncCursor:
        self.limit_args = args
        return self

    def __aiter__(self) -> _EmptyAsyncCursor:
        return self

    async def __anext__(self) -> dict:
        raise StopAsyncIteration


@pytest.mark.asyncio
async def test_list_page_archive_articles_uses_pins_not_category() -> None:
    """Archive membership is placement pins, sorted by published date."""

    cursor = _EmptyAsyncCursor()
    articles = MagicMock()
    articles.count_documents = AsyncMock(return_value=17)
    articles.find.return_value = cursor
    db = MagicMock()
    db.__getitem__.side_effect = lambda name: articles if name == ARTICLES_COLLECTION else MagicMock()
    loader = MagicMock()
    loader.load_many = AsyncMock()
    loader.load = AsyncMock()

    layout = {
        "slots": [
            {"position_key": "hero", "pinned_ids": ["hero-1"]},
            {"position_key": "archive", "pinned_ids": ["a1", "a2"]},
        ],
    }

    with patch(
        "shared.read.page_archive_reads.get_market_by_code",
        AsyncMock(return_value={"_id": "mkt-us"}),
    ):
        with patch(
            "shared.read.page_archive_reads.get_active_layout",
            AsyncMock(return_value=layout),
        ):
            result = await list_page_archive_articles(
                db,
                params=PaginationParams(page=2, page_size=16),
                loader=loader,
            )

    articles.find.assert_called_once()
    query = articles.find.call_args.args[0]
    assert query["_id"]["$in"] == ["a1", "a2"]
    assert query["status"] == "published"
    assert "category_id" not in query
    assert "market_ids" not in query
    assert cursor.sort_args == ("published_at", -1)
    assert cursor.skip_args == (16,)
    assert cursor.limit_args == (16,)
    assert result.total == 17
    assert result.has_more is True


@pytest.mark.asyncio
async def test_list_page_archive_articles_empty_without_pins() -> None:
    """An unplaced archive slot returns an empty connection."""

    db = MagicMock()
    layout = {"slots": [{"position_key": "archive", "pinned_ids": []}]}
    with patch(
        "shared.read.page_archive_reads.get_market_by_code",
        AsyncMock(return_value={"_id": "mkt-us"}),
    ):
        with patch(
            "shared.read.page_archive_reads.get_active_layout",
            AsyncMock(return_value=layout),
        ):
            result = await list_page_archive_articles(
                db,
                params=PaginationParams(page=1, page_size=16),
            )

    assert result.items == []
    assert result.total == 0
    db.__getitem__.assert_not_called()
