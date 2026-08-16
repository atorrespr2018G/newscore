"""Unit tests for Government page section labels and defaults."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.geo_catalog import STATE_GOVERNMENT_LAYOUT_PAGE_NAME
from shared.core.government_page_sections_sync import (
    PRESERVED_GOVERNMENT_PAGE_KEYS,
    default_government_page_section_items,
    slugify_government_label,
)


def test_government_layout_page_name() -> None:
    """Government boards use the government page name."""

    assert STATE_GOVERNMENT_LAYOUT_PAGE_NAME == "government"


def test_slugify_government_label_matches_topics() -> None:
    """Configured Government topics produce stable slugs used as slot keys."""

    assert slugify_government_label("Executive") == "executive"
    assert slugify_government_label("Track and Field") == "track-and-field"
    assert "hero" in PRESERVED_GOVERNMENT_PAGE_KEYS


def test_default_government_page_section_items_include_topics() -> None:
    """Defaults include hero bands plus the seven Government topics."""

    items = default_government_page_section_items(
        [
            "Executive",
            "Legislature",
            "Judiciary",
            "Agencies",
            "Services",
            "Emergency",
            "Defense",
        ],
    )
    slugs = [row["slug"] for row in items if row["section_type"] == "topic"]
    assert slugs == [
        "executive",
        "legislature",
        "judiciary",
        "agencies",
        "services",
        "emergency",
        "defense",
    ]
    types = [row["section_type"] for row in items]
    assert types[0] == "hero"
    assert "topic" in types
    assert "ribbon_ad" in types
