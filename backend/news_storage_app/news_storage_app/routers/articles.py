"""Article routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.services import article_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.pagination import PaginationDep, PaginationParams
from shared.schemas.article_schemas import (
    ArticleCreate,
    ArticleDetailOut,
    ArticleOut,
    ArticleUpdate,
    StoryGroupOut,
)
from shared.schemas.common import PaginatedResponse

router = APIRouter(prefix="/articles")


@router.post("", response_model=ArticleOut, status_code=status.HTTP_201_CREATED)
async def create_article(
    body: ArticleCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("reporter", "editor")),
) -> ArticleOut:
    """Create a new article draft."""

    return await article_service.create(
        db,
        body,
        author_id=current_user.sub,
        actor_id=current_user.sub,
        actor_role=current_user.role,
    )


@router.get("", response_model=PaginatedResponse)
async def list_articles(
    db: AsyncIOMotorDatabase = Depends(get_db),
    pagination: PaginationParams = PaginationDep,
    _: TokenPayload = Depends(require_role("reporter", "editor", "admin")),
) -> PaginatedResponse:
    """List articles with pagination (internal use)."""

    items, total = await article_service.list_all(db, pagination)
    return PaginatedResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        has_more=(pagination.skip + len(items)) < total,
    )


@router.get("/story-groups", response_model=list[StoryGroupOut])
async def list_article_story_groups(
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("reporter", "editor", "admin")),
) -> list[StoryGroupOut]:
    """List distinct editor-assigned story groups with article counts.

    Declared before the dynamic ``/{article_id}`` route so the literal
    ``story-groups`` path is not captured as an article id.
    """

    return await article_service.list_story_groups(db)


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
    current_user: TokenPayload = Depends(require_role("reporter", "editor")),
) -> ArticleDetailOut:
    """Update an article."""

    return await article_service.update(
        db,
        article_id=article_id,
        body=body,
        actor_id=current_user.sub,
        actor_role=current_user.role,
    )


@router.post("/{article_id}/publish", response_model=ArticleDetailOut)
async def publish_article(
    article_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> ArticleDetailOut:
    """Publish an article."""

    return await article_service.publish(db, article_id=article_id, actor_id=current_user.sub)


@router.post("/{article_id}/submit-for-review", response_model=ArticleDetailOut)
async def submit_article_for_review(
    article_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("reporter", "editor", "admin")),
) -> ArticleDetailOut:
    """Submit a draft article for editorial review."""

    return await article_service.submit_for_review(
        db, article_id=article_id, actor_id=current_user.sub
    )


@router.post("/{article_id}/approve", response_model=ArticleDetailOut)
async def approve_article(
    article_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> ArticleDetailOut:
    """Approve an in-review article and publish it."""

    return await article_service.approve(db, article_id=article_id, actor_id=current_user.sub)


@router.post("/{article_id}/send-back", response_model=ArticleDetailOut)
async def send_article_back(
    article_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> ArticleDetailOut:
    """Send an in-review article back to draft."""

    return await article_service.send_back(db, article_id=article_id, actor_id=current_user.sub)


@router.post("/{article_id}/archive", response_model=ArticleDetailOut)
async def archive_article(
    article_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> ArticleDetailOut:
    """Archive an article."""

    return await article_service.archive(db, article_id=article_id, actor_id=current_user.sub)
