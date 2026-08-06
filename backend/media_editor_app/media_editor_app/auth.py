"""JWT authorization shared by the media-editor API endpoints."""

from __future__ import annotations

import os
from typing import Final

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

_bearer_scheme = HTTPBearer(auto_error=False)
_JWT_ALGORITHM: Final[str] = "HS256"
_ADMIN_ROLE: Final[str] = "admin"


class TokenPayload(BaseModel):
    """Identity claims accepted from a NewsCore access token."""

    sub: str
    role: str
    exp: int


def _get_secret() -> str:
    """Return the shared JWT verification secret."""

    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret:
        raise RuntimeError("JWT_SECRET is required")
    return secret


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> TokenPayload:
    """Validate an incoming NewsCore bearer token.

    Raises:
        HTTPException: If the token is absent, invalid, or expired.
    """

    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        payload = jwt.decode(credentials.credentials, _get_secret(), algorithms=[_JWT_ALGORITHM])
        return TokenPayload.model_validate(payload)
    except (JWTError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token") from exc


def require_role(*allowed_roles: str):
    """Create a dependency that allows the requested NewsCore roles."""

    allowed = set(allowed_roles)

    async def role_dependency(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        """Validate that the authenticated user is authorized."""

        if user.role != _ADMIN_ROLE and user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return role_dependency
