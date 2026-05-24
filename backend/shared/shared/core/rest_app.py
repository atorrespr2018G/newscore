"""Shared REST app wiring: middleware, health routes."""

from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.db import get_db
from shared.core.health import liveness, readiness
from shared.core.request_context import CorrelationIdMiddleware


def register_rest_middleware(app: FastAPI) -> None:
    """Apply cross-cutting middleware for editorial REST apps."""

    app.add_middleware(CorrelationIdMiddleware)


def register_health_routes(
    app: FastAPI,
    *,
    service_name: str,
    check_redis: bool = False,
) -> None:
    """Register liveness and readiness endpoints."""

    @app.get("/health")
    async def health() -> dict[str, str]:
        return await liveness(service_name)

    @app.get("/health/ready")
    async def ready(db: AsyncIOMotorDatabase = Depends(get_db)) -> JSONResponse:
        payload, status_code = await readiness(
            db,
            service_name=service_name,
            check_redis=check_redis,
        )
        return JSONResponse(content=payload, status_code=status_code)
