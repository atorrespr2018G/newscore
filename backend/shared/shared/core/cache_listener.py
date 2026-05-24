"""Background listener that applies cache invalidation events from Redis pub/sub."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from shared.core.cache import get_redis, invalidate_all_homepage_feeds, invalidate_homepage_feed
from shared.core.events import CACHE_INVALIDATE_CHANNEL
from shared.core.logger import get_logger

logger = get_logger(__name__)


async def _handle_invalidation(payload: dict[str, Any]) -> None:
    scope = payload.get("scope")
    if scope != "homepage_feed":
        logger.warning("Unknown cache invalidation scope: %s", scope)
        return

    if payload.get("all"):
        await invalidate_all_homepage_feeds()
        return

    for code in payload.get("market_codes") or []:
        await invalidate_homepage_feed(str(code))


async def _listen_loop() -> None:
    redis = get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(CACHE_INVALIDATE_CHANNEL)
    logger.info("Cache invalidation listener subscribed to %s", CACHE_INVALIDATE_CHANNEL)

    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            raw = message.get("data")
            if not raw:
                continue
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                logger.error("Invalid cache invalidation payload: %s", raw)
                continue
            try:
                await _handle_invalidation(payload)
            except Exception:  # noqa: BLE001 — keep listener alive
                logger.exception("Failed to handle cache invalidation event")
    finally:
        await pubsub.unsubscribe(CACHE_INVALIDATE_CHANNEL)
        await pubsub.aclose()


def start_cache_listener() -> asyncio.Task[None]:
    """Start the cache invalidation listener as a background task."""

    return asyncio.create_task(_listen_loop(), name="cache-invalidation-listener")
