"""MongoDB index bootstrap — idempotent create_index on app startup."""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.logger import get_logger

logger = get_logger(__name__)

USERS_COLLECTION = "users"
CATEGORIES_COLLECTION = "categories"
MARKETS_COLLECTION = "markets"
ARTICLES_COLLECTION = "articles"
LAYOUTS_COLLECTION = "layouts"


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Ensure required MongoDB indexes exist (safe to call on every startup)."""

    await db[USERS_COLLECTION].create_index("email", unique=True)
    await db[CATEGORIES_COLLECTION].create_index("slug", unique=True)
    await db[MARKETS_COLLECTION].create_index("code", unique=True)
    await db[ARTICLES_COLLECTION].create_index("slug", unique=True)
    await db[ARTICLES_COLLECTION].create_index([("status", 1), ("published_at", -1)])
    await db[ARTICLES_COLLECTION].create_index([("market_ids", 1), ("status", 1)])
    await db[ARTICLES_COLLECTION].create_index([("title", "text"), ("body", "text")])
    await db[LAYOUTS_COLLECTION].create_index([("page_name", 1), ("market_id", 1), ("is_active", 1)])
    logger.info("MongoDB indexes ensured")
