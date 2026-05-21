"""Shared router utilities for the Admin app."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from shared.core.exceptions import (
    ConflictError,
    MediaUploadError,
    NewsCoreBaseException,
    NotFoundError,
    PermissionError,
    ValidationError,
)
from shared.core.logger import get_logger

logger = get_logger(__name__)


def _to_http_exception(exc: NewsCoreBaseException) -> HTTPException:
    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=404, detail=exc.detail)
    if isinstance(exc, PermissionError):
        return HTTPException(status_code=403, detail=exc.detail)
    if isinstance(exc, ConflictError):
        return HTTPException(status_code=409, detail=exc.detail)
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=422, detail=exc.detail)
    if isinstance(exc, MediaUploadError):
        return HTTPException(status_code=500, detail=exc.detail)
    return HTTPException(status_code=500, detail=exc.detail)


def register_exception_handlers(app: FastAPI) -> None:
    """Register exception handlers for domain errors.

    Args:
        app: FastAPI application.
    """

    @app.exception_handler(NewsCoreBaseException)
    async def _domain_exception_handler(_: Request, exc: NewsCoreBaseException):
        http_exc = _to_http_exception(exc)
        if http_exc.status_code >= 500:
            logger.error("Domain exception", exc_info=True)
        return JSONResponse(status_code=http_exc.status_code, content={"detail": http_exc.detail})

