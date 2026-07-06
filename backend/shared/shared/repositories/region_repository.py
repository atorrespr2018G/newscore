"""Region repository helpers."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

REGIONS_COLLECTION = "regions"


class RegionRepository:
    """Minimal CRUD helpers for regions."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db
        self._regions = db[REGIONS_COLLECTION]

    async def by_id(self, region_id: str) -> dict[str, Any] | None:
        return await self._regions.find_one({"_id": region_id})

    async def by_code(self, code: str) -> dict[str, Any] | None:
        return await self._regions.find_one({"code": code.strip().lower()})

    async def children(self, parent_id: str | None) -> list[dict[str, Any]]:
        cursor = self._regions.find({"parent_id": parent_id}).sort("name", 1)
        return [doc async for doc in cursor]

    async def insert(self, doc: dict[str, Any]) -> None:
        await self._regions.insert_one(doc)

    async def update(self, region_id: str, update_doc: dict[str, Any]) -> dict[str, Any] | None:
        return await self._regions.find_one_and_update(
            {"_id": region_id},
            {"$set": update_doc},
            return_document=ReturnDocument.AFTER,
        )
