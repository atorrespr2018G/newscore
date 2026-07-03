"""Unit tests for reporter listing and bio ownership."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

_ROOT = Path(__file__).resolve().parents[1]
_ADMIN = _ROOT / "admin_app"
_SHARED = _ROOT / "shared"
if str(_SHARED) not in sys.path:
    sys.path.insert(0, str(_SHARED))
if str(_ADMIN) not in sys.path:
    sys.path.insert(0, str(_ADMIN))

# Reporters router imports motor; stub it so collection tests do not need Mongo drivers.
if "motor" not in sys.modules:
    motor_stub = MagicMock()
    motor_stub.motor_asyncio = MagicMock()
    sys.modules["motor"] = motor_stub
    sys.modules["motor.motor_asyncio"] = motor_stub.motor_asyncio

from admin_app.routers import reporters as reporters_router
from admin_app.services import user_service
from shared.core.auth import TokenPayload, require_role
from shared.core.exceptions import PermissionError
from shared.core.pagination import PaginationParams
from shared.schemas.user_schemas import ReporterBioUpdate


def _mock_db_with_users(docs: list[dict]) -> MagicMock:
    """Build a mock MongoDB handle that returns the given user documents."""

    db = MagicMock()
    collection = MagicMock()
    collection.count_documents = AsyncMock(return_value=len(docs))

    class _Cursor:
        def __init__(self, items: list[dict]) -> None:
            self._items = items

        def sort(self, *_args: object, **_kwargs: object) -> _Cursor:
            return self

        def skip(self, _skip: int) -> _Cursor:
            return self

        def limit(self, _limit: int) -> _Cursor:
            return self

        def __aiter__(self) -> _Cursor:
            self._index = 0
            return self

        async def __anext__(self) -> dict:
            if self._index >= len(self._items):
                raise StopAsyncIteration
            doc = self._items[self._index]
            self._index += 1
            return doc

    collection.find = MagicMock(return_value=_Cursor(docs))
    db.__getitem__ = MagicMock(return_value=collection)
    return db


@pytest.mark.asyncio
async def test_list_reporters_filters_by_role_at_db() -> None:
    """list_reporters queries MongoDB with a reporter role filter."""

    db = _mock_db_with_users(
        [
            {
                "_id": "rep-1",
                "email": "rep@example.com",
                "role": "reporter",
                "full_name": "Reporter One",
                "created_at": "2026-01-01T00:00:00Z",
            }
        ]
    )
    pagination = PaginationParams(page=1, page_size=20)

    items, total = await user_service.list_reporters(db, pagination)

    collection = db.__getitem__.return_value
    collection.count_documents.assert_awaited_once_with({"role": "reporter"})
    collection.find.assert_called_once_with({"role": "reporter"})
    assert total == 1
    assert len(items) == 1
    assert items[0].role == "reporter"


@pytest.mark.asyncio
async def test_reporter_cannot_update_other_bio() -> None:
    """A reporter token cannot patch another reporter's bio."""

    db = MagicMock()
    current_user = TokenPayload(sub="rep-1", role="reporter", exp=9999999999)
    body = ReporterBioUpdate(bio="Updated bio")

    with pytest.raises(PermissionError, match="Cannot update another reporter's bio"):
        await reporters_router.update_reporter_bio(
            reporter_id="rep-2",
            body=body,
            db=db,
            current_user=current_user,
        )


@pytest.mark.asyncio
async def test_reporter_can_update_own_bio() -> None:
    """A reporter can patch their own bio."""

    db = MagicMock()
    collection = MagicMock()
    collection.find_one_and_update = AsyncMock(
        return_value={
            "_id": "rep-1",
            "email": "rep@example.com",
            "role": "reporter",
            "full_name": "Reporter One",
            "bio": "New bio",
            "created_at": "2026-01-01T00:00:00Z",
        }
    )
    db.__getitem__ = MagicMock(return_value=collection)
    current_user = TokenPayload(sub="rep-1", role="reporter", exp=9999999999)
    body = ReporterBioUpdate(bio="New bio")

    result = await reporters_router.update_reporter_bio(
        reporter_id="rep-1",
        body=body,
        db=db,
        current_user=current_user,
    )

    assert result.bio == "New bio"


@pytest.mark.asyncio
async def test_admin_can_update_any_reporter_bio() -> None:
    """An admin can patch any reporter bio."""

    db = MagicMock()
    collection = MagicMock()
    collection.find_one_and_update = AsyncMock(
        return_value={
            "_id": "rep-2",
            "email": "rep2@example.com",
            "role": "reporter",
            "full_name": "Reporter Two",
            "bio": "Admin edit",
            "created_at": "2026-01-01T00:00:00Z",
        }
    )
    db.__getitem__ = MagicMock(return_value=collection)
    current_user = TokenPayload(sub="admin-1", role="admin", exp=9999999999)
    body = ReporterBioUpdate(bio="Admin edit")

    result = await reporters_router.update_reporter_bio(
        reporter_id="rep-2",
        body=body,
        db=db,
        current_user=current_user,
    )

    assert result.bio == "Admin edit"


@pytest.mark.asyncio
async def test_search_requires_auth_role() -> None:
    """Search endpoint dependency rejects callers without an allowed role."""

    dep = require_role("reporter", "editor", "admin")
    reporter = TokenPayload(sub="rep-1", role="reporter", exp=9999999999)
    assert await dep(user=reporter) == reporter

    guest = TokenPayload(sub="guest-1", role="viewer", exp=9999999999)
    with pytest.raises(PermissionError, match="Insufficient role"):
        await dep(user=guest)
