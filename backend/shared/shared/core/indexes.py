"""MongoDB index bootstrap - idempotent create_index on app startup."""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import OperationFailure

from shared.core.logger import get_logger

logger = get_logger(__name__)

USERS_COLLECTION = "users"
CATEGORIES_COLLECTION = "categories"
MARKETS_COLLECTION = "markets"
REGIONS_COLLECTION = "regions"
ARTICLES_COLLECTION = "articles"
LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
SPORTS_PAGE_SECTIONS_COLLECTION = "sports_page_sections"
GOVERNMENT_PAGE_SECTIONS_COLLECTION = "government_page_sections"
ENTERTAINMENT_PAGE_SECTIONS_COLLECTION = "entertainment_page_sections"
HOMEPAGE_PAGE_SECTIONS_COLLECTION = "homepage_page_sections"
WORLD_PAGE_SECTIONS_COLLECTION = "world_page_sections"
PLACEMENT_EVENTS_COLLECTION = "placement_events"
USER_VIEW_STATE_COLLECTION = "user_view_state"


async def _create_index_compat(
    db: AsyncIOMotorDatabase,
    collection: str,
    keys,
    **kwargs,
) -> None:
    """Create an index while tolerating legacy auto-name conflicts."""

    try:
        await db[collection].create_index(keys, **kwargs)
    except OperationFailure as exc:
        if exc.code == 85 and "already exists with a different name" in str(exc):
            logger.info("Skipping index create on %s due to existing legacy name: %s", collection, keys)
            return
        raise


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Ensure required MongoDB indexes exist (safe to call on every startup)."""

    await _create_index_compat(db, USERS_COLLECTION, "email", unique=True)
    await _create_index_compat(db, CATEGORIES_COLLECTION, "slug", unique=True)
    await _create_index_compat(db, MARKETS_COLLECTION, "code", unique=True)

    await _create_index_compat(db, REGIONS_COLLECTION, [("code", 1)], unique=True, name="regions_code_uq")
    await _create_index_compat(db, REGIONS_COLLECTION, [("path", 1)], unique=True, name="regions_path_uq")
    await _create_index_compat(
        db,
        REGIONS_COLLECTION,
        [("parent_id", 1), ("is_active", 1)],
        name="regions_parent_active",
    )
    await _create_index_compat(
        db,
        REGIONS_COLLECTION,
        [("ancestor_ids", 1), ("is_active", 1)],
        name="regions_ancestor_active",
    )
    await _create_index_compat(
        db,
        REGIONS_COLLECTION,
        [("country_code", 1), ("kind", 1), ("is_active", 1)],
        name="regions_country_kind_active",
    )

    await _create_index_compat(db, ARTICLES_COLLECTION, "slug", unique=True)
    await _create_index_compat(
        db,
        ARTICLES_COLLECTION,
        [("status", 1), ("published_at", -1)],
        name="articles_status_published",
    )
    await _create_index_compat(
        db,
        ARTICLES_COLLECTION,
        [("market_ids", 1), ("status", 1)],
        name="articles_market_status",
    )
    await _create_index_compat(
        db,
        ARTICLES_COLLECTION,
        [("effective_region_ids", 1), ("status", 1), ("published_at", -1)],
        name="articles_effective_region_status_published",
    )
    # category_ids and effective_region_ids are both arrays; MongoDB cannot
    # compound-index two parallel multikey arrays on the same collection.
    await _create_index_compat(
        db,
        ARTICLES_COLLECTION,
        [("category_ids", 1), ("status", 1), ("published_at", -1)],
        name="articles_category_status_published",
    )
    await _create_index_compat(
        db,
        ARTICLES_COLLECTION,
        [("direct_region_ids", 1), ("updated_at", -1)],
        name="articles_direct_region_updated",
    )
    await _create_index_compat(db, ARTICLES_COLLECTION, [("title", "text"), ("body", "text")])
    # Supports counting stories newly entering review since a user's last visit.
    await _create_index_compat(db, ARTICLES_COLLECTION, [("status", 1), ("review_submitted_at", -1)])

    await _create_index_compat(
        db,
        LAYOUTS_COLLECTION,
        [("page_name", 1), ("market_id", 1), ("is_active", 1)],
        name="layouts_page_market_active",
    )
    await _create_index_compat(
        db,
        LAYOUTS_COLLECTION,
        [("region_id", 1), ("page_name", 1), ("is_active", 1)],
        name="layouts_region_page_active",
    )
    await _create_index_compat(
        db,
        SLOTS_COLLECTION,
        [("layout_id", 1), ("order_index", 1)],
        name="slots_layout_order",
    )
    # Drop legacy market-only unique index before installing (market_id, region_id).
    try:
        await db[SPORTS_PAGE_SECTIONS_COLLECTION].drop_index("sports_page_sections_market_uq")
    except OperationFailure as exc:
        # 27 = IndexNotFound — already migrated or fresh DB.
        if exc.code != 27:
            raise

    await _create_index_compat(
        db,
        SPORTS_PAGE_SECTIONS_COLLECTION,
        [("market_id", 1), ("region_id", 1)],
        unique=True,
        name="sports_page_sections_market_region_uq",
    )
    await _create_index_compat(
        db,
        HOMEPAGE_PAGE_SECTIONS_COLLECTION,
        [("market_id", 1), ("region_id", 1)],
        unique=True,
        name="homepage_page_sections_market_region_uq",
    )
    await _create_index_compat(
        db,
        WORLD_PAGE_SECTIONS_COLLECTION,
        [("market_id", 1), ("region_id", 1)],
        unique=True,
        name="world_page_sections_market_region_uq",
    )
    await _create_index_compat(
        db,
        GOVERNMENT_PAGE_SECTIONS_COLLECTION,
        [("market_id", 1), ("region_id", 1)],
        unique=True,
        name="government_page_sections_market_region_uq",
    )
    await _create_index_compat(
        db,
        ENTERTAINMENT_PAGE_SECTIONS_COLLECTION,
        [("market_id", 1), ("region_id", 1)],
        unique=True,
        name="entertainment_page_sections_market_region_uq",
    )

    # Badge query scans placement events by market scoped to a recency window.
    await _create_index_compat(db, PLACEMENT_EVENTS_COLLECTION, [("market_id", 1), ("placed_at", -1)])
    await _create_index_compat(
        db,
        PLACEMENT_EVENTS_COLLECTION,
        [("article_id", 1), ("slot_id", 1)],
        unique=True,
    )

    # One last-seen record per user per workflow view.
    await _create_index_compat(db, USER_VIEW_STATE_COLLECTION, [("user_id", 1), ("view", 1)], unique=True)
    logger.info("MongoDB indexes ensured")
