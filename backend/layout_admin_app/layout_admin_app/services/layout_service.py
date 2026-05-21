"""Layout service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from shared.core.exceptions import ConflictError, NotFoundError
from shared.schemas.layout_schemas import LayoutCreate, LayoutOut, LayoutUpdate

LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_out(doc: dict[str, Any]) -> LayoutOut:
    return LayoutOut(
        id=str(doc["_id"]),
        page_name=doc["page_name"],
        slot_ids=list(doc.get("slot_ids") or []),
        is_active=bool(doc.get("is_active", True)),
        updated_at=doc.get("updated_at", ""),
    )


async def create(db: AsyncIOMotorDatabase, body: LayoutCreate) -> LayoutOut:
    existing = await db[LAYOUTS_COLLECTION].find_one({"page_name": body.page_name}, {"_id": 1})
    if existing is not None:
        raise ConflictError("Layout for this page_name already exists")

    layout_id = str(uuid4())
    now = _utc_now_iso()
    doc = {"_id": layout_id, "page_name": body.page_name, "slot_ids": [], "is_active": body.is_active, "updated_at": now}
    await db[LAYOUTS_COLLECTION].insert_one(doc)
    return _to_out(doc)


async def list_all(db: AsyncIOMotorDatabase) -> list[LayoutOut]:
    cursor = db[LAYOUTS_COLLECTION].find({}).sort("updated_at", -1)
    return [_to_out(doc) async for doc in cursor]


async def get_by_id(db: AsyncIOMotorDatabase, layout_id: str) -> LayoutOut:
    doc = await db[LAYOUTS_COLLECTION].find_one({"_id": layout_id})
    if doc is None:
        raise NotFoundError("Layout not found")
    return _to_out(doc)


async def get_by_page_name(db: AsyncIOMotorDatabase, page_name: str) -> LayoutOut:
    doc = await db[LAYOUTS_COLLECTION].find_one({"page_name": page_name, "is_active": True})
    if doc is None:
        raise NotFoundError("Active layout not found for page")
    return _to_out(doc)


async def update(db: AsyncIOMotorDatabase, *, layout_id: str, body: LayoutUpdate) -> LayoutOut:
    update_doc = {k: v for k, v in body.model_dump().items() if v is not None}
    update_doc["updated_at"] = _utc_now_iso()
    doc = await db[LAYOUTS_COLLECTION].find_one_and_update(
        {"_id": layout_id},
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise NotFoundError("Layout not found")
    return _to_out(doc)


async def delete(db: AsyncIOMotorDatabase, *, layout_id: str) -> None:
    await db[SLOTS_COLLECTION].delete_many({"layout_id": layout_id})
    result = await db[LAYOUTS_COLLECTION].delete_one({"_id": layout_id})
    if result.deleted_count == 0:
        raise NotFoundError("Layout not found")

