"""Category service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from shared.core.exceptions import ConflictError, NotFoundError, ValidationError
from shared.schemas.category_schemas import CategoryCreate, CategoryOut, CategoryUpdate

CATEGORIES_COLLECTION = "categories"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_out(doc: dict[str, Any]) -> CategoryOut:
    return CategoryOut(
        id=str(doc["_id"]),
        name=doc["name"],
        slug=doc["slug"],
        parent_id=doc.get("parent_id"),
        description=doc.get("description"),
        created_at=doc.get("created_at", ""),
    )


async def create(db: AsyncIOMotorDatabase, body: CategoryCreate) -> CategoryOut:
    existing = await db[CATEGORIES_COLLECTION].find_one({"slug": body.slug}, {"_id": 1})
    if existing is not None:
        raise ConflictError("Category slug already exists")

    category_id = str(uuid4())
    doc = {
        "_id": category_id,
        "name": body.name,
        "slug": body.slug,
        "parent_id": body.parent_id,
        "description": body.description,
        "created_at": _utc_now_iso(),
    }
    await db[CATEGORIES_COLLECTION].insert_one(doc)
    return _to_out(doc)


async def list_all(db: AsyncIOMotorDatabase) -> list[CategoryOut]:
    cursor = db[CATEGORIES_COLLECTION].find({}).sort("created_at", -1)
    return [_to_out(doc) async for doc in cursor]


async def update(db: AsyncIOMotorDatabase, *, category_id: str, body: CategoryUpdate) -> CategoryOut:
    update_doc: dict[str, Any] = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_doc:
        raise ValidationError("No fields to update")

    if "slug" in update_doc:
        existing = await db[CATEGORIES_COLLECTION].find_one(
            {"slug": update_doc["slug"], "_id": {"$ne": category_id}},
            {"_id": 1},
        )
        if existing is not None:
            raise ConflictError("Category slug already exists")

    doc = await db[CATEGORIES_COLLECTION].find_one_and_update(
        {"_id": category_id},
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise NotFoundError("Category not found")
    return _to_out(doc)


async def delete(db: AsyncIOMotorDatabase, *, category_id: str) -> None:
    result = await db[CATEGORIES_COLLECTION].delete_one({"_id": category_id})
    if result.deleted_count == 0:
        raise NotFoundError("Category not found")

