"""Unit tests for audit logging."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

_ROOT = Path(__file__).resolve().parents[1] / "shared"
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from shared.core.audit import write_event


@pytest.mark.asyncio
async def test_publish_writes_audit_event() -> None:
    db = MagicMock()
    collection = MagicMock()
    collection.insert_one = AsyncMock()
    db.__getitem__ = MagicMock(return_value=collection)

    await write_event(
        db,
        user_id="editor-1",
        action="article.publish",
        resource_type="article",
        resource_id="article-1",
    )

    collection.insert_one.assert_awaited_once()
    doc = collection.insert_one.await_args.args[0]
    assert doc["action"] == "article.publish"
    assert doc["resource_id"] == "article-1"
