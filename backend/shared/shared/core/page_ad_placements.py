"""Page-level ad placement config shared by Configuration and public feeds."""

from __future__ import annotations

from typing import Any, Literal

from shared.core.exceptions import ValidationError

AdType = Literal["leaderboard", "ribbon", "rail", "tall", "square"]

AdLocation = Literal[
    "masthead",
    "after_hero",
    "before_section",
    "after_section",
    "hero_rail",
    "us_band",
    "editorial_band",
    "health_carousel",
]

AD_TYPES: frozenset[str] = frozenset(
    {"leaderboard", "ribbon", "rail", "tall", "square"},
)
AD_LOCATIONS: frozenset[str] = frozenset(
    {
        "masthead",
        "after_hero",
        "before_section",
        "after_section",
        "hero_rail",
        "us_band",
        "editorial_band",
        "health_carousel",
    },
)
SECTION_ANCHORED_LOCATIONS: frozenset[str] = frozenset(
    {"before_section", "after_section"},
)

PAGE_NAME_HOMEPAGE = "homepage"
PAGE_NAME_WORLD = "world"
PAGE_NAME_SPORTS = "sports"


def _placement(
    *,
    ad_type: AdType,
    location: AdLocation,
    enabled: bool = True,
    anchor_slug: str | None = None,
) -> dict[str, Any]:
    """Build one stored ad placement row."""

    return {
        "ad_type": ad_type,
        "location": location,
        "enabled": enabled,
        "anchor_slug": anchor_slug,
    }


DEFAULT_HOMEPAGE_ADS: list[dict[str, Any]] = [
    _placement(ad_type="leaderboard", location="masthead"),
    _placement(ad_type="ribbon", location="after_hero"),
    _placement(ad_type="ribbon", location="before_section", anchor_slug="politics"),
    _placement(ad_type="ribbon", location="before_section", anchor_slug="world"),
    _placement(ad_type="ribbon", location="before_section", anchor_slug="technology"),
    _placement(ad_type="square", location="us_band"),
    _placement(ad_type="ribbon", location="editorial_band"),
    _placement(ad_type="square", location="health_carousel"),
]

DEFAULT_WORLD_ADS: list[dict[str, Any]] = [
    _placement(ad_type="leaderboard", location="masthead"),
    _placement(ad_type="ribbon", location="after_hero"),
    _placement(ad_type="rail", location="hero_rail"),
    _placement(ad_type="ribbon", location="before_section", anchor_slug="europe"),
    _placement(ad_type="ribbon", location="before_section", anchor_slug="asia"),
    _placement(ad_type="ribbon", location="before_section", anchor_slug="middle-east"),
    _placement(ad_type="ribbon", location="after_section", anchor_slug="africa"),
    _placement(ad_type="ribbon", location="editorial_band"),
]

DEFAULT_SPORTS_ADS: list[dict[str, Any]] = [
    _placement(ad_type="leaderboard", location="masthead"),
    _placement(ad_type="ribbon", location="after_hero"),
    _placement(ad_type="ribbon", location="before_section", anchor_slug="nba"),
    _placement(ad_type="ribbon", location="before_section", anchor_slug="mlb"),
]


def default_ads_for_page(page_name: str) -> list[dict[str, Any]]:
    """Return default ad placements for a configured page name.

    Args:
        page_name: ``homepage``, ``world``, or ``sports``.

    Returns:
        A deep-copied default ads list for that page.
    """

    normalized = (page_name or "").strip().lower()
    if normalized == PAGE_NAME_WORLD:
        return [dict(row) for row in DEFAULT_WORLD_ADS]
    if normalized == PAGE_NAME_SPORTS:
        return [dict(row) for row in DEFAULT_SPORTS_ADS]
    return [dict(row) for row in DEFAULT_HOMEPAGE_ADS]


def resolve_ads_list(raw_ads: Any, *, page_name: str) -> list[dict[str, Any]]:
    """Return stored ads when present; otherwise page defaults.

    Args:
        raw_ads: Value from Mongo (list or missing).
        page_name: Page that owns the sections document.

    Returns:
        Normalized placement dicts ready for API/feed responses.
    """

    if not isinstance(raw_ads, list) or len(raw_ads) == 0:
        return default_ads_for_page(page_name)
    return normalize_ads(raw_ads)


def normalize_ads(items: list[Any]) -> list[dict[str, Any]]:
    """Validate and normalize an incoming ads list.

    Args:
        items: Raw ad placement rows from API or storage.

    Returns:
        Cleaned placement dicts.

    Raises:
        ValidationError: When a row has an invalid type, location, or anchor.
    """

    resolved: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        resolved.append(_normalize_one_ad(item, index=index))
    return resolved


def _normalize_one_ad(item: Any, *, index: int) -> dict[str, Any]:
    """Normalize a single ad placement row."""

    if hasattr(item, "model_dump"):
        data = item.model_dump()
    elif isinstance(item, dict):
        data = item
    else:
        raise ValidationError(f"Ad placement at index {index} must be an object")

    ad_type = str(data.get("ad_type") or "").strip().lower()
    location = str(data.get("location") or "").strip().lower()
    if ad_type not in AD_TYPES:
        raise ValidationError(f"Invalid ad_type at index {index}: {ad_type}")
    if location not in AD_LOCATIONS:
        raise ValidationError(f"Invalid location at index {index}: {location}")

    enabled = bool(data.get("enabled", True))
    anchor_raw = data.get("anchor_slug")
    anchor_slug = _normalize_anchor(anchor_raw, location=location, index=index)
    return _placement(
        ad_type=ad_type,  # type: ignore[arg-type]
        location=location,  # type: ignore[arg-type]
        enabled=enabled,
        anchor_slug=anchor_slug,
    )


def _normalize_anchor(value: Any, *, location: str, index: int) -> str | None:
    """Require anchor_slug for section-relative locations."""

    if location not in SECTION_ANCHORED_LOCATIONS:
        return None
    if value is None or not str(value).strip():
        raise ValidationError(
            f"anchor_slug is required for location '{location}' at index {index}",
        )
    return str(value).strip().lower()
