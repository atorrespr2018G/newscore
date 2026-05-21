"""Shared router utilities for the Delivery app."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from shared.core.exceptions import NewsCoreBaseException
from shared.core.logger import get_logger

logger = get_logger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """Register exception handlers for domain errors.

    Args:
        app: FastAPI application.
    """

    @app.exception_handler(NewsCoreBaseException)
    async def _domain_exception_handler(_: Request, exc: NewsCoreBaseException):
        logger.error("Domain exception", exc_info=True)
        http_exc = HTTPException(status_code=500, detail=exc.detail)
        return JSONResponse(status_code=http_exc.status_code, content={"detail": http_exc.detail})

