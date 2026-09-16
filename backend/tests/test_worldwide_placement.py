"""Tests for worldwide targeting and global/local pin conflict rules."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "shared"))
sys.path.insert(0, str(ROOT / "layout_admin_app"))

from layout_admin_app.services.worldwide_placement_service import (  # noqa: E402
    place_global_article_in_pins,
    place_local_article_in_pins,
)
from shared.core.worldwide import (  # noqa: E402
    apply_market_eligibility,
    effective_market_ids,
    market_eligibility_filter,
    normalize_excluded_market_ids,
)


def test_effective_market_ids_excludes_selected_markets() -> None:
    """Worldwide targeting subtracts excluded markets only."""

    assert effective_market_ids(
        ["us", "pr", "co"],
        excluded_market_ids=["co", "co", ""],
    ) == ["us", "pr"]


def test_normalize_excluded_market_ids_dedupes() -> None:
    """Exclusion lists are stripped and de-duplicated."""

    assert normalize_excluded_market_ids([" us ", "us", "pr", ""]) == ["us", "pr"]


def test_market_eligibility_filter_includes_worldwide_clause() -> None:
    """Eligibility matches tagged markets or non-excluded worldwide stories."""

    assert market_eligibility_filter("mkt-us") == {
        "$or": [
            {"market_ids": "mkt-us"},
            {"worldwide": True, "excluded_market_ids": {"$nin": ["mkt-us"]}},
        ]
    }


def test_apply_market_eligibility_preserves_existing_or() -> None:
    """Category $or queries combine with market eligibility via $and."""

    query = {"status": "published", "$or": [{"category_id": "c1"}, {"category_ids": "c1"}]}
    merged = apply_market_eligibility(query, "mkt-us")
    assert merged == {"$and": [query, market_eligibility_filter("mkt-us")]}


def test_global_takes_requested_index_and_shifts_old_global() -> None:
    """A new worldwide story lands at the requested index; the old global shifts."""

    pins, index = place_global_article_in_pins(
        ["g-old", "local-1", "local-2"],
        article_id="g-new",
        requested_position=0,
        limit=12,
        worldwide_ids={"g-old"},
    )
    assert index == 0
    assert pins[0] == "g-new"
    assert pins[1] == "g-old"
    assert pins[2] == "local-1"


def test_global_always_allocates_when_slot_full() -> None:
    """Worldwide stories are never rejected for a full slot; locals are trimmed."""

    pins, index = place_global_article_in_pins(
        ["a", "b", "c"],
        article_id="g-new",
        requested_position=0,
        limit=3,
        worldwide_ids=set(),
    )
    assert index == 0
    assert pins[0] == "g-new"
    assert len(pins) == 3
    assert "g-new" in pins


def test_global_prefers_dropping_locals_over_other_globals() -> None:
    """Overflow drops non-worldwide pins before other worldwide pins."""

    pins, _index = place_global_article_in_pins(
        ["g1", "local", "g2"],
        article_id="g-new",
        requested_position=0,
        limit=3,
        worldwide_ids={"g1", "g2"},
    )
    assert pins[0] == "g-new"
    assert "local" not in pins
    assert "g1" in pins
    assert "g2" in pins or "g1" in pins


def test_local_skips_global_cell() -> None:
    """Local stories move to the next non-worldwide cell."""

    pins, index = place_local_article_in_pins(
        ["g1", "", "local-old"],
        article_id="local-new",
        requested_position=0,
        limit=12,
        worldwide_ids={"g1"},
    )
    assert index == 1
    assert pins[0] == "g1"
    assert pins[1] == "local-new"
