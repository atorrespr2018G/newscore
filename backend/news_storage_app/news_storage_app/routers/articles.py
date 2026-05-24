"""Article routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.services import article_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.schemas.article_schemas import ArticleCreate, ArticleDetailOut, ArticleOut, ArticleUpdate

router = APIRouter(prefix="/articles")


@router.post("", response_model=ArticleOut, status_code=status.HTTP_201_CREATED)
async def create_article(
    body: ArticleCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("reporter", "editor")),
) -> ArticleOut:
    """Create a new article draft."""

    return await article_service.create(db, body, author_id=current_user.sub, actor_id=current_user.sub)


@router.get("", response_model=list[ArticleOut])
async def list_articles(
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("reporter", "editor", "admin")),
) -> list[ArticleOut]:
    """List all articles (internal use)."""

    return await article_service.list_all(db)


@router.get("/{article_id}", response_model=ArticleDetailOut)
async def get_article(
    article_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("reporter", "editor", "admin")),
) -> ArticleDetailOut:
    """Get an article by id."""

    return await article_service.get_detail_by_id(db, article_id)


@router.patch("/{article_id}", response_model=ArticleDetailOut)
async def update_article(
    article_id: str,
    body: ArticleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("reporter", "editor")),
) -> ArticleDetailOut:
    """Update an article."""

    return await article_service.update(db, article_id=article_id, body=body, actor_id=current_user.sub)


@router.post("/{article_id}/publish", response_model=ArticleDetailOut)
async def publish_article(
    article_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> ArticleDetailOut:
    """Publish an article."""

    return await article_service.publish(db, article_id=article_id, actor_id=current_user.sub)


@router.post("/{article_id}/archive", response_model=ArticleDetailOut)
async def archive_article(
    article_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> ArticleDetailOut:
    """Archive an article."""

    return await article_service.archive(db, article_id=article_id, actor_id=current_user.sub)

