"""Unit tests for Business page section defaults (Health/Entertainment template)."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.business_page_sections_sync import (
    BUSINESS_PAGE_NAME,
    DEFAULT_BUSINESS_TOPIC_LABELS,
    LIVE_POSITION_KEY,
    PRESERVED_BUSINESS_PAGE_KEYS,
    default_business_page_section_items,
    slugify_business_label,
)
from shared.core.geo_catalog import country_region_codes
from shared.core.slot_query_rule import query_rule_for_config_slot


BUSINESS_TOPIC_LABELS = [
    "Economy",
    "Companies",
    "Banking",
    "Autos",
    "Tourism",
    "Construction",
    "Agriculture",
]


def test_business_page_name() -> None:
    """Business boards use the business page name."""

    assert BUSINESS_PAGE_NAME == "business"


def test_slugify_business_label_matches_beats() -> None:
    """Configured Business beats produce stable slugs used as slot keys."""

    assert slugify_business_label("Economy") == "economy"
    assert slugify_business_label("Companies") == "companies"
    assert "hero" in PRESERVED_BUSINESS_PAGE_KEYS
    assert LIVE_POSITION_KEY == "health"
    assert "world" not in PRESERVED_BUSINESS_PAGE_KEYS


def test_default_business_page_section_items_omit_world() -> None:
    """Defaults include hero bands plus business rows, with no World section."""

    items = default_business_page_section_items(BUSINESS_TOPIC_LABELS)
    types = [row["section_type"] for row in items]
    slugs = [row["slug"] for row in items if row["section_type"] == "business"]
    assert types[0] == "hero"
    assert "world" not in types
    assert "business" in types
    assert "ribbon_ad" in types
    assert slugs == [
        "economy",
        "companies",
        "banking",
        "autos",
        "tourism",
        "construction",
        "agriculture",
    ]


def test_default_business_topic_labels_match_configuration_topics() -> None:
    """Canonical topic labels match the Business Configuration list."""

    assert list(DEFAULT_BUSINESS_TOPIC_LABELS) == BUSINESS_TOPIC_LABELS


def test_country_region_codes_are_us_and_pr() -> None:
    """Configuration country scopes are US and Puerto Rico."""

    assert country_region_codes() == ("us", "pr")


def test_business_slot_query_rule_fills_category_on_create() -> None:
    """New business slots auto-fill from the topic category."""

    from shared.core.business_page_sections_sync import _business_slot_query_rule

    created = _business_slot_query_rule(limit=12, existing=None, category_id="cat-economy")
    assert created == {"limit": 12, "category_id": "cat-economy"}
    kept = _business_slot_query_rule(
        limit=12,
        existing={"query_rule": {"limit": 8, "category_id": "cat-old"}},
        category_id="cat-economy",
    )
    assert kept == query_rule_for_config_slot(
        limit=12,
        existing={"query_rule": {"limit": 8, "category_id": "cat-old"}},
    )
