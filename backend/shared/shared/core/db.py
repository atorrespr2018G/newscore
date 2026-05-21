"""MongoDB connection lifecycle for NewsCore services."""

from __future__ import annotations

import os
from typing import AsyncIterator

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from shared.core.logger import get_logger

logger = get_logger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def open_db() -> None:
    """Initialize the global Motor client.

    Raises:
        RuntimeError: If required environment variables are missing.
    """

    global _client, _db
    if _client is not None and _db is not None:
        return

    mongo_uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB_NAME")
    if not mongo_uri or not db_name:
        raise RuntimeError("Missing MONGO_URI or MONGO_DB_NAME environment variables")

    _client = AsyncIOMotorClient(mongo_uri)
    _db = _client[db_name]
    logger.info("MongoDB client initialized")


def close_db() -> None:
    """Close the global Motor client."""

    global _client, _db
    if _client is None:
        return
    _client.close()
    _client = None
    _db = None
    logger.info("MongoDB client closed")


def get_database() -> AsyncIOMotorDatabase:
    """Return the active database handle.

    Returns:
        The configured MongoDB database.

    Raises:
        RuntimeError: If open_db() has not been called.
    """

    if _db is None:
        raise RuntimeError("Database not initialized. Did you call open_db() on startup?")
    return _db


async def get_db() -> AsyncIterator[AsyncIOMotorDatabase]:
    """FastAPI dependency to inject the database handle.

    Yields:
        The configured MongoDB database.

    Raises:
        RuntimeError: If open_db() has not been called.
    """

    if _db is None:
        raise RuntimeError("Database not initialized. Did you call open_db() on startup?")
    yield _db

