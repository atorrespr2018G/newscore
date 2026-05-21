"""Batch loaders for read resolvers."""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.read.collections import USERS_COLLECTION


class AuthorNameLoader:
    """Batch-load author display names by user id."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db
        self._cache: dict[str, str] = {}

    async def load(self, author_id: str) -> str:
        """Return author full name for a single id."""

        if author_id in self._cache:
            return self._cache[author_id]
        await self.load_many([author_id])
        return self._cache.get(author_id, "Unknown")

    async def load_many(self, author_ids: list[str]) -> dict[str, str]:
        """Batch-load names for multiple author ids."""

        missing = [aid for aid in author_ids if aid and aid not in self._cache]
        if not missing:
            return dict(self._cache)

        cursor = self._db[USERS_COLLECTION].find(
            {"_id": {"$in": missing}},
            {"full_name": 1},
        )
        async for user in cursor:
            self._cache[str(user["_id"])] = str(user.get("full_name") or "Unknown")

        for aid in missing:
            self._cache.setdefault(aid, "Unknown")

        return dict(self._cache)
