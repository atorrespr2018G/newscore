"""Unit tests for per-state sports page sections and fill scope."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.geo_catalog import STATE_SPORTS_LAYOUT_PAGE_NAME, us_state_region_codes
from shared.core.sports_page_sections_sync import (
    PRESERVED_SPORTS_PAGE_KEYS,
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


def test_slugify_sport_label_matches_pr_labels() -> None:
    """PR-shaped sport labels produce stable slugs used as slot keys."""

    assert slugify_sport_label("Track and Field") == "track-and-field"
    assert slugify_sport_label("Horse Racing") == "horse-racing"
    assert "hero" in PRESERVED_SPORTS_PAGE_KEYS


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
    assert not hasattr(sync_mod, "_sync_region_sports_layouts")


@pytest.mark.asyncio
async def test_ensure_us_state_sports_sections_skips_nonempty_lists() -> None:
    """Re-running ensure keeps editorial state lists and still syncs layouts."""

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
    sync_slots.assert_awaited_once_with(
        db,
        market_id="mkt-us",
        items=existing_items,
        region_id="reg-us-fl",
    )
    assert result["created_count"] == 0
    assert result["region_codes"] == ["us-fl"]
