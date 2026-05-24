"""Redis pub/sub events for decoupled cache invalidation and integrations."""

from __future__ import annotations

import json
from typing import Any

from shared.core.cache import get_redis
from shared.core.logger import get_logger

logger = get_logger(__name__)

CACHE_INVALIDATE_CHANNEL = "newscore:cache:invalidate"


async def publish_cache_invalidation(payload: dict[str, Any]) -> None:
    """Publish a cache invalidation event for subscribers to handle."""

    raw = json.dumps(payload, ensure_ascii=False)
    await get_redis().publish(CACHE_INVALIDATE_CHANNEL, raw)
    logger.info("Published cache invalidation event: %s", payload)


async def publish_homepage_feed_invalidation(
    *,
    market_codes: list[str] | None = None,
    all_markets: bool = False,
) -> None:
    """Request homepage feed cache invalidation without knowing Redis key patterns."""

    payload: dict[str, Any] = {"scope": "homepage_feed"}
    if all_markets:
        payload["all"] = True
    elif market_codes:
        payload["market_codes"] = [code.strip().lower() for code in market_codes if code.strip()]
    else:
        payload["all"] = True
    await publish_cache_invalidation(payload)
