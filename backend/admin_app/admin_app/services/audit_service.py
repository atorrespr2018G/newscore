"""Audit log service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.pagination import PaginationParams

AUDIT_LOGS_COLLECTION = "audit_logs"


async def write_event(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str | None,
) -> None:
    """Write an audit event to MongoDB.

    Args:
        db: MongoDB database handle.
        user_id: Actor user id.
        action: Action name (e.g. "user.create").
        resource_type: Resource type (e.g. "user").
        resource_id: Optional resource id.
    """

    doc = {
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db[AUDIT_LOGS_COLLECTION].insert_one(doc)


async def list_events(db: AsyncIOMotorDatabase, params: PaginationParams) -> dict[str, Any]:
    """List audit events with pagination.

    Args:
        db: MongoDB database handle.
        params: Pagination parameters.

    Returns:
        Paginated list response.
    """

    cursor = (
        db[AUDIT_LOGS_COLLECTION]
        .find({})
        .sort("timestamp", -1)
        .skip(params.skip)
        .limit(params.page_size)
    )
    items = [doc async for doc in cursor]
    total = await db[AUDIT_LOGS_COLLECTION].count_documents({})
    return {
        "items": items,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "has_more": (params.skip + len(items)) < total,
    }

