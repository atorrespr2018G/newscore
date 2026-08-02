"""Unit tests for World page section lists and layout sync."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.world_page_sections_sync import (
    DEFAULT_WORLD_SECTION_ITEMS,
    PRESERVED_WORLD_PAGE_KEYS,
    expand_world_section_items,
    slugify_section_label,
)


def test_slugify_section_label_hyphenates() -> None:
    """Region labels produce stable position keys."""

    assert slugify_section_label("Middle East") == "middle-east"
    assert "hero" in PRESERVED_WORLD_PAGE_KEYS
    assert "world-spotlight" in PRESERVED_WORLD_PAGE_KEYS


def test_default_world_section_items_cover_seed_bands() -> None:
    """Seed defaults match WORLD_PAGE_SLOT_SPECS region stack."""

    types = [row["section_type"] for row in DEFAULT_WORLD_SECTION_ITEMS]
    slugs = [row["slug"] for row in DEFAULT_WORLD_SECTION_ITEMS]
    assert types[0] == "hero"
    assert "more-top-stories" in slugs
    assert "world-spotlight" in slugs
    assert "editorial-rail" in slugs
    assert "world-latest" in slugs
    assert "world-africa" in slugs
    assert DEFAULT_WORLD_SECTION_ITEMS[slugs.index("world-spotlight")]["label"] == "Europe"


def test_expand_world_section_items_empty_uses_defaults() -> None:
    """Empty stored lists expand to the full seed stack."""

    expanded = expand_world_section_items([])
    assert expanded == [dict(row) for row in DEFAULT_WORLD_SECTION_ITEMS]


def test_expand_world_section_items_keeps_typed_order() -> None:
    """Typed lists keep caller order and skip incomplete rows."""

    items = [
        {"section_type": "rail", "slug": "editorial-rail", "label": "Latin America"},
        {"section_type": "category", "slug": "world-latest", "label": "Asia"},
        {"section_type": "category", "slug": "", "label": "Broken"},
    ]
    assert expand_world_section_items(items) == [
        {"section_type": "rail", "slug": "editorial-rail", "label": "Latin America"},
        {"section_type": "category", "slug": "world-latest", "label": "Asia"},
    ]


@pytest.mark.asyncio
async def test_sync_world_layout_slots_targets_one_region_only() -> None:
    """Region sync updates that region's World board only."""

    from shared.core import world_page_sections_sync as sync_mod

    region_layout = {"_id": "layout-fl-world"}
    apply_mock = AsyncMock(return_value=["slot-1"])

    with patch.object(
        sync_mod,
        "_ensure_world_layout",
        new=AsyncMock(return_value={"_id": "layout-market"}),
    ) as ensure_market, patch.object(
        sync_mod,
        "_ensure_region_world_layout",
        new=AsyncMock(return_value=region_layout),
    ) as ensure_region, patch.object(
        sync_mod,
        "_ensure_category",
        new=AsyncMock(return_value="cat-world"),
    ), patch.object(
        sync_mod,
        "_apply_world_slots_to_layout",
        new=apply_mock,
    ):
        await sync_mod.sync_world_layout_slots(
            MagicMock(),
            market_id="mkt-us",
            items=[
                {"section_type": "hero", "slug": "hero", "label": "World"},
                {
                    "section_type": "more_top_stories",
                    "slug": "more-top-stories",
                    "label": "USA/Canada",
                },
                {
                    "section_type": "spotlight",
                    "slug": "world-spotlight",
                    "label": "Europe",
                },
            ],
            region_id="region-fl",
        )

    ensure_region.assert_awaited_once()
    ensure_market.assert_not_awaited()
    apply_mock.assert_awaited_once()
    assert apply_mock.await_args.kwargs["layout_id"] == "layout-fl-world"
