"""Unit tests for main (homepage) page section lists and layout sync."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))
_LAYOUT = _ROOT / "layout_admin_app"
if str(_LAYOUT) not in sys.path:
    sys.path.insert(0, str(_LAYOUT))

from shared.core.homepage_page_sections_sync import (
    DEFAULT_HOMEPAGE_SECTION_ITEMS,
    PRESERVED_HOMEPAGE_PAGE_KEYS,
    expand_homepage_section_items,
    has_post_hero_ribbon_ad_section,
    insert_legacy_homepage_ribbon_ads,
    migrate_legacy_election_section,
    migrate_remove_primary_more_top_stories,
    migrate_collapse_consecutive_ribbon_ads,
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
    PRESENTATION_RIBBON_AD,
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
    assert types[1] == "ribbon_ad"
    assert slugs[1] == "ad-ribbon"
    assert "more-top-stories" not in slugs
    assert "politics" in slugs
    assert "sports" in slugs
    assert "government" in slugs
    assert "health" in slugs
    assert "entertainment" in slugs
    assert "technology" in slugs
    assert "business" in slugs
    assert "more-top-stories-2" in slugs
    assert DEFAULT_HOMEPAGE_SECTION_ITEMS[
        slugs.index("more-top-stories-2")
    ]["label"] == "Extra Stories"
    elections_index = slugs.index("midterm-elections")
    politics_index = slugs.index("politics")
    assert types[elections_index] == "category"
    assert elections_index == politics_index + 1


def test_migrate_remove_primary_more_top_stories_keeps_extra() -> None:
    """Primary More Top Stories is dropped; Extra Stories remains."""

    items = [
        {"section_type": "top_stories", "slug": "us-featured", "label": "Top Stories"},
        {"section_type": "ribbon_ad", "slug": "ad-ribbon-2", "label": "Ribbon Advertisement"},
        {"section_type": "more_top_stories", "slug": "more-top-stories", "label": "More Top Stories"},
        {"section_type": "category", "slug": "politics", "label": "Politics"},
        {
            "section_type": "more_top_stories",
            "slug": "more-top-stories-2",
            "label": "Extra Stories",
        },
    ]

    migrated = migrate_remove_primary_more_top_stories(items)

    assert [item["slug"] for item in migrated] == [
        "us-featured",
        "politics",
        "more-top-stories-2",
    ]


def test_migrate_collapse_consecutive_ribbon_ads_keeps_one() -> None:
    """Stacked ribbon rows collapse to a single advertisement."""

    items = [
        {"section_type": "top_stories", "slug": "us-featured", "label": "Top Stories"},
        {"section_type": "ribbon_ad", "slug": "ad-ribbon", "label": "Ribbon Advertisement"},
        {"section_type": "ribbon_ad", "slug": "ad-ribbon-2", "label": "Ribbon Advertisement"},
        {"section_type": "category", "slug": "politics", "label": "Politics"},
        {"section_type": "ribbon_ad", "slug": "ad-ribbon-3", "label": "Ribbon Advertisement"},
    ]

    migrated = migrate_collapse_consecutive_ribbon_ads(items)

    assert [item["slug"] for item in migrated] == [
        "us-featured",
        "ad-ribbon",
        "politics",
        "ad-ribbon-3",
    ]


def test_migrate_legacy_election_section_moves_it_after_politics() -> None:
    """The old Election spotlight becomes the horizontal category section."""

    items = [
        {"section_type": "more_top_stories", "slug": "more-top-stories", "label": "More Top Stories"},
        {"section_type": "spotlight", "slug": "midterm-elections", "label": "Elections"},
        {"section_type": "rail", "slug": "editorial-rail", "label": "Sports"},
        {"section_type": "category", "slug": "politics", "label": "Politics"},
    ]

    migrated = migrate_legacy_election_section(items)

    assert [item["slug"] for item in migrated] == [
        "more-top-stories",
        "editorial-rail",
        "politics",
        "midterm-elections",
    ]
    assert migrated[-1]["section_type"] == "category"


def test_insert_legacy_homepage_ribbon_ads_places_post_hero_ribbon() -> None:
    """Legacy homepage heuristics put a ribbon between Hero and Top Stories."""

    items = insert_legacy_homepage_ribbon_ads(
        [
            {"section_type": "hero", "slug": "hero", "label": "Hero"},
            {
                "section_type": "top_stories",
                "slug": "us-featured",
                "label": "Top Stories",
            },
            {"section_type": "live", "slug": "health", "label": "Live"},
        ],
    )
    assert [row["section_type"] for row in items] == [
        "hero",
        "ribbon_ad",
        "top_stories",
        "ribbon_ad",
        "live",
    ]
    assert items[1]["slug"] == "ad-ribbon"


def test_insert_legacy_homepage_ribbon_ads_repairs_existing_ribbon_location() -> None:
    """Existing regional ribbons do not replace the required post-hero ribbon."""

    items = insert_legacy_homepage_ribbon_ads(
        [
            {"section_type": "hero", "slug": "hero", "label": "Hero"},
            {"section_type": "top_stories", "slug": "us-featured", "label": "Top Stories"},
            {"section_type": "ribbon_ad", "slug": "ad-ribbon", "label": "Ribbon Advertisement"},
        ],
    )
    assert [row["section_type"] for row in items[:3]] == ["hero", "ribbon_ad", "top_stories"]
    assert has_post_hero_ribbon_ad_section(items)


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


def test_expand_homepage_section_items_keeps_ribbon_ad() -> None:
    """Ribbon advertisement rows stay in configured order."""

    items = [
        {"section_type": "hero", "slug": "hero", "label": "Hero"},
        {
            "section_type": "ribbon_ad",
            "slug": "ad-ribbon",
            "label": "Ribbon Advertisement",
        },
        {"section_type": "live", "slug": "health", "label": "Live"},
    ]
    assert expand_homepage_section_items(items) == [
        {"section_type": "hero", "slug": "hero", "label": "Hero"},
        {
            "section_type": "ribbon_ad",
            "slug": "ad-ribbon",
            "label": "Ribbon Advertisement",
        },
        {"section_type": "live", "slug": "health", "label": "Live"},
    ]


def test_normalize_items_renumbers_duplicate_ribbon_slugs() -> None:
    """Empty/new ribbon rows dragged above numbered ones do not fail save."""

    from shared.schemas.homepage_page_sections_schemas import HomepagePageSectionItemIn
    from layout_admin_app.services.homepage_page_sections_service import _normalize_items

    items = [
        HomepagePageSectionItemIn(section_type="hero", label="Hero", slug="hero"),
        HomepagePageSectionItemIn(
            section_type="ribbon_ad",
            label="Ribbon Advertisement",
            slug=None,
        ),
        HomepagePageSectionItemIn(
            section_type="ribbon_ad",
            label="Ribbon Advertisement",
            slug="ad-ribbon",
        ),
        HomepagePageSectionItemIn(
            section_type="ribbon_ad",
            label="Ribbon Advertisement",
            slug="ad-ribbon-2",
        ),
    ]
    resolved = _normalize_items(items)
    slugs = [row["slug"] for row in resolved]
    assert slugs == ["hero", "ad-ribbon", "ad-ribbon-2", "ad-ribbon-3"]
    assert len(slugs) == len(set(slugs))


def test_normalize_items_allows_migrated_election_category() -> None:
    """The horizontal Election row retains its legacy slot key and pins."""

    from shared.schemas.homepage_page_sections_schemas import HomepagePageSectionItemIn
    from layout_admin_app.services.homepage_page_sections_service import _normalize_items

    resolved = _normalize_items(
        [
            HomepagePageSectionItemIn(
                section_type="category",
                label="Elections",
                slug="midterm-elections",
            ),
        ],
    )

    assert resolved == [
        {
            "section_type": "category",
            "label": "Elections",
            "slug": "midterm-elections",
        },
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


@pytest.mark.asyncio
async def test_sync_homepage_layout_slots_maps_ribbon_ad() -> None:
    """Ribbon advertisement sections sync to ribbon_ad presentation slots."""

    from shared.core import homepage_page_sections_sync as sync_mod

    apply_mock = AsyncMock(return_value=["slot-1"])

    with patch.object(
        sync_mod,
        "_ensure_homepage_layout",
        new=AsyncMock(return_value={"_id": "layout-market"}),
    ), patch.object(
        sync_mod,
        "_category_id_by_slug",
        new=AsyncMock(return_value=None),
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
                    "section_type": "ribbon_ad",
                    "slug": "ad-ribbon",
                    "label": "Ribbon Advertisement",
                },
                {"section_type": "live", "slug": "health", "label": "Live"},
            ],
        )

    specs = apply_mock.await_args.kwargs["slot_specs"]
    assert specs[1]["presentation_type"] == PRESENTATION_RIBBON_AD
    assert specs[1]["position_key"] == "ad-ribbon"
    assert specs[1]["limit"] == 0
    assert specs[1]["category_id"] is None
