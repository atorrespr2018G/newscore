"""Unit tests for per-geo sports page sections and fill scope."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.geo_catalog import (
    STATE_SPORTS_LAYOUT_PAGE_NAME,
    florida_county_region_codes,
    puerto_rico_town_region_codes,
    sports_curated_region_codes,
    us_state_region_codes,
)
from shared.core.markets import (
    PRESENTATION_FEATURED_BAND,
    PRESENTATION_GRID_4,
    PRESENTATION_HERO,
    PRESENTATION_LIVE_CAROUSEL,
)
from shared.core.sports_page_sections_sync import (
    PRESERVED_SPORTS_PAGE_KEYS,
    expand_legacy_section_items,
    slugify_sport_label,
)


def test_us_state_region_codes_cover_fifty_states() -> None:
    """Every US state has a curated sports region code."""

    codes = us_state_region_codes()
    assert len(codes) == 50
    assert "us-fl" in codes
    assert "us-tx" in codes
    assert "us" not in codes
    assert STATE_SPORTS_LAYOUT_PAGE_NAME == "sports"


def test_sports_curated_region_codes_include_counties_and_towns() -> None:
    """Independent sports boards cover states, Florida counties, and PR towns."""

    codes = sports_curated_region_codes()
    county_codes = florida_county_region_codes()
    town_codes = puerto_rico_town_region_codes()
    assert len(county_codes) == 67
    assert len(town_codes) == 78
    assert "us-fl-miami-dade" in county_codes
    assert "pr-san-juan" in town_codes
    assert set(us_state_region_codes()).issubset(codes)
    assert set(county_codes).issubset(codes)
    assert set(town_codes).issubset(codes)
    assert len(codes) == 50 + 67 + 78


def test_slugify_sport_label_matches_pr_labels() -> None:
    """PR-shaped sport labels produce stable slugs used as slot keys."""

    assert slugify_sport_label("Track and Field") == "track-and-field"
    assert slugify_sport_label("Horse Racing") == "horse-racing"
    assert "hero" in PRESERVED_SPORTS_PAGE_KEYS


def test_expand_legacy_section_items_prepends_fixed_bands() -> None:
    """Sport-only lists gain hero / Top Stories / Live / World before sync."""

    expanded = expand_legacy_section_items(
        [{"slug": "baseball", "label": "Baseball"}],
    )
    assert [row["section_type"] for row in expanded] == [
        "hero",
        "ribbon_ad",
        "top_stories",
        "ribbon_ad",
        "live",
        "ribbon_ad",
        "world",
        "sport",
    ]
    assert expanded[-1]["slug"] == "baseball"


def test_expand_legacy_section_items_keeps_typed_order() -> None:
    """Typed lists are not rewritten with the default fixed prefix."""

    items = [
        {"section_type": "live", "slug": "health", "label": "Live"},
        {"section_type": "hero", "slug": "hero", "label": "Sports"},
        {
            "section_type": "top_stories",
            "slug": "more-top",
            "label": "More Top Stories",
        },
    ]
    assert expand_legacy_section_items(items) == items


@pytest.mark.asyncio
async def test_sports_region_scope_uses_self_and_descendants() -> None:
    """Sports fills use the state subtree, not the whole country."""

    from shared.read import site_reads

    with patch.object(
        site_reads,
        "region_ids_self_and_descendants",
        new=AsyncMock(return_value=["reg-us-fl", "reg-us-fl-miami-dade"]),
    ) as self_desc, patch.object(
        site_reads,
        "region_ids_under_same_country",
        new=AsyncMock(return_value=["reg-us", "reg-us-fl", "reg-us-tx"]),
    ) as country:
        result = await site_reads._region_scope_ids(
            MagicMock(),
            "reg-us-fl",
            page_name="sports",
        )

    assert result == ["reg-us-fl", "reg-us-fl-miami-dade"]
    self_desc.assert_awaited_once()
    country.assert_not_awaited()


@pytest.mark.asyncio
async def test_homepage_region_scope_stays_country_wide() -> None:
    """Homepage/world fills keep country-wide eligibility."""

    from shared.read import site_reads

    with patch.object(
        site_reads,
        "region_ids_self_and_descendants",
        new=AsyncMock(return_value=["reg-us-fl"]),
    ) as self_desc, patch.object(
        site_reads,
        "region_ids_under_same_country",
        new=AsyncMock(return_value=["reg-us", "reg-us-fl", "reg-us-tx"]),
    ) as country:
        result = await site_reads._region_scope_ids(
            MagicMock(),
            "reg-us-fl",
            page_name="homepage",
        )

    assert result == ["reg-us", "reg-us-fl", "reg-us-tx"]
    country.assert_awaited_once()
    self_desc.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_sports_layout_slots_targets_one_region_only() -> None:
    """Region sync updates the state board and does not mirror to siblings."""

    from shared.core import sports_page_sections_sync as sync_mod

    market_layout = {"_id": "layout-market"}
    region_layout = {"_id": "layout-fl"}
    apply_mock = AsyncMock(return_value=["slot-1"])

    with patch.object(
        sync_mod,
        "_category_id_by_slug",
        new=AsyncMock(return_value="cat-sports"),
    ), patch.object(
        sync_mod,
        "_ensure_sports_world_category",
        new=AsyncMock(return_value="cat-world"),
    ), patch.object(
        sync_mod,
        "_ensure_sport_category",
        new=AsyncMock(return_value="cat-baseball"),
    ), patch.object(
        sync_mod,
        "_ensure_sports_layout",
        new=AsyncMock(return_value=market_layout),
    ) as ensure_market, patch.object(
        sync_mod,
        "_ensure_region_sports_layout",
        new=AsyncMock(return_value=region_layout),
    ) as ensure_region, patch.object(
        sync_mod,
        "_apply_sports_slots_to_layout",
        new=apply_mock,
    ):
        await sync_mod.sync_sports_layout_slots(
            MagicMock(),
            market_id="mkt-us",
            items=[{"slug": "baseball", "label": "Baseball"}],
            region_id="reg-us-fl",
        )

    ensure_region.assert_awaited_once()
    ensure_market.assert_not_awaited()
    apply_mock.assert_awaited_once()
    assert apply_mock.await_args.kwargs["layout_id"] == "layout-fl"
    specs = apply_mock.await_args.kwargs["slot_specs"]
    assert [spec["position_key"] for spec in specs] == [
        "hero",
        "ad-ribbon",
        "us-featured",
        "ad-ribbon-2",
        "health",
        "ad-ribbon-3",
        "world",
        "baseball",
    ]
    assert specs[0]["presentation_type"] == PRESENTATION_HERO
    assert specs[1]["presentation_type"] == "ribbon_ad"
    assert specs[2]["presentation_type"] == PRESENTATION_FEATURED_BAND
    assert specs[4]["presentation_type"] == PRESENTATION_LIVE_CAROUSEL
    assert specs[6]["presentation_type"] == PRESENTATION_FEATURED_BAND
    assert specs[7]["presentation_type"] == PRESENTATION_GRID_4
    assert [spec["order_index"] for spec in specs] == list(range(8))
    assert not hasattr(sync_mod, "_sync_region_sports_layouts")


@pytest.mark.asyncio
async def test_sync_sports_layout_slots_respects_custom_order_and_extras() -> None:
    """Typed lists control order; duplicate top_stories rows get distinct keys."""

    from shared.core import sports_page_sections_sync as sync_mod

    apply_mock = AsyncMock(return_value=["a", "b", "c"])

    with patch.object(
        sync_mod,
        "_category_id_by_slug",
        new=AsyncMock(return_value="cat-sports"),
    ), patch.object(
        sync_mod,
        "_ensure_sports_world_category",
        new=AsyncMock(return_value="cat-world"),
    ), patch.object(
        sync_mod,
        "_ensure_sport_category",
        new=AsyncMock(return_value="cat-sport"),
    ), patch.object(
        sync_mod,
        "_ensure_sports_layout",
        new=AsyncMock(return_value={"_id": "layout-pr"}),
    ), patch.object(
        sync_mod,
        "_apply_sports_slots_to_layout",
        new=apply_mock,
    ):
        await sync_mod.sync_sports_layout_slots(
            MagicMock(),
            market_id="mkt-pr",
            items=[
                {"section_type": "live", "slug": "health", "label": "Live"},
                {
                    "section_type": "top_stories",
                    "slug": "us-featured",
                    "label": "Top Stories",
                },
                {
                    "section_type": "top_stories",
                    "slug": "more-top",
                    "label": "More Top Stories",
                },
                {"section_type": "sport", "slug": "soccer", "label": "Soccer"},
            ],
        )

    specs = apply_mock.await_args.kwargs["slot_specs"]
    assert [spec["position_key"] for spec in specs] == [
        "health",
        "us-featured",
        "more-top",
        "soccer",
    ]
    assert specs[0]["order_index"] == 0
    assert specs[2]["presentation_type"] == PRESENTATION_FEATURED_BAND
    assert specs[2]["display_name"] == "More Top Stories"


@pytest.mark.asyncio
async def test_ensure_us_state_sports_sections_skips_nonempty_lists() -> None:
    """Re-running ensure keeps editorial state lists and skips layout sync."""

    from shared.core import sports_page_sections_sync as sync_mod

    existing_items = [{"slug": "soccer", "label": "Soccer"}]
    sections = MagicMock()
    sections.find_one = AsyncMock(
        side_effect=[
            {"_id": "doc-fl", "items": existing_items},
        ],
    )
    sections.insert_one = AsyncMock()
    sections.update_one = AsyncMock()

    markets = MagicMock()
    markets.find_one = AsyncMock(return_value={"_id": "mkt-us"})

    db = MagicMock()
    db.__getitem__ = MagicMock(
        side_effect=lambda name: markets if name == "markets" else sections,
    )

    with patch.object(
        sync_mod,
        "us_state_region_codes",
        return_value=("us-fl",),
    ), patch.object(
        sync_mod,
        "get_region_by_code",
        new=AsyncMock(return_value={"_id": "reg-us-fl"}),
    ), patch.object(
        sync_mod,
        "sync_sports_layout_slots",
        new=AsyncMock(),
    ) as sync_slots:
        result = await sync_mod.ensure_us_state_sports_sections(
            db,
            labels=["Baseball", "Basketball"],
        )

    sections.insert_one.assert_not_awaited()
    sections.update_one.assert_not_awaited()
    sync_slots.assert_not_awaited()
    assert result["created_count"] == 0
    assert result["region_codes"] == ["us-fl"]


@pytest.mark.asyncio
async def test_ensure_florida_county_sports_sections_creates_missing() -> None:
    """County ensure seeds missing sports lists and syncs that county board."""

    from shared.core import sports_page_sections_sync as sync_mod

    sections = MagicMock()
    sections.find_one = AsyncMock(return_value=None)
    sections.insert_one = AsyncMock()
    sections.update_one = AsyncMock()

    markets = MagicMock()
    markets.find_one = AsyncMock(return_value={"_id": "mkt-us"})

    db = MagicMock()
    db.__getitem__ = MagicMock(
        side_effect=lambda name: markets if name == "markets" else sections,
    )

    with patch.object(
        sync_mod,
        "florida_county_region_codes",
        return_value=("us-fl-miami-dade",),
    ), patch.object(
        sync_mod,
        "get_region_by_code",
        new=AsyncMock(return_value={"_id": "reg-dade"}),
    ), patch.object(
        sync_mod,
        "sync_sports_layout_slots",
        new=AsyncMock(),
    ) as sync_slots:
        result = await sync_mod.ensure_florida_county_sports_sections(
            db,
            labels=["Baseball"],
        )

    sections.insert_one.assert_awaited_once()
    sync_slots.assert_awaited_once()
    assert sync_slots.await_args.kwargs["region_id"] == "reg-dade"
    assert result["created_count"] == 1
    assert result["region_codes"] == ["us-fl-miami-dade"]


@pytest.mark.asyncio
async def test_ensure_pr_town_sports_sections_creates_missing() -> None:
    """PR town ensure seeds missing sports lists under the PR market."""

    from shared.core import sports_page_sections_sync as sync_mod

    sections = MagicMock()
    sections.find_one = AsyncMock(return_value=None)
    sections.insert_one = AsyncMock()

    markets = MagicMock()
    markets.find_one = AsyncMock(return_value={"_id": "mkt-pr"})

    db = MagicMock()
    db.__getitem__ = MagicMock(
        side_effect=lambda name: markets if name == "markets" else sections,
    )

    with patch.object(
        sync_mod,
        "puerto_rico_town_region_codes",
        return_value=("pr-san-juan",),
    ), patch.object(
        sync_mod,
        "get_region_by_code",
        new=AsyncMock(return_value={"_id": "reg-sj"}),
    ), patch.object(
        sync_mod,
        "sync_sports_layout_slots",
        new=AsyncMock(),
    ) as sync_slots:
        result = await sync_mod.ensure_pr_town_sports_sections(
            db,
            labels=["Boxing"],
        )

    markets.find_one.assert_awaited_once_with({"code": "pr"}, {"_id": 1})
    sections.insert_one.assert_awaited_once()
    assert sync_slots.await_args.kwargs["market_id"] == "mkt-pr"
    assert sync_slots.await_args.kwargs["region_id"] == "reg-sj"
    assert result["region_codes"] == ["pr-san-juan"]
