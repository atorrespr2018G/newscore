"""News Storage FastAPI application for NewsCore (articles, media, categories)."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from shared.core.cors import cors_allow_credentials, cors_allow_origins

from news_storage_app.routers.articles import router as articles_router
from news_storage_app.routers.categories import router as categories_router
from news_storage_app.routers.media import router as media_router
from news_storage_app.routers.search import router as search_router
from news_storage_app.routers.tags import router as tags_router
from news_storage_app.routers.utils import register_exception_handlers
from shared.core.db import close_db, get_database, open_db
from shared.core.indexes import ensure_indexes
from shared.core.logger import get_logger
from shared.core.rest_app import register_health_routes, register_rest_middleware

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

    app = FastAPI(title="NewsCore News Storage API", version="1.0.0", lifespan=lifespan)
    register_rest_middleware(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_allow_origins(),
        allow_credentials=cors_allow_credentials(),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    app.include_router(articles_router)
    app.include_router(media_router)
    app.include_router(categories_router)
    app.include_router(tags_router)
    app.include_router(search_router)

    register_health_routes(app, service_name="news_storage_app")

    media_root = Path(os.getenv("MEDIA_ROOT", "/media"))
    images_dir = media_root / "images"
    videos_dir = media_root / "videos"
    if images_dir.is_dir():
        app.mount("/media/images", StaticFiles(directory=str(images_dir)), name="media_images")
    if videos_dir.is_dir():
        app.mount("/media/videos", StaticFiles(directory=str(videos_dir)), name="media_videos")

    logger.info("News storage app created")
    return app


app = create_app()

