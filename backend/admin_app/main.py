"""Admin FastAPI application for NewsCore (users, roles, audit logs)."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.core.cors import cors_allow_credentials, cors_allow_origins

from shared.core.db import close_db, get_database, open_db
from shared.core.indexes import ensure_indexes
from shared.core.logger import get_logger

from admin_app.routers.audit import router as audit_router
from admin_app.routers.reporters import router as reporters_router
from admin_app.routers.roles import router as roles_router
from admin_app.routers.users import router as users_router
from admin_app.routers.utils import register_exception_handlers

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Manage shared resources for the app lifetime."""

    open_db()
    await ensure_indexes(get_database())
    try:
        yield
    finally:
        close_db()


def create_app() -> FastAPI:
    """Create the FastAPI app instance.

    Returns:
        Configured FastAPI application.
    """

    app = FastAPI(title="NewsCore Admin API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_allow_origins(),
        allow_credentials=cors_allow_credentials(),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    app.include_router(users_router)
    app.include_router(reporters_router)
    app.include_router(roles_router)
    app.include_router(audit_router)

    logger.info("Admin app created")
    return app


app = create_app()

