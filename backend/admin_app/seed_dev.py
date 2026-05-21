"""Seed development data for NewsCore.

This script is designed to be idempotent and safe to re-run. It creates:

- An initial admin user (email/password from env or defaults)
- One category
- A handful of published articles
- A homepage layout + a pinned slot pointing at the published articles
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


async def _get_or_create_category(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    slug = "world"
    existing = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    if existing is not None:
        return existing

    category_id = str(uuid4())
    doc = {
        "_id": category_id,
        "name": "World",
        "slug": slug,
        "parent_id": None,
        "description": "Global headlines and analysis.",
        "created_at": _utc_now_iso(),
    }
    await db[CATEGORIES_COLLECTION].insert_one(doc)
    logger.info("Created category: %s", slug)
    return doc


async def _ensure_published_articles(
    db: AsyncIOMotorDatabase, *, author_id: str, category_id: str
) -> list[str]:
    titles = [
        "Markets rally as inflation cools",
        "New satellite images reveal rapid glacier retreat",
        "Election season begins with tight early polling",
        "Tech leaders announce open safety framework",
        "Storm system causes major travel disruptions",
    ]

    published_ids: list[str] = []
    for t in titles:
        existing = await db[ARTICLES_COLLECTION].find_one({"title": t})
        if existing is not None:
            published_ids.append(str(existing["_id"]))
            continue

        article_id = str(uuid4())
        now = _utc_now_iso()
        slug = f"seed-{article_id[:8]}"
        doc = {
            "_id": article_id,
            "title": t,
            "slug": slug,
            "body": f"{t}\n\nThis is seeded demo content. Replace it with real reporting.",
            "status": "published",
            "author_id": author_id,
            "category_id": category_id,
            "tags": ["seed", "demo"],
            "thumbnail_url": None,
            "media_ids": [],
            "view_count": 0,
            "published_at": now,
            "created_at": now,
            "updated_at": now,
        }
        await db[ARTICLES_COLLECTION].insert_one(doc)
        published_ids.append(article_id)

    logger.info("Ensured %d published articles", len(published_ids))
    return published_ids


async def _ensure_homepage_layout_and_slot(db: AsyncIOMotorDatabase, *, pinned_article_ids: list[str]) -> None:
    layout = await db[LAYOUTS_COLLECTION].find_one({"page_name": "homepage"})
    now = _utc_now_iso()

    if layout is None:
        layout_id = str(uuid4())
        layout = {"_id": layout_id, "page_name": "homepage", "slot_ids": [], "is_active": True, "updated_at": now}
        await db[LAYOUTS_COLLECTION].insert_one(layout)
        logger.info("Created homepage layout")

    # Find or create a hero slot
    slot = await db[SLOTS_COLLECTION].find_one({"layout_id": str(layout["_id"]), "position_key": "hero"})
    if slot is None:
        slot_id = str(uuid4())
        slot = {
            "_id": slot_id,
            "layout_id": str(layout["_id"]),
            "position_key": "hero",
            "content_type": "articles",
            "pinned_ids": pinned_article_ids[:6],
            "query_rule": None,
            "order_index": 0,
            "updated_at": now,
        }
        await db[SLOTS_COLLECTION].insert_one(slot)
        await db[LAYOUTS_COLLECTION].update_one(
            {"_id": layout["_id"]},
            {"$addToSet": {"slot_ids": slot_id}, "$set": {"is_active": True, "updated_at": now}},
        )
        logger.info("Created homepage hero slot with pinned articles")
        return

    # Update existing slot to pin the current seeded articles
    await db[SLOTS_COLLECTION].update_one(
        {"_id": slot["_id"]},
        {"$set": {"pinned_ids": pinned_article_ids[:6], "updated_at": now}},
    )
    await db[LAYOUTS_COLLECTION].update_one({"_id": layout["_id"]}, {"$set": {"is_active": True, "updated_at": now}})
    logger.info("Updated homepage hero slot pinned articles")


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
        category = await _get_or_create_category(db)
        pinned_ids = await _ensure_published_articles(db, author_id=str(admin["_id"]), category_id=str(category["_id"]))

        await _ensure_homepage_layout_and_slot(db, pinned_article_ids=pinned_ids)
        await _ensure_breaking_widget(db)

        await _invalidate_homepage_feed_cache()
    finally:
        client.close()


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_dev())

