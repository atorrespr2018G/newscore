"""Unit tests for main (homepage) page section lists and layout sync."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.homepage_page_sections_sync import (
    DEFAULT_HOMEPAGE_SECTION_ITEMS,
    PRESERVED_HOMEPAGE_PAGE_KEYS,
    expand_homepage_section_items,
    slugify_section_label,
)
from shared.core.markets import (
    PRESENTATION_EDITORIAL_LEAD,
    PRESENTATION_EDITORIAL_SPOTLIGHT,
    PRESENTATION_FEATURED_BAND,
    PRESENTATION_GRID_4,
    PRESENTATION_HERO,
    PRESENTATION_LIVE_CAROUSEL,
    PRESENTATION_RAIL_COMPACT,
)


def test_slugify_section_label_hyphenates() -> None:
    """Category labels produce stable position keys."""

    assert slugify_section_label("Track and Field") == "track-and-field"
    assert "hero" in PRESERVED_HOMEPAGE_PAGE_KEYS
    assert "us-featured" in PRESERVED_HOMEPAGE_PAGE_KEYS


def test_default_homepage_section_items_cover_landing_bands() -> None:
    """Seed defaults include Politics, Sports, Live, Entertainment, Extra Stories."""

    types = [row["section_type"] for row in DEFAULT_HOMEPAGE_SECTION_ITEMS]
    slugs = [row["slug"] for row in DEFAULT_HOMEPAGE_SECTION_ITEMS]
    assert types[0] == "hero"
    assert "politics" in slugs
    assert "sports" in slugs
    assert "health" in slugs
    assert "entertainment" in slugs
    assert "technology" in slugs
    assert "business" in slugs
    assert "more-top-stories-2" in slugs
    assert DEFAULT_HOMEPAGE_SECTION_ITEMS[
        slugs.index("more-top-stories-2")
    ]["label"] == "Extra Stories"


def test_expand_homepage_section_items_empty_uses_defaults() -> None:
    """Empty stored lists expand to the full seed stack."""

    expanded = expand_homepage_section_items([])
    assert expanded == [dict(row) for row in DEFAULT_HOMEPAGE_SECTION_ITEMS]


def test_expand_homepage_section_items_keeps_typed_order() -> None:
    """Typed lists keep caller order and skip incomplete rows."""

    items = [
        {"section_type": "live", "slug": "health", "label": "Live"},
        {"section_type": "category", "slug": "politics", "label": "Politics"},
        {"section_type": "category", "slug": "", "label": "Broken"},
    ]
    assert expand_homepage_section_items(items) == [
        {"section_type": "live", "slug": "health", "label": "Live"},
        {"section_type": "category", "slug": "politics", "label": "Politics"},
    ]


@pytest.mark.asyncio
async def test_sync_homepage_layout_slots_targets_one_region_only() -> None:
    """Region sync updates that region's homepage board only."""

    from shared.core import homepage_page_sections_sync as sync_mod

    region_layout = {"_id": "layout-fl-home"}
    apply_mock = AsyncMock(return_value=["slot-1"])

    with patch.object(
        sync_mod,
        "_ensure_homepage_layout",
        new=AsyncMock(return_value={"_id": "layout-market"}),
    ) as ensure_market, patch.object(
        sync_mod,
        "_ensure_region_homepage_layout",
        new=AsyncMock(return_value=region_layout),
    ) as ensure_region, patch.object(
        sync_mod,
        "_category_id_by_slug",
        new=AsyncMock(return_value="cat-health"),
    ), patch.object(
        sync_mod,
        "_ensure_category",
        new=AsyncMock(return_value="cat-politics"),
    ), patch.object(
        sync_mod,
        "_apply_homepage_slots_to_layout",
        new=apply_mock,
    ):
        await sync_mod.sync_homepage_layout_slots(
            MagicMock(),
            market_id="mkt-us",
            items=[
                {"section_type": "hero", "slug": "hero", "label": "Hero"},
                {
                    "section_type": "top_stories",
                    "slug": "us-featured",
                    "label": "Top Stories",
                },
                {"section_type": "live", "slug": "health", "label": "Live"},
                {
                    "section_type": "more_top_stories",
                    "slug": "more-top-stories",
                    "label": "More Top Stories",
                },
                {
                    "section_type": "spotlight",
                    "slug": "midterm-elections",
                    "label": "Government",
                },
                {
                    "section_type": "rail",
                    "slug": "editorial-rail",
                    "label": "Sports",
                },
                {
                    "section_type": "category",
                    "slug": "politics",
                    "label": "Politics",
                },
            ],
            region_id="reg-us-fl",
        )

    ensure_region.assert_awaited_once()
    ensure_market.assert_not_awaited()
    apply_mock.assert_awaited_once()
    assert apply_mock.await_args.kwargs["layout_id"] == "layout-fl-home"
    specs = apply_mock.await_args.kwargs["slot_specs"]
    assert [spec["position_key"] for spec in specs] == [
        "hero",
        "us-featured",
        "health",
        "more-top-stories",
        "midterm-elections",
        "editorial-rail",
        "politics",
    ]
    assert specs[0]["presentation_type"] == PRESENTATION_HERO
    assert specs[1]["presentation_type"] == PRESENTATION_FEATURED_BAND
    assert specs[2]["presentation_type"] == PRESENTATION_LIVE_CAROUSEL
    assert specs[3]["presentation_type"] == PRESENTATION_EDITORIAL_LEAD
    assert specs[4]["presentation_type"] == PRESENTATION_EDITORIAL_SPOTLIGHT
    assert specs[5]["presentation_type"] == PRESENTATION_RAIL_COMPACT
    assert specs[6]["presentation_type"] == PRESENTATION_GRID_4
    assert [spec["order_index"] for spec in specs] == list(range(7))
