"""Reporter story packages: originals pool plus ordered report selection."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from media_editor_app.schemas import (
    MediaAssetOut,
    MediaStoryCreate,
    MediaStoryHandoffOut,
    MediaStoryOut,
    MediaStoryUpdate,
)
from media_editor_app.services import media_service

STORIES = "media_stories"
ASSETS = "media_assets"
_MAX_VERSION_DEPTH = 20


def _now() -> str:
    """Return the current UTC timestamp in ISO format."""

    return datetime.now(timezone.utc).isoformat()


def _serialize(doc: dict[str, Any]) -> MediaStoryOut:
    """Serialize a Mongo story document into its API form."""

    data = {key: value for key, value in doc.items() if key != "_id"}
    data.setdefault("market_code", "us")
    data.setdefault("town_id", None)
    data.setdefault("county_id", None)
    data.setdefault("international_potential", None)
    data["category_slugs"] = list(data.get("category_slugs") or [])
    return MediaStoryOut(id=doc["_id"], **data)


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
        "market_code": payload.market_code,
        "town_id": payload.town_id,
        "county_id": payload.county_id,
        "category_slugs": list(payload.category_slugs),
        "international_potential": payload.international_potential,
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
    # Detach former nested edits so each pool item is a standalone picture/video.
    if payload.pool_asset_ids:
        await db[ASSETS].update_many(
            {"_id": {"$in": list(payload.pool_asset_ids)}, "uploader_id": owner_id},
            {"$set": {"version_of": None}},
        )
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
    if document.get("file_type") not in {"image", "video"}:
        raise ValueError("Only image and video assets can join the story pool")
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


async def list_ready_handoffs(
    db: AsyncIOMotorDatabase, *, owner_id: str
) -> list[MediaStoryHandoffOut]:
    """List ready story packages with report assets in transfer order.

    Each selected asset is returned independently so the reporter can import
    originals and edits as separate article media items.
    """

    documents = await db[STORIES].find(
        {"owner_id": owner_id, "status": "ready"},
    ).sort("updated_at", -1).to_list(100)
    packages: list[MediaStoryHandoffOut] = []
    for document in documents:
        story = _serialize(document)
        assets: list[MediaAssetOut] = []
        for asset_id in story.selected_asset_ids:
            try:
                assets.append(
                    await media_service.get_media(db, media_id=asset_id, owner_id=owner_id),
                )
            except LookupError:
                continue
        packages.append(MediaStoryHandoffOut(story=story, assets=assets))
    return packages


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
    """Validate pool membership and that report picks are exact pool asset IDs."""

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
        if by_id[asset_id].get("file_type") not in {"image", "video"}:
            raise ValueError("Story pool may only contain image or video assets")
    pool = set(payload.pool_asset_ids)
    for asset_id in payload.selected_asset_ids:
        if asset_id not in pool:
            raise ValueError("Report pictures must come from assets in the story pool")
