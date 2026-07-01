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
    article_has_staged_unpublished_placement,
    clear_placement_events,
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


def test_article_has_staged_unpublished_placement() -> None:
    """Staged-only pins count; live pins and cleared drafts do not."""

    staged_slot = {
        "draft_pinned_ids": ["a", "b"],
        "pinned_ids": ["a"],
    }
    assert article_has_staged_unpublished_placement(staged_slot, "b") is True
    assert article_has_staged_unpublished_placement(staged_slot, "a") is False

    published_slot = {"pinned_ids": ["a"], "draft_pinned_ids": None}
    assert article_has_staged_unpublished_placement(published_slot, "a") is False


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
    """Only still-unpublished events newer than last-seen are counted."""

    events = MagicMock()
    events.find = MagicMock(
        return_value=AsyncIterator(
            [
                {"article_id": "new", "slot_id": "s1"},
                {"article_id": "live", "slot_id": "s1"},
            ],
        ),
    )
    slots = MagicMock()
    slots.find_one = AsyncMock(
        side_effect=[
            {"_id": "s1", "draft_pinned_ids": ["new"], "pinned_ids": []},
            {"_id": "s1", "draft_pinned_ids": ["live"], "pinned_ids": ["live"]},
        ],
    )
    db = MagicMock()
    db.__getitem__ = MagicMock(side_effect=lambda name: events if name == "placement_events" else slots)

    total = await count_new_placements(db, market_id="m1", since="2026-01-01T00:00:00+00:00")

    assert total == 1
    events.find.assert_called_once()
    query = events.find.call_args.args[0]
    assert query["market_id"] == "m1"
    assert query["placed_at"] == {"$gt": "2026-01-01T00:00:00+00:00"}


@pytest.mark.asyncio
async def test_count_new_placements_without_since_counts_all_unpublished() -> None:
    """No last-seen timestamp still filters out already-published placements."""

    events = MagicMock()
    events.find = MagicMock(
        return_value=AsyncIterator([{"article_id": "a", "slot_id": "s1"}]),
    )
    slots = MagicMock()
    slots.find_one = AsyncMock(return_value={"_id": "s1", "draft_pinned_ids": None, "pinned_ids": ["a"]})
    db = MagicMock()
    db.__getitem__ = MagicMock(side_effect=lambda name: events if name == "placement_events" else slots)

    total = await count_new_placements(db, market_id="m1", since=None)

    assert total == 0
    query = events.find.call_args.args[0]
    assert "placed_at" not in query


@pytest.mark.asyncio
async def test_clear_placement_events_deletes_matching_rows() -> None:
    """Published slot/article pairs remove their placement-event rows."""

    collection = MagicMock()
    collection.delete_many = AsyncMock()
    db = _mock_db(collection)

    await clear_placement_events(db, slot_id="s1", article_ids=["a", "b"])

    collection.delete_many.assert_awaited_once_with(
        {"slot_id": "s1", "article_id": {"$in": ["a", "b"]}},
    )


class AsyncIterator:
    """Minimal async iterator for mocking Motor cursors in unit tests."""

    def __init__(self, items: list[dict]) -> None:
        self._items = list(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._items:
            raise StopAsyncIteration
        return self._items.pop(0)


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
