"""Tests for Redis pub/sub cache invalidation events."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1] / "shared"
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from shared.core.events import CACHE_INVALIDATE_CHANNEL, publish_homepage_feed_invalidation


@pytest.mark.asyncio
async def test_publish_homepage_feed_invalidation_all_markets() -> None:
    redis = MagicMock()
    redis.publish = AsyncMock(return_value=1)

    with patch("shared.core.events.get_redis", return_value=redis):
        await publish_homepage_feed_invalidation(all_markets=True)

    redis.publish.assert_awaited_once()
    channel, raw = redis.publish.await_args.args
    assert channel == CACHE_INVALIDATE_CHANNEL
    payload = json.loads(raw)
    assert payload == {"scope": "homepage_feed", "all": True}


@pytest.mark.asyncio
async def test_publish_homepage_feed_invalidation_market_codes() -> None:
    redis = MagicMock()
    redis.publish = AsyncMock(return_value=1)

    with patch("shared.core.events.get_redis", return_value=redis):
        await publish_homepage_feed_invalidation(market_codes=["US", "uk"])

    _, raw = redis.publish.await_args.args
    payload = json.loads(raw)
    assert payload["market_codes"] == ["us", "uk"]
