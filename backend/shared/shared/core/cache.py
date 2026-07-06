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
REGION_FEED_VERSION_KEY_PREFIX = "graphql:homepageFeed:regionVersion"

HOMEPAGE_FEED_TTL_SECONDS = 15


def homepage_feed_cache_key(
    market: str,
    town: str | None = None,
    *,
    page_name: str = "homepage",
    region_code: str | None = None,
    category_slug: str | None = None,
    version: int = 1,
) -> str:
    """Redis cache key for a page feed with optional region scope/version."""

    page_part = (page_name or "homepage").strip().lower()
    region_part = (region_code or market or "us").strip().lower()
    category_part = (category_slug or "_").strip().lower()
    if region_code:
        return f"graphql:homepageFeed:{page_part}:{region_part}:{category_part}:v{max(1, int(version))}"
    town_part = (town or "_").strip().lower()
    return f"graphql:homepageFeed:{page_part}:{region_part}:{town_part}:v{max(1, int(version))}"


def region_feed_version_key(region_code: str) -> str:
    """Return Redis key storing the monotonic feed version for a region."""

    normalized = (region_code or "us").strip().lower()
    return f"{REGION_FEED_VERSION_KEY_PREFIX}:{normalized}"


async def get_region_feed_version(region_code: str) -> int:
    """Read current region feed version (defaults to 1)."""

    raw = await get_redis().get(region_feed_version_key(region_code))
    if raw is None:
        return 1
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return 1
    return max(1, parsed)


async def bump_region_feed_version(region_code: str) -> int:
    """Increment and return region feed version."""

    next_version = int(await get_redis().incr(region_feed_version_key(region_code)))
    return max(1, next_version)


async def invalidate_homepage_feed(market_code: str) -> int:
    """Invalidate market-scoped feed cache by bumping region version and cleaning legacy keys."""

    market_part = (market_code or "us").strip().lower()
    await bump_region_feed_version(market_part)

    # Compatibility cleanup for old non-versioned keys that may still exist.
    pattern = f"graphql:homepageFeed:*:{market_part}:*"
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
