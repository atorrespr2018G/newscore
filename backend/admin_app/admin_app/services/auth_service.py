"""Authentication service (login)."""

from __future__ import annotations

import os
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from admin_app.helpers.password_helpers import verify_password
from shared.core.auth import create_access_token
from shared.core.exceptions import PermissionError
from shared.schemas.user_schemas import LoginRequest, TokenResponse

USERS_COLLECTION = "users"


async def login(db: AsyncIOMotorDatabase, body: LoginRequest) -> TokenResponse:
    """Authenticate a user and return a JWT.

    Args:
        db: MongoDB database handle.
        body: Login request body.

    Returns:
        Token response.

    Raises:
        PermissionError: If credentials are invalid.
    """

    user: dict[str, Any] | None = await db[USERS_COLLECTION].find_one({"email": body.email})
    if user is None:
        raise PermissionError("Invalid credentials")
    if not user.get("is_active", True):
        raise PermissionError("User is inactive")
    if not verify_password(password=body.password, password_hash=user["password_hash"]):
        raise PermissionError("Invalid credentials")

    expires = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    token = create_access_token(subject=str(user["_id"]), role=str(user["role"]), expires_minutes=expires)
    return TokenResponse(access_token=token)

