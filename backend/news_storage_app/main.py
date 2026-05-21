"""News Storage FastAPI application for NewsCore (articles, media, categories)."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from news_storage_app.routers.articles import router as articles_router
from news_storage_app.routers.categories import router as categories_router
from news_storage_app.routers.media import router as media_router
from news_storage_app.routers.search import router as search_router
from news_storage_app.routers.tags import router as tags_router
from news_storage_app.routers.utils import register_exception_handlers
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

    app = FastAPI(title="NewsCore News Storage API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    app.include_router(articles_router)
    app.include_router(media_router)
    app.include_router(categories_router)
    app.include_router(tags_router)
    app.include_router(search_router)

    logger.info("News storage app created")
    return app


app = create_app()

