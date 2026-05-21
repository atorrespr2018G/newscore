"""JWT auth utilities shared across NewsCore services."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Final

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from shared.core.constants import JWT_ALGORITHM
from shared.core.exceptions import PermissionError

bearer_scheme = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    """Decoded JWT payload."""

    sub: str = Field(..., description="User id")
    role: str = Field(..., description="User role")
    exp: int = Field(..., description="Expiration as unix timestamp")


def create_access_token(*, subject: str, role: str, expires_minutes: int) -> str:
    """Create a signed access token.

    Args:
        subject: User id.
        role: User role claim.
        expires_minutes: Token lifetime in minutes.

    Returns:
        Signed JWT string.
    """

    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("Missing JWT_SECRET environment variable")

    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {"sub": subject, "role": role, "exp": int(exp.timestamp())}
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> TokenPayload:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("Missing JWT_SECRET environment variable")
    try:
        data = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
        return TokenPayload.model_validate(data)
    except JWTError as exc:
        raise PermissionError("Invalid token") from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> TokenPayload:
    """Extract and validate the current user from Authorization header.

    Args:
        credentials: HTTP bearer credentials.

    Returns:
        Decoded token payload.

    Raises:
        PermissionError: If token is missing or invalid.
    """

    if credentials is None or not credentials.credentials:
        raise PermissionError("Missing bearer token")
    return _decode_token(credentials.credentials)


def require_role(*allowed_roles: str):
    """Dependency factory that enforces role membership.

    Args:
        allowed_roles: Roles permitted to access the endpoint.

    Returns:
        A dependency callable returning TokenPayload.
    """

    allowed: Final[set[str]] = set(allowed_roles)

    async def _dep(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        if user.role not in allowed:
            raise PermissionError("Insufficient role")
        return user

    return _dep

