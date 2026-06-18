"""MongoDB access for layout slots."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from shared.models.layout import Slot

LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"


class SlotRepository:
    """Thin repository for slot documents."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db
        self._slots = db[SLOTS_COLLECTION]
        self._layouts = db[LAYOUTS_COLLECTION]

    async def layout_exists(self, layout_id: str) -> bool:
        doc = await self._layouts.find_one({"_id": layout_id}, {"_id": 1})
        return doc is not None

    async def find_by_id(self, slot_id: str) -> dict[str, Any] | None:
        return await self._slots.find_one({"_id": slot_id})

    async def insert(self, doc: dict[str, Any]) -> None:
        await self._slots.insert_one(doc)

    async def attach_to_layout(self, *, layout_id: str, slot_id: str, updated_at: str) -> None:
        await self._layouts.update_one(
            {"_id": layout_id},
            {"$addToSet": {"slot_ids": slot_id}, "$set": {"updated_at": updated_at}},
        )

    async def list_for_layout(self, layout_id: str) -> list[dict[str, Any]]:
        cursor = self._slots.find({"layout_id": layout_id}).sort(
            [("order_index", 1), ("updated_at", -1)]
        )
        return [doc async for doc in cursor]

    async def find_one_and_update(
        self,
        slot_id: str,
        update_doc: dict[str, Any],
    ) -> dict[str, Any] | None:
        return await self._slots.find_one_and_update(
            {"_id": slot_id},
            {"$set": update_doc},
            return_document=ReturnDocument.AFTER,
        )

    async def promote_draft_pins(
        self,
        slot_id: str,
        *,
        pinned_ids: list[str],
        updated_at: str,
    ) -> dict[str, Any] | None:
        """Copy staged draft pins to live pins and clear the draft field."""

        return await self._slots.find_one_and_update(
            {"_id": slot_id},
            {
                "$set": {"pinned_ids": pinned_ids, "updated_at": updated_at},
                "$unset": {"draft_pinned_ids": ""},
            },
            return_document=ReturnDocument.AFTER,
        )

    async def touch_layout(self, layout_id: str, updated_at: str) -> None:
        await self._layouts.update_one({"_id": layout_id}, {"$set": {"updated_at": updated_at}})

    async def delete(self, slot_id: str) -> dict[str, Any] | None:
        return await self._slots.find_one_and_delete({"_id": slot_id})

    async def detach_from_layout(self, *, layout_id: str, slot_id: str, updated_at: str) -> None:
        await self._layouts.update_one(
            {"_id": layout_id},
            {"$pull": {"slot_ids": slot_id}, "$set": {"updated_at": updated_at}},
        )

    @staticmethod
    def to_model(doc: dict[str, Any]) -> Slot:
        return Slot.model_validate(doc)
