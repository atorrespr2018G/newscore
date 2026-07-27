"""Sports page section list routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import sports_page_sections_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.sports_page_sections_schemas import (
    SportsPageSectionsOut,
    SportsPageSectionsUpdate,
)

router = APIRouter(prefix="/sports-page-sections")


@router.get("", response_model=SportsPageSectionsOut)
async def get_sports_page_sections(
    market: str = Query(DEFAULT_MARKET_CODE),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> SportsPageSectionsOut:
    """Return the ordered sports section list for a market."""

    return await sports_page_sections_service.get_for_market(db, market)


@router.put("", response_model=SportsPageSectionsOut)
async def put_sports_page_sections(
    body: SportsPageSectionsUpdate,
    market: str = Query(DEFAULT_MARKET_CODE),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> SportsPageSectionsOut:
    """Replace the ordered sports section list and sync the sports page layout."""

    return await sports_page_sections_service.replace_for_market(db, market, body)
