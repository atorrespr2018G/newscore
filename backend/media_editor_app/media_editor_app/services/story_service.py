"""Reporter story packages: originals pool plus ordered report selection."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from media_editor_app.schemas import MediaStoryCreate, MediaStoryOut, MediaStoryUpdate

STORIES = "media_stories"
ASSETS = "media_assets"
_MAX_VERSION_DEPTH = 20


def _now() -> str:
    """Return the current UTC timestamp in ISO format."""

    return datetime.now(timezone.utc).isoformat()


def _serialize(doc: dict[str, Any]) -> MediaStoryOut:
    """Serialize a Mongo story document into its API form."""

    return MediaStoryOut(id=doc["_id"], **{key: value for key, value in doc.items() if key != "_id"})


async def create_story(
    db: AsyncIOMotorDatabase, *, owner_id: str, payload: MediaStoryCreate
) -> MediaStoryOut:
    """Create an empty story package for a reporter."""

    timestamp = _now()
    document = {
        "_id": str(uuid4()),
        "owner_id": owner_id,
        "title": payload.title,
        "description": payload.description,
        "pool_asset_ids": [],
        "selected_asset_ids": [],
        "status": "draft",
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    await db[STORIES].insert_one(document)
    return _serialize(document)


async def list_stories(db: AsyncIOMotorDatabase, *, owner_id: str) -> list[MediaStoryOut]:
    """List reporter-owned story packages ordered by latest edit."""

    documents = await db[STORIES].find({"owner_id": owner_id}).sort("updated_at", -1).to_list(100)
    return [_serialize(document) for document in documents]


async def get_story(db: AsyncIOMotorDatabase, *, story_id: str, owner_id: str) -> MediaStoryOut:
    """Load one owned story package."""

    document = await db[STORIES].find_one({"_id": story_id, "owner_id": owner_id})
    if document is None:
        raise LookupError("Media story not found")
    return _serialize(document)


async def update_story(
    db: AsyncIOMotorDatabase, *, story_id: str, owner_id: str, payload: MediaStoryUpdate
) -> MediaStoryOut:
    """Replace story metadata, pool membership, report order, and readiness."""

    await _validate_story_assets(db, owner_id=owner_id, payload=payload)
    changes = payload.model_dump()
    changes["updated_at"] = _now()
    document = await db[STORIES].find_one_and_update(
        {"_id": story_id, "owner_id": owner_id},
        {"$set": changes},
        return_document=True,
    )
    if document is None:
        raise LookupError("Media story not found")
    return _serialize(document)


async def add_asset_to_pool(
    db: AsyncIOMotorDatabase, *, story_id: str, owner_id: str, asset_id: str
) -> MediaStoryOut:
    """Append an owned original upload to a story originals pool."""

    document = await db[ASSETS].find_one({"_id": asset_id, "uploader_id": owner_id})
    if document is None:
        raise LookupError("Media asset not found")
    if document.get("version_of"):
        raise ValueError("Only original uploads can join the story originals pool")
    story = await db[STORIES].find_one_and_update(
        {"_id": story_id, "owner_id": owner_id},
        {
            "$addToSet": {"pool_asset_ids": asset_id},
            "$set": {"updated_at": _now()},
        },
        return_document=True,
    )
    if story is None:
        raise LookupError("Media story not found")
    return _serialize(story)


async def get_ready_story(
    db: AsyncIOMotorDatabase, *, story_id: str, owner_id: str
) -> MediaStoryOut:
    """Return a ready story suitable for later editor handoff."""

    document = await db[STORIES].find_one(
        {"_id": story_id, "owner_id": owner_id, "status": "ready"},
    )
    if document is None:
        raise LookupError("Ready media story not found")
    return _serialize(document)


async def _resolve_root_id(
    db: AsyncIOMotorDatabase, *, asset_id: str, owner_id: str
) -> str:
    """Walk version_of links until the original upload is found."""

    current_id = asset_id
    seen: set[str] = set()
    for _ in range(_MAX_VERSION_DEPTH):
        if current_id in seen:
            raise ValueError("Invalid media version lineage")
        seen.add(current_id)
        document = await db[ASSETS].find_one({"_id": current_id, "uploader_id": owner_id})
        if document is None:
            raise ValueError("Each story asset must belong to its owner")
        parent_id = document.get("version_of")
        if not parent_id:
            return document["_id"]
        current_id = str(parent_id)
    raise ValueError("Invalid media version lineage")


async def _validate_story_assets(
    db: AsyncIOMotorDatabase, *, owner_id: str, payload: MediaStoryUpdate
) -> None:
    """Validate pool originals and that report picks belong to those originals."""

    related_ids = list({*payload.pool_asset_ids, *payload.selected_asset_ids})
    if not related_ids:
        return
    documents = await db[ASSETS].find(
        {"_id": {"$in": related_ids}, "uploader_id": owner_id},
    ).to_list(len(related_ids))
    by_id = {document["_id"]: document for document in documents}
    if len(by_id) != len(related_ids):
        raise ValueError("Each story asset must belong to its owner")
    for asset_id in payload.pool_asset_ids:
        if by_id[asset_id].get("version_of"):
            raise ValueError("Story pool may only contain original uploads")
    pool = set(payload.pool_asset_ids)
    for asset_id in payload.selected_asset_ids:
        root_id = await _resolve_root_id(db, asset_id=asset_id, owner_id=owner_id)
        if root_id not in pool:
            raise ValueError("Report pictures must come from originals in the story pool")
