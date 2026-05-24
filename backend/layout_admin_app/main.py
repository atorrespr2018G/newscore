"""Layout Admin FastAPI application for NewsCore (layouts, slots, widgets)."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.core.cors import cors_allow_credentials, cors_allow_origins

from layout_admin_app.routers.layouts import router as layouts_router
from layout_admin_app.routers.slots import router as slots_router
from layout_admin_app.routers.utils import register_exception_handlers
from layout_admin_app.routers.widgets import router as widgets_router
from shared.core.db import close_db, open_db
from shared.core.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Manage shared resources for the app lifetime."""

    open_db()
    try:
        yield
    finally:
        close_db()


def create_app() -> FastAPI:
    """Create the FastAPI app instance.

    Returns:
        Configured FastAPI application.
    """

    app = FastAPI(title="NewsCore Layout Admin API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_allow_origins(),
        allow_credentials=cors_allow_credentials(),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    app.include_router(layouts_router)
    app.include_router(slots_router)
    app.include_router(widgets_router)

    logger.info("Layout admin app created")
    return app


app = create_app()

