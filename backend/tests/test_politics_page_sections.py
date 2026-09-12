"""Unit tests for Politics page section lists and layout sync."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.politics_page_sections_sync import (
    DEFAULT_POLITICS_SECTION_ITEMS,
    PRESERVED_POLITICS_PAGE_KEYS,
    expand_politics_section_items,
    region_category_slug_for_item,
    slugify_section_label,
)


def test_slugify_section_label_hyphenates() -> None:
    """Topic labels produce stable position keys."""

    assert slugify_section_label("Courts & Law") == "courts-law"
    assert "hero" in PRESERVED_POLITICS_PAGE_KEYS
    assert "politics-spotlight" in PRESERVED_POLITICS_PAGE_KEYS


def test_default_politics_section_items_cover_seed_bands() -> None:
    """Seed defaults match POLITICS_PAGE_SLOT_SPECS topic stack."""

    types = [row["section_type"] for row in DEFAULT_POLITICS_SECTION_ITEMS]
    slugs = [row["slug"] for row in DEFAULT_POLITICS_SECTION_ITEMS]
    assert types[0] == "hero"
    assert "more-top-stories" in slugs
    assert "politics-spotlight" in slugs
    assert "editorial-rail" in slugs
    assert "politics-latest" in slugs
    assert "politics-opinion" in slugs
    assert DEFAULT_POLITICS_SECTION_ITEMS[slugs.index("politics-spotlight")]["label"] == "Elections"


def test_expand_politics_section_items_empty_uses_defaults() -> None:
    """Empty stored lists expand to the full seed stack."""

    expanded = expand_politics_section_items([])
    assert expanded == [dict(row) for row in DEFAULT_POLITICS_SECTION_ITEMS]


def test_expand_politics_section_items_keeps_typed_order() -> None:
    """Typed lists keep caller order and skip incomplete rows."""

    items = [
        {"section_type": "rail", "slug": "editorial-rail", "label": "White House"},
        {"section_type": "category", "slug": "politics-latest", "label": "Policy"},
        {"section_type": "category", "slug": "", "label": "Broken"},
    ]
    assert expand_politics_section_items(items) == [
        {"section_type": "rail", "slug": "editorial-rail", "label": "White House"},
        {"section_type": "category", "slug": "politics-latest", "label": "Policy"},
    ]


def test_region_category_slug_for_item_maps_seeded_topics() -> None:
    """Editorial topics get friendly slugs; compact rows keep position keys."""

    assert (
        region_category_slug_for_item(
            {"section_type": "spotlight", "slug": "politics-spotlight", "label": "Elections"},
        )
        == "elections"
    )
    assert (
        region_category_slug_for_item(
            {"section_type": "rail", "slug": "editorial-rail", "label": "White House"},
        )
        == "white-house"
    )
    assert (
        region_category_slug_for_item(
            {"section_type": "category", "slug": "politics-latest", "label": "Policy"},
        )
        == "politics-latest"
    )
    assert region_category_slug_for_item({"section_type": "hero", "slug": "hero", "label": "Politics"}) is None


@pytest.mark.asyncio
async def test_sync_politics_layout_slots_targets_one_region_only() -> None:
    """Region sync updates that region's Politics board only."""

    from shared.core import politics_page_sections_sync as sync_mod

    region_layout = {"_id": "layout-fl-politics"}
    apply_mock = AsyncMock(return_value=["slot-1"])

    with patch.object(
        sync_mod,
        "_ensure_politics_layout",
        new=AsyncMock(return_value={"_id": "layout-market"}),
    ) as ensure_market, patch.object(
        sync_mod,
        "_ensure_region_politics_layout",
        new=AsyncMock(return_value=region_layout),
    ) as ensure_region, patch.object(
        sync_mod,
        "_ensure_category",
        new=AsyncMock(return_value="cat-politics"),
    ), patch.object(
        sync_mod,
        "_apply_politics_slots_to_layout",
        new=apply_mock,
    ):
        await sync_mod.sync_politics_layout_slots(
            MagicMock(),
            market_id="mkt-us",
            items=[
                {"section_type": "hero", "slug": "hero", "label": "Politics"},
                {
                    "section_type": "more_top_stories",
                    "slug": "more-top-stories",
                    "label": "Congress",
                },
                {
                    "section_type": "spotlight",
                    "slug": "politics-spotlight",
                    "label": "Elections",
                },
            ],
            region_id="region-fl",
        )

    ensure_region.assert_awaited_once()
    ensure_market.assert_not_awaited()
    apply_mock.assert_awaited_once()
    assert apply_mock.await_args.kwargs["layout_id"] == "layout-fl-politics"
