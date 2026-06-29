"""Editorial workflow badge routes for the layout admin app."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import workflow_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.core.view_state import mark_seen, validate_view
from shared.schemas.workflow_schemas import NewCountOut, ViewStateOut

router = APIRouter()


@router.get("/placements/new-count", response_model=NewCountOut)
async def get_new_placements_count(
    market: str = Query(DEFAULT_MARKET_CODE),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("editor", "admin")),
) -> NewCountOut:
    """Count stories newly placed since the user last opened the Placement tab."""

    count = await workflow_service.count_new_placements_for_user(
        db, user_id=current_user.sub, market_code=market
    )
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
