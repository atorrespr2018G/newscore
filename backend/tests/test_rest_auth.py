"""Unit tests for auth and role enforcement helpers."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1] / "shared"
_ADMIN = Path(__file__).resolve().parents[1] / "admin_app"
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
if str(_ADMIN) not in sys.path:
    sys.path.insert(0, str(_ADMIN))

from admin_app.services import auth_service
from shared.core.auth import TokenPayload, create_access_token, require_role
from shared.core.exceptions import PermissionError
from shared.schemas.user_schemas import LoginRequest


@pytest.mark.asyncio
async def test_login_rejects_invalid_credentials() -> None:
    db = MagicMock()
    collection = MagicMock()
    collection.find_one = AsyncMock(return_value=None)
    db.__getitem__ = MagicMock(return_value=collection)

    with pytest.raises(PermissionError, match="Invalid credentials"):
        await auth_service.login(db, LoginRequest(email="nope@example.com", password="wrong"))


@pytest.mark.asyncio
async def test_login_returns_token_for_valid_user() -> None:
    db = MagicMock()
    collection = MagicMock()
    collection.find_one = AsyncMock(
        return_value={
            "_id": "user-1",
            "email": "admin@newscore.local",
            "password_hash": "$2b$12$test",
            "role": "admin",
            "is_active": True,
        }
    )
    db.__getitem__ = MagicMock(return_value=collection)

    with patch("admin_app.services.auth_service.verify_password", return_value=True):
        token = await auth_service.login(
            db,
            LoginRequest(email="admin@newscore.local", password="secret"),
        )

    assert token.access_token


@pytest.mark.asyncio
async def test_require_role_blocks_wrong_role() -> None:
    dep = require_role("admin")
    user = TokenPayload(sub="user-1", role="reporter", exp=9999999999)
    with pytest.raises(PermissionError, match="Insufficient role"):
        await dep(user=user)


@pytest.mark.asyncio
async def test_require_role_allows_admin_superuser() -> None:
    dep = require_role("reporter", "editor")
    admin = TokenPayload(sub="admin-1", role="admin", exp=9999999999)
    assert await dep(user=admin) == admin


def test_create_access_token_uses_secret() -> None:
    os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-only-32chars")
    token = create_access_token(subject="abc", role="admin", expires_minutes=5)
    assert isinstance(token, str)
    assert len(token) > 20
