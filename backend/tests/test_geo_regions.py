"""Geo hierarchy unit tests for cache/events/helpers."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.cache import homepage_feed_cache_key
from shared.core.cache_invalidation import invalidate_homepage_for_article
from shared.core.events import CACHE_INVALIDATE_CHANNEL, publish_homepage_feed_invalidation


def test_homepage_feed_cache_key_region_versioned() -> None:
    """Region-scoped cache key should include category and version token."""

    key = homepage_feed_cache_key(
        "us",
        None,
        page_name="homepage",
        region_code="us-fl-miami-dade",
        category_slug="politics",
        version=7,
    )
    assert key == "graphql:homepageFeed:homepage:us-fl-miami-dade:politics:v7"


def test_homepage_feed_cache_key_legacy_market_town_versioned() -> None:
    """Legacy market/town key keeps scope while adding version token."""

    key = homepage_feed_cache_key("pr", "san-juan", page_name="homepage", version=3)
    assert key == "graphql:homepageFeed:homepage:pr:san-juan:v3"


@pytest.mark.asyncio
async def test_publish_homepage_feed_invalidation_region_codes() -> None:
    """Region invalidation events should normalize and emit region_codes payload."""

    redis = MagicMock()
    redis.publish = AsyncMock(return_value=1)

    with patch("shared.core.events.get_redis", return_value=redis):
        await publish_homepage_feed_invalidation(region_codes=["US-FL", "Pr-San-Juan"])

    channel, raw = redis.publish.await_args.args
    assert channel == CACHE_INVALIDATE_CHANNEL
    payload = json.loads(raw)
    assert payload == {"scope": "homepage_feed", "region_codes": ["us-fl", "pr-san-juan"]}


@pytest.mark.asyncio
async def test_invalidate_homepage_for_article_prefers_region_ids() -> None:
    """Article invalidation should use effective region ids when available."""

    with patch(
        "shared.core.cache_invalidation.invalidate_homepage_for_region_ids",
        new=AsyncMock(),
    ) as region_invalidate, patch(
        "shared.core.cache_invalidation.invalidate_homepage_for_market_ids",
        new=AsyncMock(),
    ) as market_invalidate:
        await invalidate_homepage_for_article(
            MagicMock(),
            {
                "effective_region_ids": ["region-1", "region-2"],
                "market_ids": ["market-1"],
            },
        )

    region_invalidate.assert_awaited_once()
    market_invalidate.assert_not_awaited()
