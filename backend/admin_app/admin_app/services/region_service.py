"""Region administration service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from shared.core.exceptions import ConflictError, NotFoundError, ValidationError
from shared.schemas.region_schemas import RegionCreate, RegionMove, RegionOut, RegionUpdate

REGIONS_COLLECTION = "regions"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def _to_out(doc: dict[str, Any]) -> RegionOut:
    return RegionOut(
        id=str(doc["_id"]),
        code=str(doc["code"]),
        name=str(doc["name"]),
        kind=str(doc["kind"]),
        parent_id=str(doc["parent_id"]) if doc.get("parent_id") else None,
        ancestor_ids=[str(value) for value in (doc.get("ancestor_ids") or [])],
        depth=int(doc.get("depth") or 0),
        path=str(doc.get("path") or ""),
        country_code=str(doc["country_code"]) if doc.get("country_code") else None,
        is_active=bool(doc.get("is_active", True)),
        default_locale=str(doc["default_locale"]) if doc.get("default_locale") else None,
        labels={str(k): str(v) for k, v in (doc.get("labels") or {}).items()},
        created_at=str(doc.get("created_at") or ""),
        updated_at=str(doc.get("updated_at") or ""),
    )


async def _get_region_or_404(db: AsyncIOMotorDatabase, region_id: str) -> dict[str, Any]:
    doc = await db[REGIONS_COLLECTION].find_one({"_id": region_id})
    if doc is None:
        raise NotFoundError("Region not found")
    return doc


async def list_regions(
    db: AsyncIOMotorDatabase,
    *,
    parent_id: str | None,
) -> list[RegionOut]:
    """List regions by parent id."""

    cursor = db[REGIONS_COLLECTION].find({"parent_id": parent_id}).sort("name", 1)
    return [_to_out(doc) async for doc in cursor]


async def get_region(db: AsyncIOMotorDatabase, region_id: str) -> RegionOut:
    """Get a region by id."""

    return _to_out(await _get_region_or_404(db, region_id))


async def create_region(db: AsyncIOMotorDatabase, body: RegionCreate) -> RegionOut:
    """Create a new region node."""

    code = _norm(body.code)
    if not code:
        raise ValidationError("code is required")
    if await db[REGIONS_COLLECTION].find_one({"code": code}, {"_id": 1}):
        raise ConflictError("Region code already exists")

    parent: dict[str, Any] | None = None
    if body.parent_id:
        parent = await _get_region_or_404(db, body.parent_id)
    elif body.kind != "world":
        raise ValidationError("parent_id is required unless kind is world")

    ancestor_ids = list(parent.get("ancestor_ids") or []) if parent else []
    if parent:
        ancestor_ids.append(str(parent["_id"]))
    depth = len(ancestor_ids)
    path = f"{str(parent['path']).strip('/')}/{code}" if parent else code

    if await db[REGIONS_COLLECTION].find_one({"path": path}, {"_id": 1}):
        raise ConflictError("Region path already exists")

    now = _utc_now_iso()
    doc = {
        "_id": str(uuid4()),
        "code": code,
        "name": body.name.strip(),
        "kind": body.kind,
        "parent_id": body.parent_id,
        "ancestor_ids": ancestor_ids,
        "depth": depth,
        "path": path,
        "country_code": _norm(body.country_code) or None,
        "is_active": body.is_active,
        "default_locale": body.default_locale,
        "labels": dict(body.labels or {}),
        "created_at": now,
        "updated_at": now,
    }
    await db[REGIONS_COLLECTION].insert_one(doc)
    return _to_out(doc)


async def update_region(db: AsyncIOMotorDatabase, region_id: str, body: RegionUpdate) -> RegionOut:
    """Update mutable fields for a region."""

    await _get_region_or_404(db, region_id)
    update_doc = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_doc:
        return await get_region(db, region_id)

    update_doc["updated_at"] = _utc_now_iso()
    doc = await db[REGIONS_COLLECTION].find_one_and_update(
        {"_id": region_id},
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise NotFoundError("Region not found")
    return _to_out(doc)


async def move_region(db: AsyncIOMotorDatabase, region_id: str, body: RegionMove) -> RegionOut:
    """Re-parent a region and recompute path/ancestor fields for subtree."""

    region = await _get_region_or_404(db, region_id)
    if region_id == body.new_parent_id:
        raise ValidationError("new_parent_id cannot equal region id")

    new_parent = await _get_region_or_404(db, body.new_parent_id)
    region_path = str(region.get("path") or "")
    parent_path = str(new_parent.get("path") or "")
    if parent_path and region_path and parent_path.startswith(f"{region_path}/"):
        raise ValidationError("Cannot move region under its own descendant")

    ancestor_ids = list(new_parent.get("ancestor_ids") or []) + [str(new_parent["_id"])]
    new_path = f"{str(new_parent['path']).strip('/')}/{region['code']}"
    now = _utc_now_iso()

    await db[REGIONS_COLLECTION].update_one(
        {"_id": region_id},
        {
            "$set": {
                "parent_id": str(new_parent["_id"]),
                "ancestor_ids": ancestor_ids,
                "depth": len(ancestor_ids),
                "path": new_path,
                "updated_at": now,
            }
        },
    )

    descendants = db[REGIONS_COLLECTION].find(
        {"path": {"$regex": f"^{region_path}/"}},
        {"_id": 1, "path": 1},
    )
    async for child in descendants:
        child_path = str(child.get("path") or "")
        suffix = child_path[len(region_path) :]
        recomputed_path = f"{new_path}{suffix}"

        cumulative_paths: list[str] = []
        for segment in recomputed_path.split("/")[:-1]:
            if not cumulative_paths:
                cumulative_paths.append(segment)
            else:
                cumulative_paths.append(f"{cumulative_paths[-1]}/{segment}")

        ancestor_cursor = db[REGIONS_COLLECTION].find(
            {"path": {"$in": cumulative_paths}},
            {"_id": 1, "path": 1},
        )
        ancestor_by_path = {str(doc["path"]): str(doc["_id"]) async for doc in ancestor_cursor}
        ancestor_ids_for_child = [
            ancestor_by_path[p]
            for p in cumulative_paths
            if p in ancestor_by_path
        ]

        await db[REGIONS_COLLECTION].update_one(
            {"_id": child["_id"]},
            {
                "$set": {
                    "path": recomputed_path,
                    "ancestor_ids": ancestor_ids_for_child,
                    "depth": len(ancestor_ids_for_child),
                    "updated_at": now,
                }
            },
        )

    return await get_region(db, region_id)
