"""Site subgraph constants."""

from shared.core.cache import homepage_feed_cache_key

HOMEPAGE_FEED_TTL_SECONDS = 15

__all__ = ["HOMEPAGE_FEED_TTL_SECONDS", "homepage_feed_cache_key"]
