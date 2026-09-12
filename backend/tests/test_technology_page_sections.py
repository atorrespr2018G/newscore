"""Unit tests for Technology page section defaults (seed-shaped, geo-ready)."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.geo_catalog import country_region_codes
from shared.core.page_ad_placements import TECHNOLOGY_ARCHIVE_PIN_LIMIT, is_market_agnostic_page
from shared.core.slot_query_rule import query_rule_for_config_slot
from shared.core.technology_page_sections_sync import (
    ARCHIVE_POSITION_KEY,
    LIVE_POSITION_KEY,
    PRESERVED_TECHNOLOGY_PAGE_KEYS,
    TECHNOLOGY_PAGE_NAME,
    TECHNOLOGY_PAGE_SECTION_TYPES,
    default_technology_page_section_items,
    slugify_technology_label,
)


def test_technology_page_name() -> None:
    """Technology boards use the technology page name."""

    assert TECHNOLOGY_PAGE_NAME == "technology"


def test_technology_is_not_market_agnostic() -> None:
    """Technology Configuration is scoped per market/region like Health."""

    assert is_market_agnostic_page("technology") is False


def test_technology_section_types_omit_topic_rows() -> None:
    """v1 Technology configuration has no entertainment-style topic type."""

    assert "archive" in TECHNOLOGY_PAGE_SECTION_TYPES
    assert "entertainment" not in TECHNOLOGY_PAGE_SECTION_TYPES
    assert "technology" not in TECHNOLOGY_PAGE_SECTION_TYPES
    assert ARCHIVE_POSITION_KEY == "archive"
    assert LIVE_POSITION_KEY == "health"
    assert "hero" in PRESERVED_TECHNOLOGY_PAGE_KEYS
    assert "archive" in PRESERVED_TECHNOLOGY_PAGE_KEYS


def test_slugify_technology_label() -> None:
    """Labels produce stable hyphenated slugs."""

    assert slugify_technology_label("Latest News") == "latest-news"


def test_default_technology_page_section_items_match_seed_order() -> None:
    """Defaults match TECHNOLOGY_PAGE_SLOT_SPECS: hero, ribbons, top, live, archive."""

    items = default_technology_page_section_items()
    types = [row["section_type"] for row in items]
    slugs = [row["slug"] for row in items]
    assert types == [
        "hero",
        "ribbon_ad",
        "top_stories",
        "ribbon_ad",
        "live",
        "archive",
    ]
    assert slugs == [
        "hero",
        "ad-ribbon",
        "us-featured",
        "ad-ribbon-2",
        "health",
        "archive",
    ]
    assert items[0]["label"] == "Technology"
    assert TECHNOLOGY_ARCHIVE_PIN_LIMIT == 48


def test_country_region_codes_are_us_and_pr() -> None:
    """Configuration country scopes are US and Puerto Rico."""

    assert country_region_codes() == ("us", "pr")


def test_technology_slot_query_rule_fills_category_on_create() -> None:
    """New technology content slots auto-fill from the technology category."""

    from shared.core.technology_page_sections_sync import _technology_slot_query_rule

    created = _technology_slot_query_rule(limit=12, existing=None, category_id="cat-tech")
    assert created == {"limit": 12, "category_id": "cat-tech"}
    archive = _technology_slot_query_rule(
        limit=TECHNOLOGY_ARCHIVE_PIN_LIMIT,
        existing=None,
        category_id=None,
    )
    assert archive == {"limit": TECHNOLOGY_ARCHIVE_PIN_LIMIT}
    kept = _technology_slot_query_rule(
        limit=12,
        existing={"query_rule": {"limit": 8, "category_id": "cat-old"}},
        category_id="cat-tech",
    )
    assert kept == query_rule_for_config_slot(
        limit=12,
        existing={"query_rule": {"limit": 8, "category_id": "cat-old"}},
    )
