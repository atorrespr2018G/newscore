"""Editorial workflow badge routes for the news storage app."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.services import workflow_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.view_state import mark_seen, validate_view
from shared.schemas.workflow_schemas import NewCountOut, ViewStateOut

router = APIRouter()


@router.get("/articles/review/new-count", response_model=NewCountOut)
async def get_new_reviews_count(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> NewCountOut:
    """Count stories newly entering review since the user last opened Review."""

    count = await workflow_service.count_new_reviews_for_user(db, user_id=current_user.sub)
    return NewCountOut(count=count)


@router.put("/view-state/{view}", response_model=ViewStateOut)
async def mark_view_seen(
    view: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> ViewStateOut:
    """Mark a workflow view as seen now for the current user."""

    normalized = validate_view(view)
    last_seen_at = await mark_seen(db, user_id=current_user.sub, view=normalized)
    return ViewStateOut(view=normalized, last_seen_at=last_seen_at)
