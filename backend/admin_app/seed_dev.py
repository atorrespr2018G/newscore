"""Seed development data for NewsCore.

This script is designed to be idempotent and safe to re-run. It creates:

- An initial admin user (email/password from env or defaults)
- CNN-style categories (US, World, Politics, …)
- Published articles per category
- A homepage layout with hero + section slots (like cnn.com modules)
- A breaking-news widget payload

Run inside Docker:
    docker compose exec admin_app python seed_dev.py
"""

from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from redis.asyncio import Redis

from admin_app.helpers.password_helpers import hash_password

# Must match site_subgraph.constants.HOMEPAGE_FEED_CACHE_KEY
HOMEPAGE_FEED_CACHE_KEY = "graphql:homepageFeed"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

USERS_COLLECTION = "users"
CATEGORIES_COLLECTION = "categories"
ARTICLES_COLLECTION = "articles"
LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
WIDGETS_COLLECTION = "widgets"

# Categories aligned with masthead / CNN.com section nav.
CNN_CATEGORIES: list[dict[str, str]] = [
    {"name": "US", "slug": "us", "description": "United States news and politics."},
    {"name": "World", "slug": "world", "description": "Global headlines and analysis."},
    {"name": "Politics", "slug": "politics", "description": "Policy, elections, and government."},
    {"name": "Business", "slug": "business", "description": "Markets, companies, and the economy."},
    {"name": "Health", "slug": "health", "description": "Wellness, medicine, and public health."},
    {"name": "Entertainment", "slug": "entertainment", "description": "Culture, TV, film, and celebrity."},
    {"name": "Style", "slug": "style", "description": "Fashion, design, and living."},
    {"name": "Travel", "slug": "travel", "description": "Destinations, tips, and aviation."},
    {"name": "Sports", "slug": "sports", "description": "Scores, leagues, and athletes."},
]

# Demo headlines per category slug.
CNN_ARTICLE_TITLES: dict[str, list[str]] = {
    "us": [
        "Congress faces deadline on budget standoff",
        "Major cities roll out new transit safety plans",
        "Supreme Court to hear landmark digital privacy case",
    ],
    "world": [
        "Markets rally as inflation cools",
        "New satellite images reveal rapid glacier retreat",
        "Storm system causes major travel disruptions",
    ],
    "politics": [
        "Election season begins with tight early polling",
        "White House outlines new foreign policy framework",
        "Campaign finance filings show record fundraising",
    ],
    "business": [
        "Tech leaders announce open safety framework",
        "Central bank signals cautious rate path ahead",
        "Retail giants report mixed quarterly earnings",
    ],
    "health": [
        "Study links screen time to sleep disruption in teens",
        "FDA panel reviews next-generation vaccine candidates",
        "Hospitals expand mental health access programs",
    ],
    "entertainment": [
        "Streaming platform greenlights high-profile drama series",
        "Award show ratings rebound with live format",
        "Studio merger reshapes summer release calendar",
    ],
    "style": [
        "Design week spotlights sustainable materials",
        "Luxury brands lean into quiet luxury trend",
        "Home editors share small-space makeover ideas",
    ],
    "travel": [
        "Airlines add routes as international demand surges",
        "National parks set new visitor capacity rules",
        "Cruise industry unveils carbon-reduction targets",
    ],
    "sports": [
        "Championship race goes to final lap thriller",
        "Star player signs record-breaking extension",
        "Olympic committee confirms venue shortlist",
    ],
}

# Homepage slots: hero (pinned) + CNN-style section modules below.
HOMEPAGE_SLOT_SPECS: list[dict[str, Any]] = [
    {"position_key": "hero", "order_index": 0, "pinned": True, "limit": 6},
    {"position_key": "more-top-stories", "order_index": 1, "limit": 7},
    {"position_key": "midterm-elections", "order_index": 2, "category_slug": "politics", "limit": 4},
    {"position_key": "editorial-rail", "order_index": 3, "limit": 4},
    {"position_key": "politics", "order_index": 4, "category_slug": "politics", "limit": 4},
    {"position_key": "world", "order_index": 5, "category_slug": "world", "limit": 4},
    {"position_key": "us", "order_index": 6, "category_slug": "us", "limit": 4},
    {"position_key": "business", "order_index": 7, "category_slug": "business", "limit": 4},
    {"position_key": "health", "order_index": 8, "category_slug": "health", "limit": 4},
    {"position_key": "entertainment", "order_index": 9, "category_slug": "entertainment", "limit": 4},
    {"position_key": "style", "order_index": 10, "category_slug": "style", "limit": 4},
    {"position_key": "travel", "order_index": 11, "category_slug": "travel", "limit": 4},
    {"position_key": "sports", "order_index": 12, "category_slug": "sports", "limit": 4},
]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mongo_uri() -> str:
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        raise RuntimeError("Missing MONGO_URI")
    return mongo_uri


def _mongo_db_name() -> str:
    name = os.getenv("MONGO_DB_NAME")
    if not name:
        raise RuntimeError("Missing MONGO_DB_NAME")
    return name


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db[USERS_COLLECTION].create_index("email", unique=True)
    await db[CATEGORIES_COLLECTION].create_index("slug", unique=True)
    await db[ARTICLES_COLLECTION].create_index("slug", unique=True)
    await db[ARTICLES_COLLECTION].create_index([("status", 1), ("published_at", -1)])
    await db[ARTICLES_COLLECTION].create_index([("title", "text"), ("body", "text")])


async def _get_or_create_admin(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    email = os.getenv("SEED_ADMIN_EMAIL", "admin@newscore.local")
    password = os.getenv("SEED_ADMIN_PASSWORD", "admin123!")
    full_name = os.getenv("SEED_ADMIN_FULL_NAME", "NewsCore Admin")

    existing = await db[USERS_COLLECTION].find_one({"email": email})
    if existing is not None:
        logger.info("Admin user already exists: %s", email)
        return existing

    user_id = str(uuid4())
    doc = {
        "_id": user_id,
        "email": email,
        "password_hash": hash_password(password),
        "role": "admin",
        "full_name": full_name,
        "avatar_url": None,
        "bio": None,
        "is_active": True,
        "created_at": _utc_now_iso(),
    }
    await db[USERS_COLLECTION].insert_one(doc)
    logger.info("Created admin user: %s (password from SEED_ADMIN_PASSWORD)", email)
    return doc


async def _ensure_categories(db: AsyncIOMotorDatabase) -> dict[str, str]:
    """Ensure CNN-style categories exist; return slug -> category_id map."""

    slug_to_id: dict[str, str] = {}
    for cat in CNN_CATEGORIES:
        existing = await db[CATEGORIES_COLLECTION].find_one({"slug": cat["slug"]})
        if existing is not None:
            slug_to_id[cat["slug"]] = str(existing["_id"])
            continue

        category_id = str(uuid4())
        doc = {
            "_id": category_id,
            "name": cat["name"],
            "slug": cat["slug"],
            "parent_id": None,
            "description": cat["description"],
            "created_at": _utc_now_iso(),
        }
        await db[CATEGORIES_COLLECTION].insert_one(doc)
        slug_to_id[cat["slug"]] = category_id
        logger.info("Created category: %s", cat["slug"])

    return slug_to_id


async def _ensure_category_articles(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    category_slug: str,
    category_id: str,
) -> list[str]:
    """Create demo articles for one category; return article ids."""

    titles = CNN_ARTICLE_TITLES.get(category_slug, [])
    article_ids: list[str] = []

    for title in titles:
        existing = await db[ARTICLES_COLLECTION].find_one({"title": title})
        if existing is not None:
            article_ids.append(str(existing["_id"]))
            continue

        article_id = str(uuid4())
        now = _utc_now_iso()
        slug = f"{category_slug}-{article_id[:8]}"
        doc = {
            "_id": article_id,
            "title": title,
            "slug": slug,
            "body": f"{title}\n\nSeeded demo content for the {category_slug} section.",
            "status": "published",
            "author_id": author_id,
            "category_id": category_id,
            "tags": ["seed", "demo", category_slug],
            "thumbnail_url": None,
            "media_ids": [],
            "view_count": 0,
            "published_at": now,
            "created_at": now,
            "updated_at": now,
        }
        await db[ARTICLES_COLLECTION].insert_one(doc)
        article_ids.append(article_id)

    return article_ids


async def _ensure_all_articles(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    slug_to_category_id: dict[str, str],
) -> list[str]:
    """Seed articles for every category; return all article ids."""

    all_ids: list[str] = []
    for slug, category_id in slug_to_category_id.items():
        ids = await _ensure_category_articles(
            db,
            author_id=author_id,
            category_slug=slug,
            category_id=category_id,
        )
        all_ids.extend(ids)

    logger.info("Ensured %d published articles across %d categories", len(all_ids), len(slug_to_category_id))
    return all_ids


async def _upsert_slot(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    spec: dict[str, Any],
    pinned_article_ids: list[str],
    now: str,
) -> str:
    """Create or update one homepage slot from a spec dict."""

    position_key = str(spec["position_key"])
    slot = await db[SLOTS_COLLECTION].find_one({"layout_id": layout_id, "position_key": position_key})

    query_rule: dict[str, Any] | None = None
    pinned_ids: list[str] = []

    if spec.get("pinned"):
        pinned_ids = pinned_article_ids[: int(spec.get("limit") or 6)]
    elif spec.get("category_slug"):
        query_rule = {
            "category_id": spec["category_id"],
            "limit": int(spec.get("limit") or 4),
        }
    else:
        query_rule = {"limit": int(spec.get("limit") or 4)}

    if slot is None:
        slot_id = str(uuid4())
        doc = {
            "_id": slot_id,
            "layout_id": layout_id,
            "position_key": position_key,
            "content_type": "articles",
            "pinned_ids": pinned_ids,
            "query_rule": query_rule,
            "order_index": int(spec["order_index"]),
            "updated_at": now,
        }
        await db[SLOTS_COLLECTION].insert_one(doc)
        await db[LAYOUTS_COLLECTION].update_one(
            {"_id": layout_id},
            {"$addToSet": {"slot_ids": slot_id}, "$set": {"is_active": True, "updated_at": now}},
        )
        logger.info("Created homepage slot: %s", position_key)
        return slot_id

    await db[SLOTS_COLLECTION].update_one(
        {"_id": slot["_id"]},
        {
            "$set": {
                "pinned_ids": pinned_ids,
                "query_rule": query_rule,
                "order_index": int(spec["order_index"]),
                "updated_at": now,
            }
        },
    )
    logger.info("Updated homepage slot: %s", position_key)
    return str(slot["_id"])


async def _ensure_homepage_layout_and_slots(
    db: AsyncIOMotorDatabase,
    *,
    slug_to_category_id: dict[str, str],
    pinned_article_ids: list[str],
) -> None:
    """Ensure homepage layout with hero + CNN-style section slots."""

    layout = await db[LAYOUTS_COLLECTION].find_one({"page_name": "homepage"})
    now = _utc_now_iso()

    if layout is None:
        layout_id = str(uuid4())
        layout = {"_id": layout_id, "page_name": "homepage", "slot_ids": [], "is_active": True, "updated_at": now}
        await db[LAYOUTS_COLLECTION].insert_one(layout)
        logger.info("Created homepage layout")

    layout_id = str(layout["_id"])
    slot_ids: list[str] = []

    for spec in HOMEPAGE_SLOT_SPECS:
        entry = dict(spec)
        category_slug = entry.pop("category_slug", None)
        if category_slug:
            entry["category_id"] = slug_to_category_id[category_slug]
        slot_id = await _upsert_slot(
            db,
            layout_id=layout_id,
            spec=entry,
            pinned_article_ids=pinned_article_ids,
            now=now,
        )
        slot_ids.append(slot_id)

    await db[LAYOUTS_COLLECTION].update_one(
        {"_id": layout_id},
        {"$set": {"slot_ids": slot_ids, "is_active": True, "updated_at": now}},
    )
    logger.info("Homepage layout has %d slots", len(slot_ids))


async def _invalidate_homepage_feed_cache() -> None:
    """Drop cached homepage feed so GraphQL serves freshly seeded data."""

    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        logger.warning("REDIS_URL not set; skipping homepage feed cache clear")
        return

    client = Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
    try:
        deleted = await client.delete(HOMEPAGE_FEED_CACHE_KEY)
        if deleted:
            logger.info("Cleared stale GraphQL homepage feed cache")
    finally:
        await client.aclose()


async def _ensure_breaking_widget(db: AsyncIOMotorDatabase) -> None:
    payload = {
        "items": [
            {"text": "Seeded: Breaking — major story developing", "severity": "high"},
            {"text": "Seeded: Update — details coming in", "severity": "medium"},
            {"text": "Seeded: Politics — key vote expected tonight", "severity": "medium"},
        ]
    }
    doc = {"_id": "breaking", "payload": payload, "updated_at": _utc_now_iso()}
    await db[WIDGETS_COLLECTION].update_one({"_id": "breaking"}, {"$set": doc}, upsert=True)
    logger.info("Upserted breaking widget")


async def seed_dev() -> None:
    """Seed the database with initial development content."""

    client = AsyncIOMotorClient(_mongo_uri())
    try:
        db = client[_mongo_db_name()]
        await _ensure_indexes(db)

        admin = await _get_or_create_admin(db)
        slug_to_id = await _ensure_categories(db)
        all_article_ids = await _ensure_all_articles(
            db,
            author_id=str(admin["_id"]),
            slug_to_category_id=slug_to_id,
        )

        await _ensure_homepage_layout_and_slots(
            db,
            slug_to_category_id=slug_to_id,
            pinned_article_ids=all_article_ids,
        )
        await _ensure_breaking_widget(db)

        await _invalidate_homepage_feed_cache()
    finally:
        client.close()


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_dev())
