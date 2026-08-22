"""Smoke tests for custom tab section sync helpers."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "shared"))

from shared.core.custom_page_sections_sync import (  # noqa: E402
    DEFAULT_CUSTOM_TOPIC_LABELS,
    PRESERVED_CUSTOM_PAGE_KEYS,
    SECTION_TYPE_HERO,
    SECTION_TYPE_TOPIC,
    default_custom_page_section_items,
    slugify_custom_label,
)
from shared.core.custom_tabs import (  # noqa: E402
    RESERVED_CUSTOM_TAB_SLUGS,
    assert_custom_tab_slug_allowed,
    slugify_tab_label,
)
from shared.core.custom_page_sections_sync import region_codes_for_market  # noqa: E402
from shared.core.exceptions import ValidationError  # noqa: E402


def test_slugify_custom_label() -> None:
    """Topic labels become kebab-case slugs."""

    assert slugify_custom_label("Climate Science") == "climate-science"


def test_default_custom_items_include_hero_and_topics() -> None:
    """Default board starts with hero and typed topic rows."""

    items = default_custom_page_section_items(["Climate", "Space"], hero_label="Science")
    assert items[0]["section_type"] == SECTION_TYPE_HERO
    assert items[0]["label"] == "Science"
    topic_slugs = [row["slug"] for row in items if row["section_type"] == SECTION_TYPE_TOPIC]
    assert topic_slugs == ["climate", "space"]
    assert any(row["section_type"] == "ribbon_ad" for row in items)
    assert "hero" in PRESERVED_CUSTOM_PAGE_KEYS
    assert DEFAULT_CUSTOM_TOPIC_LABELS == ()


def test_reserved_custom_tab_slugs() -> None:
    """Built-in page names cannot be claimed by custom tabs."""

    assert "health" in RESERVED_CUSTOM_TAB_SLUGS
    assert slugify_tab_label("My Science") == "my-science"
    try:
        assert_custom_tab_slug_allowed("entertainment")
        raise AssertionError("expected ValidationError")
    except ValidationError:
        pass


def test_region_codes_for_market_cover_full_geo_tree() -> None:
    """USA and PR market trees include country plus localities."""

    us_codes = region_codes_for_market("us")
    assert "us" in us_codes
    assert "us-fl" in us_codes
    assert any(code.startswith("us-fl-") for code in us_codes)

    pr_codes = region_codes_for_market("pr")
    assert "pr" in pr_codes
    assert any(code.startswith("pr-") and code != "pr" for code in pr_codes)

    assert region_codes_for_market("co") == ("co",)
