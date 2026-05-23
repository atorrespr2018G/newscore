"""Site subgraph constants."""

HOMEPAGE_FEED_TTL_SECONDS = 15
LEGACY_HOMEPAGE_FEED_CACHE_KEY = "graphql:homepageFeed"


def homepage_feed_cache_key(market: str, town: str | None = None) -> str:
    """Redis cache key for a market-scoped homepage feed."""

    market_part = (market or "us").strip().lower()
    town_part = (town or "_").strip().lower()
    return f"graphql:homepageFeed:{market_part}:{town_part}"
