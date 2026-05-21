"""Slot service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from shared.core.exceptions import NotFoundError, ValidationError
from shared.schemas.layout_schemas import SlotCreate, SlotOut, SlotUpdate

LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_out(doc: dict[str, Any]) -> SlotOut:
    return SlotOut(
        id=str(doc["_id"]),
        layout_id=str(doc["layout_id"]),
        position_key=doc["position_key"],
        content_type=doc["content_type"],
        pinned_ids=list(doc.get("pinned_ids") or []),
        query_rule=doc.get("query_rule"),
        order_index=int(doc.get("order_index") or 0),
        updated_at=doc.get("updated_at", ""),
    )


async def create(db: AsyncIOMotorDatabase, body: SlotCreate) -> SlotOut:
    layout = await db[LAYOUTS_COLLECTION].find_one({"_id": body.layout_id})
    if layout is None:
        raise NotFoundError("Layout not found")

    slot_id = str(uuid4())
    now = _utc_now_iso()
    doc: dict[str, Any] = {
        "_id": slot_id,
        "layout_id": body.layout_id,
        "position_key": body.position_key,
        "content_type": body.content_type,
        "pinned_ids": [],
        "query_rule": None,
        "order_index": body.order_index,
        "updated_at": now,
    }
    await db[SLOTS_COLLECTION].insert_one(doc)
    await db[LAYOUTS_COLLECTION].update_one(
        {"_id": body.layout_id},
        {"$addToSet": {"slot_ids": slot_id}, "$set": {"updated_at": now}},
    )
    return _to_out(doc)


async def list_for_layout(db: AsyncIOMotorDatabase, layout_id: str) -> list[SlotOut]:
    cursor = db[SLOTS_COLLECTION].find({"layout_id": layout_id}).sort([("order_index", 1), ("updated_at", -1)])
    return [_to_out(doc) async for doc in cursor]


async def update(db: AsyncIOMotorDatabase, *, slot_id: str, body: SlotUpdate) -> SlotOut:
    update_doc = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_doc:
        raise ValidationError("No fields to update")
    update_doc["updated_at"] = _utc_now_iso()

    doc = await db[SLOTS_COLLECTION].find_one_and_update(
        {"_id": slot_id},
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise NotFoundError("Slot not found")
    await db[LAYOUTS_COLLECTION].update_one(
        {"_id": doc["layout_id"]},
        {"$set": {"updated_at": update_doc["updated_at"]}},
    )
    return _to_out(doc)


async def delete(db: AsyncIOMotorDatabase, *, slot_id: str) -> None:
    slot = await db[SLOTS_COLLECTION].find_one({"_id": slot_id})
    if slot is None:
        raise NotFoundError("Slot not found")

    await db[SLOTS_COLLECTION].delete_one({"_id": slot_id})
    await db[LAYOUTS_COLLECTION].update_one(
        {"_id": slot["layout_id"]},
        {"$pull": {"slot_ids": slot_id}, "$set": {"updated_at": _utc_now_iso()}},
    )

