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
