"""Tests for REST health endpoints."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))
if str(_ROOT / "admin_app") not in sys.path:
    sys.path.insert(0, str(_ROOT / "admin_app"))

from shared.core.health import liveness, readiness


@pytest.mark.asyncio
async def test_liveness_returns_ok() -> None:
    payload = await liveness("admin_app")
    assert payload == {"status": "ok", "service": "admin_app"}


@pytest.mark.asyncio
async def test_readiness_ok_when_mongo_pings() -> None:
    db = MagicMock()
    db.command = AsyncMock(return_value={"ok": 1})

    payload, status = await readiness(db, service_name="admin_app")
    assert status == 200
    assert payload["status"] == "ok"
    assert payload["checks"]["mongodb"] == "ok"


@pytest.mark.asyncio
async def test_readiness_degraded_when_mongo_fails() -> None:
    db = MagicMock()
    db.command = AsyncMock(side_effect=RuntimeError("connection refused"))

    payload, status = await readiness(db, service_name="admin_app")
    assert status == 503
    assert payload["status"] == "degraded"
    assert "error" in payload["checks"]["mongodb"]
