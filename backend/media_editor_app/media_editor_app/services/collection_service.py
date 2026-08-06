"""Reporter-owned ordered media collection persistence."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from media_editor_app.schemas import MediaCollectionCreate, MediaCollectionOut, MediaCollectionUpdate

COLLECTIONS = "media_collections"
ASSETS = "media_assets"


def _now() -> str:
    """Return the current UTC timestamp in ISO format."""

    return datetime.now(timezone.utc).isoformat()


def _serialize(doc: dict[str, Any]) -> MediaCollectionOut:
    """Serialize a Mongo collection document into its API form."""

    return MediaCollectionOut(id=doc["_id"], **{key: value for key, value in doc.items() if key != "_id"})


async def create_collection(
    db: AsyncIOMotorDatabase, *, owner_id: str, payload: MediaCollectionCreate
) -> MediaCollectionOut:
    """Create an ordered collection after validating all asset ownership."""

    await _validate_assets(db, owner_id=owner_id, asset_ids=payload.asset_ids)
    timestamp = _now()
    document = {
        "_id": str(uuid4()), "owner_id": owner_id, "title": payload.title,
        "description": payload.description, "asset_ids": payload.asset_ids, "status": "draft",
        "created_at": timestamp, "updated_at": timestamp,
    }
    await db[COLLECTIONS].insert_one(document)
    return _serialize(document)


async def list_collections(db: AsyncIOMotorDatabase, *, owner_id: str) -> list[MediaCollectionOut]:
    """List reporter-owned collections ordered by their latest edit."""

    documents = await db[COLLECTIONS].find({"owner_id": owner_id}).sort("updated_at", -1).to_list(100)
    return [_serialize(document) for document in documents]


async def update_collection(
    db: AsyncIOMotorDatabase, *, collection_id: str, owner_id: str, payload: MediaCollectionUpdate
) -> MediaCollectionOut:
    """Replace collection metadata, order, and readiness state."""

    await _validate_assets(db, owner_id=owner_id, asset_ids=payload.asset_ids)
    changes = payload.model_dump()
    changes["updated_at"] = _now()
    document = await db[COLLECTIONS].find_one_and_update(
        {"_id": collection_id, "owner_id": owner_id}, {"$set": changes}, return_document=True,
    )
    if document is None:
        raise LookupError("Media collection not found")
    return _serialize(document)


async def get_ready_collection(
    db: AsyncIOMotorDatabase, *, collection_id: str, owner_id: str
) -> MediaCollectionOut:
    """Return a ready collection suitable for later editor handoff."""

    document = await db[COLLECTIONS].find_one(
        {"_id": collection_id, "owner_id": owner_id, "status": "ready"},
    )
    if document is None:
        raise LookupError("Ready media collection not found")
    return _serialize(document)


async def _validate_assets(db: AsyncIOMotorDatabase, *, owner_id: str, asset_ids: list[str]) -> None:
    """Verify assets are unique and owned by the collection owner."""

    if len(asset_ids) != len(set(asset_ids)):
        raise ValueError("Collection asset IDs must be unique")
    count = await db[ASSETS].count_documents({"_id": {"$in": asset_ids}, "uploader_id": owner_id})
    if count != len(asset_ids):
        raise ValueError("Each collection asset must belong to its owner")
