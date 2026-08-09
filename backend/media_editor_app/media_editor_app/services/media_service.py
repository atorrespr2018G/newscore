"""Persistence and processing orchestration for media-editor assets."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from media_editor_app.config import get_max_upload_bytes
from media_editor_app.schemas import MediaAssetOut, MediaMetadataUpdate, VideoEditInstruction, VideoMergeInstruction
from media_editor_app.services.image_processing import extract_dimensions, remove_background
from media_editor_app.services.video_processing import merge_video_files, probe_video, render_video
from media_editor_app.storage import get_local_path, save_file

MEDIA_COLLECTION = "media_assets"
_IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
_VIDEO_TYPES = {"video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov"}


def _now() -> str:
    """Return an ISO 8601 timestamp in UTC."""

    return datetime.now(timezone.utc).isoformat()


def _serialize(doc: dict[str, Any]) -> MediaAssetOut:
    """Convert a database document into the public API response."""

    return MediaAssetOut(id=doc["_id"], **{key: value for key, value in doc.items() if key != "_id"})


async def _read_upload(file: UploadFile) -> bytes:
    """Read an upload while enforcing the configured content-size limit."""

    limit = get_max_upload_bytes()
    content = await file.read(limit + 1)
    if not content:
        raise ValueError("Uploaded file is empty")
    if len(content) > limit:
        raise ValueError(f"File exceeds the {limit // (1024 * 1024)} MB limit")
    return content


def _create_document(
    *, file_type: str, url: str, filename: str, uploader_id: str, dimensions: tuple[int | None, int | None, float | None]
) -> dict[str, Any]:
    """Create a ready media document with default newsroom metadata."""

    width, height, duration = dimensions
    return {
        "_id": str(uuid4()), "file_type": file_type, "url": url, "preview_url": url,
        "original_filename": filename, "uploader_id": uploader_id, "processing_status": "ready",
        "width": width, "height": height, "duration": duration, "version_of": None,
        "title": None, "description": None, "alt_text": None, "credit": None, "tags": [], "created_at": _now(),
    }


async def upload_media(db: AsyncIOMotorDatabase, *, file: UploadFile, uploader_id: str) -> MediaAssetOut:
    """Store a valid source upload, extract metadata, and persist the asset."""

    extension, file_type = _validate_content_type(file)
    content = await _read_upload(file)
    path, url = save_file(content=content, media_type=f"{file_type}s", extension=extension)
    dimensions = _get_dimensions(file_type=file_type, content=content, path=path)
    document = _create_document(
        file_type=file_type, url=url, filename=file.filename or f"upload.{extension}",
        uploader_id=uploader_id, dimensions=dimensions,
    )
    await db[MEDIA_COLLECTION].insert_one(document)
    return _serialize(document)


def _validate_content_type(file: UploadFile) -> tuple[str, str]:
    """Return the normalized extension and media type for a supported upload."""

    content_type = file.content_type or ""
    if content_type in _IMAGE_TYPES:
        return _IMAGE_TYPES[content_type], "image"
    if content_type in _VIDEO_TYPES:
        return _VIDEO_TYPES[content_type], "video"
    raise ValueError("Unsupported media type")


def _get_dimensions(*, file_type: str, content: bytes, path: Path) -> tuple[int | None, int | None, float | None]:
    """Extract dimensions and duration for a validated source file."""

    if file_type == "image":
        width, height = extract_dimensions(content)
        return width, height, None
    return probe_video(path)


async def list_media(
    db: AsyncIOMotorDatabase, *, owner_id: str, cursor: str | None, media_type: str | None
) -> tuple[list[MediaAssetOut], str | None]:
    """Return a cursor-paginated list of the caller's media assets."""

    query: dict[str, Any] = {"uploader_id": owner_id}
    if media_type:
        query["file_type"] = media_type
    if cursor:
        query["_id"] = {"$lt": cursor}
    documents = await db[MEDIA_COLLECTION].find(query).sort("_id", -1).limit(25).to_list(25)
    next_cursor = documents[-1]["_id"] if len(documents) == 25 else None
    return [_serialize(document) for document in documents], next_cursor


async def get_media(db: AsyncIOMotorDatabase, *, media_id: str, owner_id: str) -> MediaAssetOut:
    """Load one asset that belongs to the requesting user."""

    document = await db[MEDIA_COLLECTION].find_one({"_id": media_id, "uploader_id": owner_id})
    if document is None:
        raise LookupError("Media asset not found")
    return _serialize(document)


async def update_metadata(
    db: AsyncIOMotorDatabase, *, media_id: str, owner_id: str, update: MediaMetadataUpdate
) -> MediaAssetOut:
    """Apply editable newsroom metadata to an owned asset."""

    changes = update.model_dump(exclude_unset=True)
    document = await db[MEDIA_COLLECTION].find_one_and_update(
        {"_id": media_id, "uploader_id": owner_id}, {"$set": changes}, return_document=True,
    )
    if document is None:
        raise LookupError("Media asset not found")
    return _serialize(document)


async def delete_media(db: AsyncIOMotorDatabase, *, media_id: str, owner_id: str) -> None:
    """Delete one edit version, or an original and its whole edit family."""

    document = await db[MEDIA_COLLECTION].find_one({"_id": media_id, "uploader_id": owner_id})
    if document is None:
        raise LookupError("Media asset not found")
    if document.get("version_of"):
        await _delete_derivative(db, document=document, owner_id=owner_id)
        return
    await _delete_original_family(db, root_id=str(document["_id"]), owner_id=owner_id)


async def _delete_derivative(
    db: AsyncIOMotorDatabase, *, document: dict[str, Any], owner_id: str
) -> None:
    """Delete a single edited version and point report slots back at the original."""

    media_id = str(document["_id"])
    root_id = str(document["version_of"])
    # Also remove any later edits that still point at this id as their parent.
    dependents = await db[MEDIA_COLLECTION].find(
        {"uploader_id": owner_id, "version_of": media_id},
    ).to_list(200)
    delete_docs = [document, *dependents]
    delete_ids = [str(item["_id"]) for item in delete_docs]
    replacement = root_id
    root = await db[MEDIA_COLLECTION].find_one({"_id": root_id, "uploader_id": owner_id})
    if root is None:
        replacement = ""
    stories = await db["media_stories"].find(
        {"owner_id": owner_id, "selected_asset_ids": {"$in": delete_ids}},
    ).to_list(200)
    for story in stories:
        next_selected = list(story.get("selected_asset_ids") or [])
        for deleted_id in delete_ids:
            next_selected = _replace_selected_id(next_selected, deleted_id, replacement)
        next_selected = [asset_id for asset_id in next_selected if asset_id]
        await db["media_stories"].update_one(
            {"_id": story["_id"]},
            {"$set": {"selected_asset_ids": next_selected}},
        )
    await db["media_stories"].update_many(
        {"owner_id": owner_id},
        {"$pull": {"pool_asset_ids": {"$in": delete_ids}, "selected_asset_ids": {"$in": delete_ids}}},
    )
    for item in delete_docs:
        _unlink_media_file(item)
    await db[MEDIA_COLLECTION].delete_many({"_id": {"$in": delete_ids}, "uploader_id": owner_id})


def _replace_selected_id(selected_ids: list[str], old_id: str, replacement_id: str) -> list[str]:
    """Swap one report id for another without introducing duplicates."""

    next_ids: list[str] = []
    for asset_id in selected_ids:
        next_id = replacement_id if asset_id == old_id else asset_id
        if next_id not in next_ids:
            next_ids.append(next_id)
    return next_ids


async def _delete_original_family(
    db: AsyncIOMotorDatabase, *, root_id: str, owner_id: str
) -> None:
    """Delete an original upload, every edit of it, files, and story references."""

    family = await db[MEDIA_COLLECTION].find(
        {
            "uploader_id": owner_id,
            "$or": [{"_id": root_id}, {"version_of": root_id}],
        },
    ).to_list(200)
    if not family:
        raise LookupError("Media asset not found")
    family_ids = [str(item["_id"]) for item in family]
    await db["media_stories"].update_many(
        {"owner_id": owner_id},
        {
            "$pull": {
                "pool_asset_ids": {"$in": family_ids},
                "selected_asset_ids": {"$in": family_ids},
            },
        },
    )
    for item in family:
        _unlink_media_file(item)
    await db[MEDIA_COLLECTION].delete_many({"_id": {"$in": family_ids}, "uploader_id": owner_id})


def _unlink_media_file(document: dict[str, Any]) -> None:
    """Remove the on-disk file for one media document when present."""

    url = str(document.get("url") or "")
    if not url:
        return
    file_path = get_local_path(url)
    if file_path.exists():
        file_path.unlink()



async def create_background_removed_version(
    db: AsyncIOMotorDatabase, *, media_id: str, owner_id: str
) -> MediaAssetOut:
    """Create a PNG derivative whose background has been removed."""

    source = await _get_source_document(db, media_id=media_id, owner_id=owner_id, media_type="image")
    content = remove_background(get_local_path(source["url"]).read_bytes())
    _, url = save_file(content=content, media_type="images", extension="png")
    width, height = extract_dimensions(content)
    version = _create_version(source=source, url=url, dimensions=(width, height, None), extension="png")
    await db[MEDIA_COLLECTION].insert_one(version)
    return _serialize(version)


async def create_image_version(
    db: AsyncIOMotorDatabase, *, media_id: str, owner_id: str, file: UploadFile
) -> MediaAssetOut:
    """Persist a Filerobot-exported image as an immutable derivative version."""

    source = await _get_source_document(db, media_id=media_id, owner_id=owner_id, media_type="image")
    content = await _read_upload(file)
    extension = _IMAGE_TYPES.get(file.content_type or "", "png")
    _, url = save_file(content=content, media_type="images", extension=extension)
    width, height = extract_dimensions(content)
    version = _create_version(source=source, url=url, dimensions=(width, height, None), extension=extension)
    await db[MEDIA_COLLECTION].insert_one(version)
    return _serialize(version)


async def create_video_version(
    db: AsyncIOMotorDatabase, *, media_id: str, owner_id: str, instruction: VideoEditInstruction
) -> MediaAssetOut:
    """Render a new MP4 derivative based on an approved basic edit instruction."""

    source = await _get_source_document(db, media_id=media_id, owner_id=owner_id, media_type="video")
    output_path, url = save_file(content=b"", media_type="videos", extension="mp4")
    render_video(get_local_path(source["url"]), output_path, instruction)
    version = _create_version(source=source, url=url, dimensions=probe_video(output_path), extension="mp4")
    await db[MEDIA_COLLECTION].insert_one(version)
    return _serialize(version)


async def merge_video_assets(
    db: AsyncIOMotorDatabase, *, owner_id: str, instruction: VideoMergeInstruction
) -> MediaAssetOut:
    """Concatenate independently edited videos into one new library asset.

    Args:
        db: Media-editor Mongo database.
        owner_id: Authenticated uploader id.
        instruction: Ordered unique video asset ids to merge.

    Returns:
        Newly created merged video asset (new root, not a version of one source).

    Raises:
        LookupError: If any asset is missing or not owned.
        ValueError: If an id is not a video or merge fails.
    """

    sources: list[dict[str, Any]] = []
    for asset_id in instruction.asset_ids:
        document = await _get_source_document(
            db, media_id=asset_id, owner_id=owner_id, media_type="video",
        )
        sources.append(document)
    paths = [get_local_path(str(source["url"])) for source in sources]
    output_path, url = save_file(content=b"", media_type="videos", extension="mp4")
    merge_video_files(paths, output_path)
    merge_id = str(uuid4())
    document = _create_document(
        file_type="video",
        url=url,
        filename=f"merged-{merge_id[:8]}.mp4",
        uploader_id=owner_id,
        dimensions=probe_video(output_path),
    )
    document["_id"] = merge_id
    document["title"] = "Merged report video"
    document["description"] = "Joined from independently edited videos"
    await db[MEDIA_COLLECTION].insert_one(document)
    return _serialize(document)


async def _get_source_document(
    db: AsyncIOMotorDatabase, *, media_id: str, owner_id: str, media_type: str
) -> dict[str, Any]:
    """Return an owned source document of the requested media type."""

    document = await db[MEDIA_COLLECTION].find_one(
        {"_id": media_id, "uploader_id": owner_id, "file_type": media_type},
    )
    if document is None:
        raise LookupError("Media asset not found")
    return document


def _create_version(
    *, source: dict[str, Any], url: str, dimensions: tuple[int | None, int | None, float | None], extension: str
) -> dict[str, Any]:
    """Construct derivative metadata while retaining immutable source lineage."""

    root_id = source.get("version_of") or source["_id"]
    document = _create_document(
        file_type=source["file_type"], url=url, filename=f"edited-{root_id}.{extension}",
        uploader_id=source["uploader_id"], dimensions=dimensions,
    )
    document["version_of"] = root_id
    document["title"] = source.get("title")
    document["description"] = source.get("description")
    document["alt_text"] = source.get("alt_text")
    document["credit"] = source.get("credit")
    document["tags"] = source.get("tags", [])
    return document


async def list_versions(
    db: AsyncIOMotorDatabase, *, media_id: str, owner_id: str
) -> tuple[str, list[MediaAssetOut]]:
    """Return the original upload and all edited versions for one picture family."""

    document = await db[MEDIA_COLLECTION].find_one({"_id": media_id, "uploader_id": owner_id})
    if document is None:
        raise LookupError("Media asset not found")
    root = await _resolve_existing_root(db, document=document, owner_id=owner_id)
    root_id = str(root["_id"])
    versions = await db[MEDIA_COLLECTION].find(
        {"version_of": root_id, "uploader_id": owner_id},
    ).sort("created_at", 1).to_list(100)
    family: dict[str, dict[str, Any]] = {root_id: root}
    for item in versions:
        family[str(item["_id"])] = item
    document_id = str(document["_id"])
    if document_id not in family:
        family[document_id] = document
    ordered = [family[root_id]]
    ordered.extend(
        sorted(
            (item for item_id, item in family.items() if item_id != root_id),
            key=lambda item: str(item.get("created_at") or ""),
        ),
    )
    return root_id, [_serialize(item) for item in ordered]

async def _resolve_existing_root(
    db: AsyncIOMotorDatabase, *, document: dict[str, Any], owner_id: str
) -> dict[str, Any]:
    """Walk version_of links and return the oldest existing ancestor.

    Orphaned edits (parent deleted) are treated as their own root so re-edit still works.
    """

    current = document
    seen: set[str] = set()
    while current.get("version_of"):
        current_id = str(current["_id"])
        if current_id in seen:
            break
        seen.add(current_id)
        parent = await db[MEDIA_COLLECTION].find_one(
            {"_id": current["version_of"], "uploader_id": owner_id},
        )
        if parent is None:
            break
        current = parent
    return current
