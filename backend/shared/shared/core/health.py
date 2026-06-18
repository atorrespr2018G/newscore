"""Health and readiness endpoints for REST services."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.cache import get_redis
from shared.core.logger import get_logger

logger = get_logger(__name__)


async def liveness(service_name: str) -> dict[str, str]:
    """Basic liveness payload matching subgraph /health shape."""

    return {"status": "ok", "service": service_name}


async def readiness(
    db: AsyncIOMotorDatabase,
    *,
    service_name: str,
    check_redis: bool = False,
) -> tuple[dict[str, Any], int]:
    """Readiness probe: verify MongoDB (and optionally Redis)."""

    checks: dict[str, str] = {}
    ok = True

    try:
        await db.command("ping")
        checks["mongodb"] = "ok"
    except Exception as exc:  # noqa: BLE001 — surface dependency status in probe
        ok = False
        logger.error("Readiness check failed: mongodb", exc_info=True)
        checks["mongodb"] = f"error: {exc}"

    if check_redis:
        try:
            await get_redis().ping()
            checks["redis"] = "ok"
        except Exception as exc:  # noqa: BLE001
            ok = False
            logger.error("Readiness check failed: redis", exc_info=True)
            checks["redis"] = f"error: {exc}"

    payload: dict[str, Any] = {
        "status": "ok" if ok else "degraded",
        "service": service_name,
        "checks": checks,
    }
    return payload, 200 if ok else 503
