"""Tests for configuration slot query-rule helpers."""

from __future__ import annotations

from shared.core.slot_query_rule import query_rule_for_config_slot
from shared.read.article_query import article_query_with_category


def test_query_rule_for_new_config_slot_is_pin_only() -> None:
    """Newly configured sections must not auto-fill from a category."""

    assert query_rule_for_config_slot(limit=12, existing=None) == {"limit": 12}


def test_query_rule_for_existing_slot_preserves_category_fill() -> None:
    """Seeded boards keep prior category auto-fill when re-synced."""

    existing = {"query_rule": {"limit": 8, "category_id": "cat-soccer"}}
    assert query_rule_for_config_slot(limit=12, existing=existing) == {
        "limit": 12,
        "category_id": "cat-soccer",
    }


def test_query_rule_for_existing_pin_only_slot_stays_pin_only() -> None:
    """A slot created empty must not gain category fill on later syncs."""

    existing = {"query_rule": {"limit": 4}}
    assert query_rule_for_config_slot(limit=12, existing=existing) == {"limit": 12}


def test_article_query_with_category_keeps_scope_or() -> None:
    """Category match must not overwrite region/market scope ``$or``."""

    base = {
        "status": "published",
        "$or": [{"market_ids": "mkt-us"}, {"effective_region_ids": "reg-us"}],
    }
    query = article_query_with_category(base, category_id="cat-soccer")
    assert query == {
        "$and": [
            base,
            {
                "$or": [
                    {"category_id": "cat-soccer"},
                    {"category_ids": "cat-soccer"},
                ],
            },
        ],
    }
