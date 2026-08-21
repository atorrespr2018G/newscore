"""Unit tests for Entertainment page section defaults (Sports template, no World)."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.entertainment_page_sections_sync import (
    DEFAULT_ENTERTAINMENT_TOPIC_LABELS,
    PRESERVED_ENTERTAINMENT_PAGE_KEYS,
    default_entertainment_page_section_items,
    slugify_entertainment_label,
)
from shared.core.geo_catalog import STATE_ENTERTAINMENT_LAYOUT_PAGE_NAME, country_region_codes
from shared.core.slot_query_rule import query_rule_for_config_slot


ENTERTAINMENT_TOPIC_LABELS = [
    "Arts & Culture",
    "Music",
    "Movies",
    "TV & Streaming",
    "Celebrities",
    "Fashion",
    "Design",
    "Architecture",
    "Luxury",
    "Gaming",
    "Lifestyle",
    "Horoscope",
]


def test_entertainment_layout_page_name() -> None:
    """Entertainment boards use the entertainment page name."""

    assert STATE_ENTERTAINMENT_LAYOUT_PAGE_NAME == "entertainment"


def test_slugify_entertainment_label_matches_topics() -> None:
    """Configured Entertainment topics produce stable slugs used as slot keys."""

    assert slugify_entertainment_label("Arts & Culture") == "arts-culture"
    assert slugify_entertainment_label("TV & Streaming") == "tv-streaming"
    assert "hero" in PRESERVED_ENTERTAINMENT_PAGE_KEYS
    assert "world" not in PRESERVED_ENTERTAINMENT_PAGE_KEYS


def test_default_entertainment_page_section_items_omit_world() -> None:
    """Defaults include hero bands plus entertainment rows, with no World section."""

    items = default_entertainment_page_section_items(ENTERTAINMENT_TOPIC_LABELS)
    types = [row["section_type"] for row in items]
    slugs = [row["slug"] for row in items if row["section_type"] == "entertainment"]
    assert types[0] == "hero"
    assert "world" not in types
    assert "entertainment" in types
    assert "ribbon_ad" in types
    assert slugs == [
        "arts-culture",
        "music",
        "movies",
        "tv-streaming",
        "celebrities",
        "fashion",
        "design",
        "architecture",
        "luxury",
        "gaming",
        "lifestyle",
        "horoscope",
    ]


def test_default_entertainment_topic_labels_match_configuration_topics() -> None:
    """Canonical topic labels match the Entertainment Configuration list."""

    assert list(DEFAULT_ENTERTAINMENT_TOPIC_LABELS) == ENTERTAINMENT_TOPIC_LABELS


def test_country_region_codes_are_us_and_pr() -> None:
    """Configuration country scopes are US and Puerto Rico."""

    assert country_region_codes() == ("us", "pr")


def test_entertainment_slot_query_rule_fills_category_on_create() -> None:
    """New entertainment slots auto-fill from the topic category."""

    from shared.core.entertainment_page_sections_sync import _entertainment_slot_query_rule

    created = _entertainment_slot_query_rule(limit=12, existing=None, category_id="cat-music")
    assert created == {"limit": 12, "category_id": "cat-music"}
    kept = _entertainment_slot_query_rule(
        limit=12,
        existing={"query_rule": {"limit": 8, "category_id": "cat-old"}},
        category_id="cat-music",
    )
    assert kept == query_rule_for_config_slot(
        limit=12,
        existing={"query_rule": {"limit": 8, "category_id": "cat-old"}},
    )
