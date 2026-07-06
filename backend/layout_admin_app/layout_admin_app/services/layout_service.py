"""Layout service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from layout_admin_app.services.slot_service import publish_draft_pins_for_layout
from shared.core.audit import write_event
from shared.core.cache_invalidation import invalidate_homepage_for_layout, invalidate_homepage_for_market_ids
from shared.core.exceptions import ConflictError, NotFoundError, ValidationError
from shared.core.feature_flags import geo_dual_write_enabled
from shared.core.pagination import PaginationParams
from shared.core.regions import get_region_by_code
from shared.read.layout_reads import get_active_layout
from shared.read.market_reads import get_market_by_code
from shared.schemas.layout_schemas import LayoutCreate, LayoutOut, LayoutUpdate, PublishPlacementsOut

LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
MARKETS_COLLECTION = "markets"
REGIONS_COLLECTION = "regions"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_out(doc: dict[str, Any]) -> LayoutOut:
    return LayoutOut(
        id=str(doc["_id"]),
        page_name=doc["page_name"],
        market_id=str(doc["market_id"]) if doc.get("market_id") else None,
        region_id=str(doc["region_id"]) if doc.get("region_id") else None,
        scope_mode=str(doc.get("scope_mode") or "exact"),
        inherit_depth_limit=doc.get("inherit_depth_limit"),
        slot_ids=list(doc.get("slot_ids") or []),
        is_active=bool(doc.get("is_active", True)),
        updated_at=doc.get("updated_at", ""),
    )


async def _validate_market_id(db: AsyncIOMotorDatabase, market_id: str) -> str:
    normalized = market_id.strip()
    if not normalized:
        raise ValidationError("market_id is required")
    exists = await db[MARKETS_COLLECTION].find_one({"_id": normalized}, {"_id": 1})
    if exists is None:
        raise ValidationError(f"Unknown market_id: {normalized}")
    return normalized


async def _resolve_region_id_for_layout(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str | None,
    explicit_region_id: str | None,
) -> str | None:
    """Resolve a region owner id for layout dual-write."""

    if explicit_region_id:
        region = await db[REGIONS_COLLECTION].find_one(
            {"_id": explicit_region_id.strip(), "is_active": True},
            {"_id": 1},
        )
        if region is None:
            raise ValidationError(f"Unknown region_id: {explicit_region_id}")
        return str(region["_id"])

    if not market_id:
        return None
    market = await db[MARKETS_COLLECTION].find_one({"_id": market_id}, {"code": 1})
    if market is None:
        return None
    region = await get_region_by_code(db, str(market.get("code") or ""))
    if region is None:
        return None
    return str(region["_id"])


async def create(
    db: AsyncIOMotorDatabase,
    body: LayoutCreate,
    *,
    actor_id: str | None = None,
) -> LayoutOut:
    market_id = await _validate_market_id(db, body.market_id) if body.market_id else None
    region_id = await _resolve_region_id_for_layout(
        db,
        market_id=market_id,
        explicit_region_id=body.region_id,
    )
    existing = await db[LAYOUTS_COLLECTION].find_one(
        {
            "page_name": body.page_name,
            "$or": [
                {"market_id": market_id} if market_id else {"market_id": None},
                {"region_id": region_id} if region_id else {"region_id": None},
            ],
        },
        {"_id": 1},
    )
    if existing is not None:
        raise ConflictError("Layout for this page_name and market already exists")

    layout_id = str(uuid4())
    now = _utc_now_iso()
    doc = {
        "_id": layout_id,
        "page_name": body.page_name,
        "market_id": market_id,
        "region_id": region_id if geo_dual_write_enabled() else body.region_id,
        "scope_mode": body.scope_mode,
        "inherit_depth_limit": body.inherit_depth_limit,
        "slot_ids": [],
        "is_active": body.is_active,
        "updated_at": now,
    }
    await db[LAYOUTS_COLLECTION].insert_one(doc)
    if body.is_active:
        await invalidate_homepage_for_layout(db, layout_id)
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="layout.create",
            resource_type="layout",
            resource_id=layout_id,
        )
    return _to_out(doc)


async def list_all(
    db: AsyncIOMotorDatabase,
    pagination: PaginationParams,
) -> tuple[list[LayoutOut], int]:
    total = await db[LAYOUTS_COLLECTION].count_documents({})
    cursor = (
        db[LAYOUTS_COLLECTION]
        .find({})
        .sort("updated_at", -1)
        .skip(pagination.skip)
        .limit(pagination.page_size)
    )
    items: list[LayoutOut] = []
    async for doc in cursor:
        items.append(_to_out(doc))
    return items, total


async def get_by_id(db: AsyncIOMotorDatabase, layout_id: str) -> LayoutOut:
    doc = await db[LAYOUTS_COLLECTION].find_one({"_id": layout_id})
    if doc is None:
        raise NotFoundError("Layout not found")
    return _to_out(doc)


async def get_by_page_name(
    db: AsyncIOMotorDatabase,
    page_name: str,
    *,
    market_id: str | None = None,
    region_id: str | None = None,
) -> LayoutOut:
    if region_id:
        resolved = await get_active_layout(db, market_id=market_id, region_id=region_id, page_name=page_name)
        if resolved is not None:
            doc = await db[LAYOUTS_COLLECTION].find_one({"_id": resolved["layout_id"]})
            if doc is not None:
                return _to_out(doc)

    if not market_id:
        raise NotFoundError("Active layout not found for page")

    doc = await db[LAYOUTS_COLLECTION].find_one(
        {"page_name": page_name, "market_id": market_id, "is_active": True},
    )
    if doc is None:
        raise NotFoundError("Active layout not found for page")
    return _to_out(doc)


async def publish_placements(
    db: AsyncIOMotorDatabase,
    *,
    page_name: str,
    market_code: str,
    actor_id: str | None = None,
) -> PublishPlacementsOut:
    """Promote staged draft homepage placements to the live layout.

    Args:
        db: Database connection.
        page_name: Layout page name such as `homepage`.
        market_code: Market code such as `us`.
        actor_id: Optional auditing actor id.

    Returns:
        Publish summary for the active layout.

    Raises:
        NotFoundError: If the market or active layout does not exist.
    """

    normalized_page = page_name.strip().lower() or "homepage"
    market = await get_market_by_code(db, market_code)
    if market is None:
        raise NotFoundError("Market not found")

    market_id = str(market["_id"])
    layout = await get_active_layout(db, market_id=market_id, page_name=normalized_page)
    if layout is None:
        raise NotFoundError("Active layout not found for page")

    published_slot_count = await publish_draft_pins_for_layout(
        db,
        layout["layout_id"],
        actor_id=actor_id,
    )
    return PublishPlacementsOut(
        layout_id=layout["layout_id"],
        page_name=normalized_page,
        market_code=market_code,
        published_slot_count=published_slot_count,
    )


async def update(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    body: LayoutUpdate,
    actor_id: str | None = None,
) -> LayoutOut:
    existing = await db[LAYOUTS_COLLECTION].find_one({"_id": layout_id})
    if existing is None:
        raise NotFoundError("Layout not found")

    update_doc = {k: v for k, v in body.model_dump().items() if v is not None}
    if geo_dual_write_enabled() and ("market_id" in update_doc or "region_id" in update_doc):
        market_id = (
            await _validate_market_id(db, str(update_doc["market_id"]))
            if "market_id" in update_doc
            else str(existing.get("market_id") or "") or None
        )
        update_doc["market_id"] = market_id
        update_doc["region_id"] = await _resolve_region_id_for_layout(
            db,
            market_id=market_id,
            explicit_region_id=str(update_doc["region_id"]) if update_doc.get("region_id") else None,
        )
    update_doc["updated_at"] = _utc_now_iso()
    doc = await db[LAYOUTS_COLLECTION].find_one_and_update(
        {"_id": layout_id},
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise NotFoundError("Layout not found")

    activated = body.is_active is True and not existing.get("is_active", True)
    await invalidate_homepage_for_layout(db, layout_id)

    if actor_id:
        action = "layout.activate" if activated else "layout.update"
        await write_event(
            db,
            user_id=actor_id,
            action=action,
            resource_type="layout",
            resource_id=layout_id,
        )
    return _to_out(doc)


async def delete(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    actor_id: str | None = None,
) -> None:
    layout = await db[LAYOUTS_COLLECTION].find_one({"_id": layout_id}, {"market_id": 1})
    await db[SLOTS_COLLECTION].delete_many({"layout_id": layout_id})
    result = await db[LAYOUTS_COLLECTION].delete_one({"_id": layout_id})
    if result.deleted_count == 0:
        raise NotFoundError("Layout not found")

    if layout and layout.get("market_id"):
        await invalidate_homepage_for_market_ids(db, [str(layout["market_id"])])
    else:
        await invalidate_homepage_for_layout(db, layout_id)

    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="layout.delete",
            resource_type="layout",
            resource_id=layout_id,
        )
