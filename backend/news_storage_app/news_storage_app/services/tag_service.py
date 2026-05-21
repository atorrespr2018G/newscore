"""Tag service.

Tags are stored implicitly as strings on article documents. This service returns
distinct tags for convenience.
"""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

ARTICLES_COLLECTION = "articles"


async def list_tags(db: AsyncIOMotorDatabase) -> list[str]:
    """Return distinct tags used across all articles."""

    tags = await db[ARTICLES_COLLECTION].distinct("tags")
    return sorted([t for t in tags if isinstance(t, str) and t.strip()])

