"""Unit tests for workflow badge tracking (placement + review)."""

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

from shared.core.exceptions import ValidationError
from shared.core.placement_events import (
    compute_added_ids,
    count_new_placements,
    record_placements,
)
from shared.core.view_state import (
    VIEW_PLACEMENT,
    get_last_seen,
    mark_seen,
    validate_view,
)
from news_storage_app.services.workflow_service import count_new_reviews_for_user


def test_compute_added_ids_returns_only_new_ids() -> None:
    """Only ids absent from the old list are reported, preserving order."""

    assert compute_added_ids(["a", "b"], ["b", "c", "d"]) == ["c", "d"]


def test_compute_added_ids_handles_none_and_duplicates() -> None:
    """None inputs act as empty and duplicate new ids collapse to one entry."""

    assert compute_added_ids(None, ["a", "a", "b"]) == ["a", "b"]
    assert compute_added_ids(["a"], None) == []


def test_validate_view_rejects_unknown() -> None:
    """An unknown view name raises a ValidationError."""

    assert validate_view("Placement") == VIEW_PLACEMENT
    with pytest.raises(ValidationError):
        validate_view("inbox")


def _mock_db(collection: MagicMock) -> MagicMock:
    """Wrap a single collection mock as a db handle."""

    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=collection)
    return db


@pytest.mark.asyncio
async def test_record_placements_upserts_per_article() -> None:
    """Each added article id triggers one keyed upsert."""

    collection = MagicMock()
    collection.update_one = AsyncMock()
    db = _mock_db(collection)

    await record_placements(db, article_ids=["a", "b"], slot_id="s1", market_id="m1")

    assert collection.update_one.await_count == 2
    first_filter = collection.update_one.await_args_list[0].args[0]
    assert first_filter == {"article_id": "a", "slot_id": "s1"}


@pytest.mark.asyncio
async def test_record_placements_noop_when_empty() -> None:
    """No article ids means no database writes."""

    collection = MagicMock()
    collection.update_one = AsyncMock()
    db = _mock_db(collection)

    await record_placements(db, article_ids=[], slot_id="s1", market_id="m1")

    collection.update_one.assert_not_awaited()


@pytest.mark.asyncio
async def test_count_new_placements_applies_since_bound() -> None:
    """A last-seen timestamp scopes the count to newer placements."""

    collection = MagicMock()
    collection.count_documents = AsyncMock(return_value=3)
    db = _mock_db(collection)

    total = await count_new_placements(db, market_id="m1", since="2026-01-01T00:00:00+00:00")

    assert total == 3
    query = collection.count_documents.await_args.args[0]
    assert query["market_id"] == "m1"
    assert query["placed_at"] == {"$gt": "2026-01-01T00:00:00+00:00"}


@pytest.mark.asyncio
async def test_count_new_placements_without_since_counts_all() -> None:
    """No last-seen timestamp counts every placement in the market."""

    collection = MagicMock()
    collection.count_documents = AsyncMock(return_value=7)
    db = _mock_db(collection)

    total = await count_new_placements(db, market_id="m1", since=None)

    assert total == 7
    query = collection.count_documents.await_args.args[0]
    assert "placed_at" not in query


@pytest.mark.asyncio
async def test_mark_and_get_last_seen_roundtrip() -> None:
    """mark_seen upserts a timestamp that get_last_seen can read back."""

    collection = MagicMock()
    collection.find_one_and_update = AsyncMock()
    db = _mock_db(collection)

    stored = await mark_seen(db, user_id="u1", view=VIEW_PLACEMENT)

    collection.find_one_and_update.assert_awaited_once()
    update = collection.find_one_and_update.await_args.args[1]
    assert update["$set"]["last_seen_at"] == stored

    collection.find_one = AsyncMock(return_value={"last_seen_at": stored})
    assert await get_last_seen(db, user_id="u1", view=VIEW_PLACEMENT) == stored


@pytest.mark.asyncio
async def test_count_new_reviews_filters_by_review_submitted_at() -> None:
    """Review count filters in-review stories newer than the last-seen time."""

    collection = MagicMock()
    collection.find_one = AsyncMock(return_value={"last_seen_at": "2026-02-01T00:00:00+00:00"})
    collection.count_documents = AsyncMock(return_value=2)
    db = _mock_db(collection)

    total = await count_new_reviews_for_user(db, user_id="u1")

    assert total == 2
    query = collection.count_documents.await_args.args[0]
    assert query["status"] == "review"
    assert query["review_submitted_at"] == {"$gt": "2026-02-01T00:00:00+00:00"}
