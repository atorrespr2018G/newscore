"""Independent FastAPI application for newsroom media editing."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from media_editor_app.config import get_allowed_origins, get_storage_root
from media_editor_app.database import close_database, ensure_indexes, open_database
from media_editor_app.routers.media import router as media_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize and close independent media-editor infrastructure."""

    open_database()
    await ensure_indexes()
    try:
        yield
    finally:
        close_database()


def create_app() -> FastAPI:
    """Create the independently deployable media-editor API application."""

    app = FastAPI(title="NewsCore Media Editor API", version="0.1.0", lifespan=lifespan)
    storage_root = get_storage_root()
    storage_root.mkdir(parents=True, exist_ok=True)
    origins = get_allowed_origins()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=bool(origins),
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
        expose_headers=["Content-Length", "Content-Type"],
    )
    app.include_router(media_router)
    app.mount("/media", StaticFiles(directory=str(storage_root)), name="media")
    return app


app = create_app()
