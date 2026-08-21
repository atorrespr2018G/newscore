"""Unit tests for Health page section defaults (Sports template, no World)."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.health_page_sections_sync import (
    DEFAULT_HEALTH_TOPIC_LABELS,
    PRESERVED_HEALTH_PAGE_KEYS,
    default_health_page_section_items,
    slugify_health_label,
)
from shared.core.geo_catalog import STATE_HEALTH_LAYOUT_PAGE_NAME, country_region_codes
from shared.core.slot_query_rule import query_rule_for_config_slot


HEALTH_TOPIC_LABELS = [
    "Fitness",
    "Food",
    "Sleep",
    "Family",
]


def test_health_layout_page_name() -> None:
    """Health boards use the health page name."""

    assert STATE_HEALTH_LAYOUT_PAGE_NAME == "health"


def test_slugify_health_label_matches_topics() -> None:
    """Configured Health topics produce stable slugs used as slot keys."""

    assert slugify_health_label("Fitness") == "fitness"
    assert slugify_health_label("Food") == "food"
    assert "hero" in PRESERVED_HEALTH_PAGE_KEYS
    assert "world" not in PRESERVED_HEALTH_PAGE_KEYS


def test_default_health_page_section_items_omit_world() -> None:
    """Defaults include hero bands plus health rows, with no World section."""

    items = default_health_page_section_items(HEALTH_TOPIC_LABELS)
    types = [row["section_type"] for row in items]
    slugs = [row["slug"] for row in items if row["section_type"] == "health"]
    assert types[0] == "hero"
    assert "world" not in types
    assert "health" in types
    assert "ribbon_ad" in types
    assert slugs == [
        "fitness",
        "food",
        "sleep",
        "family",
    ]


def test_default_health_topic_labels_match_configuration_topics() -> None:
    """Canonical topic labels match the Health Configuration list."""

    assert list(DEFAULT_HEALTH_TOPIC_LABELS) == HEALTH_TOPIC_LABELS


def test_country_region_codes_are_us_and_pr() -> None:
    """Configuration country scopes are US and Puerto Rico."""

    assert country_region_codes() == ("us", "pr")


def test_health_slot_query_rule_fills_category_on_create() -> None:
    """New health slots auto-fill from the topic category."""

    from shared.core.health_page_sections_sync import _health_slot_query_rule

    created = _health_slot_query_rule(limit=12, existing=None, category_id="cat-music")
    assert created == {"limit": 12, "category_id": "cat-music"}
    kept = _health_slot_query_rule(
        limit=12,
        existing={"query_rule": {"limit": 8, "category_id": "cat-old"}},
        category_id="cat-music",
    )
    assert kept == query_rule_for_config_slot(
        limit=12,
        existing={"query_rule": {"limit": 8, "category_id": "cat-old"}},
    )
