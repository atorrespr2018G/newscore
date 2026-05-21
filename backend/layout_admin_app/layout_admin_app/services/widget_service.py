"""Widget service.

Widgets are stored in a simple collection keyed by widget type.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

WIDGETS_COLLECTION = "widgets"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def set_widget(db: AsyncIOMotorDatabase, *, widget_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Upsert a widget by key."""

    doc = {"_id": widget_key, "payload": payload, "updated_at": _utc_now_iso()}
    await db[WIDGETS_COLLECTION].update_one({"_id": widget_key}, {"$set": doc}, upsert=True)
    return doc


async def get_widget(db: AsyncIOMotorDatabase, *, widget_key: str) -> dict[str, Any] | None:
    """Fetch a widget by key."""

    return await db[WIDGETS_COLLECTION].find_one({"_id": widget_key})

