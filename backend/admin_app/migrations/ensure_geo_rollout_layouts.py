"""Ensure rollout geo regions and homepage layouts exist.

Targets:
- us
- us-fl
- us-fl-miami-dade
- pr
- pr-san-juan

Also deactivates legacy market layouts for uk/ca/au when present.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

REGIONS_COLLECTION = "regions"
MARKETS_COLLECTION = "markets"
LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def _mongo_uri() -> str:
    value = os.getenv("MONGO_URI")
    if not value:
        raise RuntimeError("Missing MONGO_URI")
    return value


def _mongo_db_name() -> str:
    value = os.getenv("MONGO_DB_NAME")
    if not value:
        raise RuntimeError("Missing MONGO_DB_NAME")
    return value


async def _ensure_region(
    db: AsyncIOMotorDatabase,
    *,
    code: str,
    name: str,
    kind: str,
    parent_code: str | None,
    country_code: str | None,
    default_locale: str,
    labels: dict[str, str],
) -> str:
    existing = await db[REGIONS_COLLECTION].find_one({"code": code}, {"_id": 1})
    if existing is not None:
        return str(existing["_id"])

    parent: dict[str, Any] | None = None
    if parent_code:
        parent = await db[REGIONS_COLLECTION].find_one({"code": parent_code}, {"_id": 1, "ancestor_ids": 1, "path": 1})
        if parent is None:
            raise RuntimeError(f"Missing parent region {parent_code} while creating {code}")

    ancestor_ids = list(parent.get("ancestor_ids") or []) if parent else []
    if parent is not None:
        ancestor_ids.append(str(parent["_id"]))
    path = f"{str(parent['path']).strip('/')}/{code}" if parent else code
    now = _utc_now_iso()
    doc = {
        "_id": str(uuid4()),
        "code": code,
        "name": name,
        "kind": kind,
        "parent_id": str(parent["_id"]) if parent else None,
        "ancestor_ids": ancestor_ids,
        "depth": len(ancestor_ids),
        "path": path,
        "country_code": country_code,
        "is_active": True,
        "default_locale": default_locale,
        "labels": labels,
        "created_at": now,
        "updated_at": now,
    }
    await db[REGIONS_COLLECTION].insert_one(doc)
    return str(doc["_id"])


async def _clone_slots(db: AsyncIOMotorDatabase, *, source_layout_id: str, target_layout_id: str) -> list[str]:
    cursor = db[SLOTS_COLLECTION].find({"layout_id": source_layout_id})
    slots = [slot async for slot in cursor]
    slots.sort(key=lambda slot: int(slot.get("order_index") or 0))

    now = _utc_now_iso()
    slot_ids: list[str] = []
    for slot in slots:
        slot_id = str(uuid4())
        slot_ids.append(slot_id)
        await db[SLOTS_COLLECTION].insert_one(
            {
                "_id": slot_id,
                "layout_id": target_layout_id,
                "position_key": slot.get("position_key"),
                "content_type": slot.get("content_type"),
                "display_name": slot.get("display_name"),
                "presentation_type": slot.get("presentation_type") or "grid_4",
                "pinned_ids": list(slot.get("pinned_ids") or []),
                "draft_pinned_ids": (
                    list(slot.get("draft_pinned_ids"))
                    if slot.get("draft_pinned_ids") is not None
                    else None
                ),
                "query_rule": slot.get("query_rule"),
                "order_index": int(slot.get("order_index") or 0),
                "updated_at": now,
            }
        )

    return slot_ids


async def _find_source_layout(
    db: AsyncIOMotorDatabase,
    *,
    target_region_id: str,
    market_id: str,
) -> dict[str, Any] | None:
    region = await db[REGIONS_COLLECTION].find_one({"_id": target_region_id}, {"ancestor_ids": 1})
    if region is None:
        return None

    # Walk nearest ancestor first.
    for ancestor_id in reversed(list(region.get("ancestor_ids") or [])):
        layout = await db[LAYOUTS_COLLECTION].find_one(
            {
                "page_name": "homepage",
                "region_id": str(ancestor_id),
                "is_active": True,
            }
        )
        if layout is not None:
            return layout

    return await db[LAYOUTS_COLLECTION].find_one(
        {
            "page_name": "homepage",
            "market_id": market_id,
            "is_active": True,
        }
    )


async def _ensure_region_homepage_layout(db: AsyncIOMotorDatabase, *, region_code: str) -> str | None:
    region = await db[REGIONS_COLLECTION].find_one(
        {"code": region_code, "is_active": True},
        {"_id": 1, "country_code": 1},
    )
    if region is None:
        return None

    existing = await db[LAYOUTS_COLLECTION].find_one(
        {
            "page_name": "homepage",
            "region_id": str(region["_id"]),
            "is_active": True,
        },
        {"_id": 1},
    )
    if existing is not None:
        return str(existing["_id"])

    market_code = _norm(str(region.get("country_code") or ""))
    market = await db[MARKETS_COLLECTION].find_one({"code": market_code}, {"_id": 1})
    if market is None:
        return None

    source_layout = await _find_source_layout(
        db,
        target_region_id=str(region["_id"]),
        market_id=str(market["_id"]),
    )
    if source_layout is None:
        return None

    new_layout_id = str(uuid4())
    slot_ids = await _clone_slots(
        db,
        source_layout_id=str(source_layout["_id"]),
        target_layout_id=new_layout_id,
    )

    await db[LAYOUTS_COLLECTION].insert_one(
        {
            "_id": new_layout_id,
            "page_name": "homepage",
            "market_id": str(market["_id"]),
            "region_id": str(region["_id"]),
            "scope_mode": "inherit_from_ancestor",
            "inherit_depth_limit": None,
            "slot_ids": slot_ids,
            "is_active": True,
            "updated_at": _utc_now_iso(),
        }
    )
    return new_layout_id


async def _deactivate_legacy_market_layouts(db: AsyncIOMotorDatabase) -> int:
    legacy_codes = ("uk", "ca", "au")
    markets = db[MARKETS_COLLECTION].find({"code": {"$in": list(legacy_codes)}}, {"_id": 1})
    market_ids = [str(doc["_id"]) async for doc in markets]
    if not market_ids:
        return 0

    result = await db[LAYOUTS_COLLECTION].update_many(
        {"market_id": {"$in": market_ids}},
        {"$set": {"is_active": False, "updated_at": _utc_now_iso()}},
    )
    return int(result.modified_count)


async def run() -> dict[str, Any]:
    client = AsyncIOMotorClient(_mongo_uri())
    try:
        db = client[_mongo_db_name()]

        await _ensure_region(
            db,
            code="world",
            name="World",
            kind="world",
            parent_code=None,
            country_code=None,
            default_locale="en-US",
            labels={"en": "World", "es": "Mundo"},
        )
        await _ensure_region(
            db,
            code="us",
            name="United States",
            kind="country",
            parent_code="world",
            country_code="us",
            default_locale="en-US",
            labels={"en": "United States", "es": "Estados Unidos"},
        )
        await _ensure_region(
            db,
            code="pr",
            name="Puerto Rico",
            kind="country",
            parent_code="world",
            country_code="pr",
            default_locale="es-PR",
            labels={"en": "Puerto Rico", "es": "Puerto Rico"},
        )
        await _ensure_region(
            db,
            code="us-fl",
            name="Florida",
            kind="state",
            parent_code="us",
            country_code="us",
            default_locale="en-US",
            labels={"en": "Florida", "es": "Florida"},
        )
        await _ensure_region(
            db,
            code="us-fl-miami-dade",
            name="Miami-Dade County",
            kind="county",
            parent_code="us-fl",
            country_code="us",
            default_locale="en-US",
            labels={"en": "Miami-Dade County", "es": "Condado de Miami-Dade"},
        )
        await _ensure_region(
            db,
            code="pr-san-juan",
            name="San Juan",
            kind="municipality",
            parent_code="pr",
            country_code="pr",
            default_locale="es-PR",
            labels={"en": "San Juan", "es": "San Juan"},
        )

        created_layouts: dict[str, str | None] = {}
        for code in ("us", "us-fl", "us-fl-miami-dade", "pr", "pr-san-juan"):
            created_layouts[code] = await _ensure_region_homepage_layout(db, region_code=code)

        deactivated_legacy_layouts = await _deactivate_legacy_market_layouts(db)

        return {
            "status": "ok",
            "target_region_codes": ["us", "us-fl", "us-fl-miami-dade", "pr", "pr-san-juan"],
            "homepage_layout_ids": created_layouts,
            "deactivated_legacy_layouts": deactivated_legacy_layouts,
        }
    finally:
        client.close()


if __name__ == "__main__":
    print(asyncio.run(run()))
