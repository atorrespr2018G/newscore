"""Unit tests for multi-market write validation."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

_ROOT = Path(__file__).resolve().parents[1] / "shared"
_NEWS = Path(__file__).resolve().parents[1] / "news_storage_app"
_LAYOUT = Path(__file__).resolve().parents[1] / "layout_admin_app"
for path in (_ROOT, _NEWS, _LAYOUT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from layout_admin_app.services import layout_service
from news_storage_app.services import article_service
from shared.core.exceptions import ValidationError
from shared.schemas.layout_schemas import LayoutCreate


def _db_with_market(exists: bool) -> MagicMock:
    db = MagicMock()
    collection = MagicMock()
    collection.find_one = AsyncMock(return_value={"_id": "market-1"} if exists else None)
    db.__getitem__ = MagicMock(return_value=collection)
    return db


@pytest.mark.asyncio
async def test_validate_market_ids_rejects_unknown() -> None:
    db = _db_with_market(exists=False)
    with pytest.raises(ValidationError, match="Unknown market_id"):
        await article_service._validate_market_ids(db, ["missing-market"])


@pytest.mark.asyncio
async def test_validate_market_ids_requires_at_least_one() -> None:
    db = _db_with_market(exists=True)
    with pytest.raises(ValidationError, match="At least one market_id"):
        await article_service._validate_market_ids(db, [])


@pytest.mark.asyncio
async def test_layout_create_validates_market_id() -> None:
    db = _db_with_market(exists=False)
    with pytest.raises(ValidationError, match="Unknown market_id"):
        await layout_service._validate_market_id(db, "missing")
