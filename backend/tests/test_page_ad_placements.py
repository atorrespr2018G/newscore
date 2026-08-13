"""Unit tests for page-level ad placement defaults and normalization."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.exceptions import ValidationError
from shared.core.page_ad_placements import (
    DEFAULT_HOMEPAGE_ADS,
    DEFAULT_SPORTS_ADS,
    DEFAULT_WORLD_ADS,
    STACKING_AD_LOCATIONS,
    default_ads_for_page,
    normalize_ads,
    resolve_ads_list,
)


def test_default_ads_for_page_returns_page_specific_lists() -> None:
    """Each configured page gets its own default inventory."""

    assert default_ads_for_page("homepage") == [dict(row) for row in DEFAULT_HOMEPAGE_ADS]
    assert default_ads_for_page("world") == [dict(row) for row in DEFAULT_WORLD_ADS]
    assert default_ads_for_page("sports") == [dict(row) for row in DEFAULT_SPORTS_ADS]
    assert default_ads_for_page("unknown") == [dict(row) for row in DEFAULT_HOMEPAGE_ADS]


def test_default_homepage_ads_cover_shell_locations() -> None:
    """Homepage defaults cover masthead and in-module ads, not in-feed ribbons."""

    locations = {(row["location"], row.get("anchor_slug")) for row in DEFAULT_HOMEPAGE_ADS}
    assert ("masthead", None) in locations
    assert ("us_band", None) in locations
    assert ("editorial_band", None) in locations
    assert ("health_carousel", None) in locations


def test_default_ads_omit_stacking_ribbon_locations() -> None:
    """Page defaults leave in-feed ribbons to the section list."""

    for page_name in ("homepage", "world", "sports"):
        for row in default_ads_for_page(page_name):
            assert row["location"] not in STACKING_AD_LOCATIONS


def test_resolve_ads_list_falls_back_when_missing_or_empty() -> None:
    """Missing or empty stored ads resolve to page defaults."""

    assert resolve_ads_list(None, page_name="world") == default_ads_for_page("world")
    assert resolve_ads_list([], page_name="sports") == default_ads_for_page("sports")


def test_normalize_ads_accepts_valid_rows() -> None:
    """Valid rows are lowercased and keep enabled/anchor fields."""

    normalized = normalize_ads(
        [
            {
                "ad_type": "Leaderboard",
                "location": "Masthead",
                "enabled": False,
            },
            {
                "ad_type": "ribbon",
                "location": "before_section",
                "enabled": True,
                "anchor_slug": "Politics",
            },
        ]
    )
    assert normalized == [
        {
            "ad_type": "leaderboard",
            "location": "masthead",
            "enabled": False,
            "anchor_slug": None,
        },
        {
            "ad_type": "ribbon",
            "location": "before_section",
            "enabled": True,
            "anchor_slug": "politics",
        },
    ]


def test_normalize_ads_rejects_invalid_type() -> None:
    """Unknown ad_type raises ValidationError."""

    with pytest.raises(ValidationError, match="Invalid ad_type"):
        normalize_ads([{"ad_type": "banner", "location": "masthead"}])


def test_normalize_ads_rejects_invalid_location() -> None:
    """Unknown location raises ValidationError."""

    with pytest.raises(ValidationError, match="Invalid location"):
        normalize_ads([{"ad_type": "ribbon", "location": "footer"}])


def test_normalize_ads_requires_anchor_for_section_locations() -> None:
    """before_section / after_section require anchor_slug."""

    with pytest.raises(ValidationError, match="anchor_slug is required"):
        normalize_ads([{"ad_type": "ribbon", "location": "before_section"}])
