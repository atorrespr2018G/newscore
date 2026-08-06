"""MongoDB lifecycle and collection-index helpers."""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from media_editor_app.config import get_database_name, get_mongo_uri

_client: AsyncIOMotorClient | None = None


def open_database() -> None:
    """Initialize the process-wide MongoDB client."""

    global _client
    _client = AsyncIOMotorClient(get_mongo_uri())


def close_database() -> None:
    """Close the process-wide MongoDB client."""

    if _client is not None:
        _client.close()


def get_database() -> AsyncIOMotorDatabase:
    """Return the configured isolated media-editor database.

    Raises:
        RuntimeError: If the application lifespan has not opened MongoDB.
    """

    if _client is None:
        raise RuntimeError("Database client has not been initialized")
    return _client[get_database_name()]


async def ensure_indexes() -> None:
    """Create indexes required for asset browse and collection ownership."""

    database = get_database()
    await database["media_assets"].create_index([("uploader_id", 1), ("_id", -1)])
    await database["media_assets"].create_index([("uploader_id", 1), ("file_type", 1)])
    await database["media_collections"].create_index([("owner_id", 1), ("updated_at", -1)])
