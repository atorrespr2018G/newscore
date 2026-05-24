"""Redis cache helpers shared across GraphQL subgraphs."""

from __future__ import annotations

import json
import os
from typing import Any

from redis.asyncio import Redis

from shared.core.logger import get_logger

logger = get_logger(__name__)

_redis: Redis | None = None


def redis_url() -> str:
    """Return configured Redis URL."""

    url = os.getenv("REDIS_URL")
    if not url:
        raise RuntimeError("Missing REDIS_URL environment variable")
    return url


def get_redis() -> Redis:
    """Return a singleton Redis client."""

    global _redis
    if _redis is None:
        _redis = Redis.from_url(redis_url(), encoding="utf-8", decode_responses=True)
    return _redis


async def get_json(key: str) -> Any | None:
    """Get cached JSON by key."""

    raw = await get_redis().get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Invalid JSON in cache key=%s", key, exc_info=True)
        return None


async def set_json(*, key: str, value: Any, ttl_seconds: int) -> None:
    """Set cached JSON by key with TTL."""

    raw = json.dumps(value, ensure_ascii=False)
    await get_redis().set(key, raw, ex=ttl_seconds)


async def delete_key(key: str) -> bool:
    """Remove a cache key. Returns True if a key was deleted."""

    deleted = await get_redis().delete(key)
    return bool(deleted)


LEGACY_HOMEPAGE_FEED_CACHE_KEY = "graphql:homepageFeed"

HOMEPAGE_FEED_TTL_SECONDS = 15


def homepage_feed_cache_key(market: str, town: str | None = None) -> str:
    """Redis cache key for a market-scoped homepage feed."""

    market_part = (market or "us").strip().lower()
    town_part = (town or "_").strip().lower()
    return f"graphql:homepageFeed:{market_part}:{town_part}"


async def invalidate_homepage_feed(market_code: str) -> int:
    """Delete all homepage feed cache keys for a market. Returns keys removed."""

    market_part = market_code.strip().lower()
    pattern = f"graphql:homepageFeed:{market_part}:*"
    redis = get_redis()
    keys = [key async for key in redis.scan_iter(match=pattern)]
    deleted = 0
    if keys:
        deleted = int(await redis.delete(*keys))
    if market_part == "us":
        if await delete_key(LEGACY_HOMEPAGE_FEED_CACHE_KEY):
            deleted += 1
    if deleted:
        logger.info("Invalidated %d homepage feed cache keys for market=%s", deleted, market_part)
    return deleted


async def invalidate_all_homepage_feeds() -> int:
    """Delete every homepage feed cache key. Returns keys removed."""

    redis = get_redis()
    keys = [key async for key in redis.scan_iter(match="graphql:homepageFeed*")]
    if not keys:
        return 0
    deleted = int(await redis.delete(*keys))
    logger.info("Invalidated %d homepage feed cache keys (all markets)", deleted)
    return deleted
