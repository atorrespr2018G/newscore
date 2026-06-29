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
PLACEMENT_EVENTS_COLLECTION = "placement_events"
USER_VIEW_STATE_COLLECTION = "user_view_state"


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Ensure required MongoDB indexes exist (safe to call on every startup)."""

    await db[USERS_COLLECTION].create_index("email", unique=True)
    await db[CATEGORIES_COLLECTION].create_index("slug", unique=True)
    await db[MARKETS_COLLECTION].create_index("code", unique=True)
    await db[ARTICLES_COLLECTION].create_index("slug", unique=True)
    await db[ARTICLES_COLLECTION].create_index([("status", 1), ("published_at", -1)])
    await db[ARTICLES_COLLECTION].create_index([("market_ids", 1), ("status", 1)])
    await db[ARTICLES_COLLECTION].create_index([("title", "text"), ("body", "text")])
    # Supports counting stories newly entering review since a user's last visit.
    await db[ARTICLES_COLLECTION].create_index([("status", 1), ("review_submitted_at", -1)])
    await db[LAYOUTS_COLLECTION].create_index([("page_name", 1), ("market_id", 1), ("is_active", 1)])
    # Badge query scans placement events by market scoped to a recency window.
    await db[PLACEMENT_EVENTS_COLLECTION].create_index([("market_id", 1), ("placed_at", -1)])
    await db[PLACEMENT_EVENTS_COLLECTION].create_index([("article_id", 1), ("slot_id", 1)], unique=True)
    # One last-seen record per user per workflow view.
    await db[USER_VIEW_STATE_COLLECTION].create_index([("user_id", 1), ("view", 1)], unique=True)
    logger.info("MongoDB indexes ensured")
