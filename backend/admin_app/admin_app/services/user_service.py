"""User management service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from admin_app.helpers.password_helpers import hash_password
from shared.core.audit import write_event
from shared.core.exceptions import ConflictError, NotFoundError, ValidationError
from shared.models.user import UserRoleType
from shared.schemas.user_schemas import UserCreate, UserOut, UserUpdate

USERS_COLLECTION = "users"


def _to_user_out(doc: dict[str, Any]) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        email=doc["email"],
        role=doc["role"],
        full_name=doc["full_name"],
        avatar_url=doc.get("avatar_url"),
        bio=doc.get("bio"),
        is_active=doc.get("is_active", True),
        created_at=doc.get("created_at", ""),
    )


async def create_user(
    db: AsyncIOMotorDatabase,
    body: UserCreate,
    *,
    actor_id: str | None = None,
) -> UserOut:
    """Create a new user."""

    existing = await db[USERS_COLLECTION].find_one({"email": body.email})
    if existing is not None:
        raise ConflictError("Email already exists")

    user_id = str(uuid4())
    doc = {
        "_id": user_id,
        "email": body.email,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "full_name": body.full_name,
        "avatar_url": None,
        "bio": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db[USERS_COLLECTION].insert_one(doc)
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="user.create",
            resource_type="user",
            resource_id=user_id,
        )
    return _to_user_out(doc)


async def list_users(db: AsyncIOMotorDatabase) -> list[UserOut]:
    """List all users."""

    cursor = db[USERS_COLLECTION].find({}).sort("created_at", -1)
    return [_to_user_out(doc) async for doc in cursor]


async def update_user(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    body: UserUpdate,
    actor_id: str | None = None,
) -> UserOut:
    """Update a user."""

    update: dict[str, Any] = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise ValidationError("No fields to update")

    doc = await db[USERS_COLLECTION].find_one_and_update(
        {"_id": user_id},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise NotFoundError("User not found")
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="user.update",
            resource_type="user",
            resource_id=user_id,
        )
    return _to_user_out(doc)


async def delete_user(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    actor_id: str | None = None,
) -> None:
    """Delete a user."""

    result = await db[USERS_COLLECTION].delete_one({"_id": user_id})
    if result.deleted_count == 0:
        raise NotFoundError("User not found")
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="user.delete",
            resource_type="user",
            resource_id=user_id,
        )


async def assign_role(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    role: UserRoleType,
    actor_id: str | None = None,
) -> UserOut:
    """Assign a role to a user."""

    doc = await db[USERS_COLLECTION].find_one_and_update(
        {"_id": user_id},
        {"$set": {"role": role}},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise NotFoundError("User not found")
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="user.assign_role",
            resource_type="user",
            resource_id=user_id,
        )
    return _to_user_out(doc)


async def update_reporter_bio(db: AsyncIOMotorDatabase, *, reporter_id: str, bio: str) -> UserOut:
    """Update the bio for a reporter user."""

    doc = await db[USERS_COLLECTION].find_one_and_update(
        {"_id": reporter_id},
        {"$set": {"bio": bio}},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise NotFoundError("User not found")
    return _to_user_out(doc)
