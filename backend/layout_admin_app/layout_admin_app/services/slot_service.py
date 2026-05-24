"""Slot service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.audit import write_event
from shared.core.cache_invalidation import invalidate_homepage_for_layout
from shared.core.exceptions import NotFoundError, ValidationError
from shared.repositories.slot_repository import SlotRepository
from shared.schemas.layout_schemas import SlotCreate, SlotOut, SlotUpdate


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


async def create(
    db: AsyncIOMotorDatabase,
    body: SlotCreate,
    *,
    actor_id: str | None = None,
) -> SlotOut:
    repo = SlotRepository(db)
    if not await repo.layout_exists(body.layout_id):
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
    await repo.insert(doc)
    await repo.attach_to_layout(layout_id=body.layout_id, slot_id=slot_id, updated_at=now)
    await invalidate_homepage_for_layout(db, body.layout_id)
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="slot.create",
            resource_type="slot",
            resource_id=slot_id,
        )
    return _to_out(doc)


async def list_for_layout(db: AsyncIOMotorDatabase, layout_id: str) -> list[SlotOut]:
    repo = SlotRepository(db)
    docs = await repo.list_for_layout(layout_id)
    return [_to_out(doc) for doc in docs]


async def update(
    db: AsyncIOMotorDatabase,
    *,
    slot_id: str,
    body: SlotUpdate,
    actor_id: str | None = None,
) -> SlotOut:
    repo = SlotRepository(db)
    update_doc = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_doc:
        raise ValidationError("No fields to update")
    update_doc["updated_at"] = _utc_now_iso()

    doc = await repo.find_one_and_update(slot_id, update_doc)
    if doc is None:
        raise NotFoundError("Slot not found")
    await repo.touch_layout(str(doc["layout_id"]), update_doc["updated_at"])
    await invalidate_homepage_for_layout(db, str(doc["layout_id"]))
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="slot.update",
            resource_type="slot",
            resource_id=slot_id,
        )
    return _to_out(doc)


async def delete(
    db: AsyncIOMotorDatabase,
    *,
    slot_id: str,
    actor_id: str | None = None,
) -> None:
    repo = SlotRepository(db)
    slot = await repo.find_by_id(slot_id)
    if slot is None:
        raise NotFoundError("Slot not found")

    layout_id = str(slot["layout_id"])
    now = _utc_now_iso()
    await repo.delete(slot_id)
    await repo.detach_from_layout(layout_id=layout_id, slot_id=slot_id, updated_at=now)
    await invalidate_homepage_for_layout(db, layout_id)
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="slot.delete",
            resource_type="slot",
            resource_id=slot_id,
        )
