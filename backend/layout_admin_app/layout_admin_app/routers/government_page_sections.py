"""Government page section list routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import government_page_sections_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.government_page_sections_schemas import (
    GovernmentPageSectionsOut,
    GovernmentPageSectionsUpdate,
)

router = APIRouter(prefix="/government-page-sections")


@router.get("", response_model=GovernmentPageSectionsOut)
async def get_government_page_sections(
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> GovernmentPageSectionsOut:
    """Return the ordered government section list for a market or state region."""

    return await government_page_sections_service.get_for_market(
        db,
        market,
        region_code=region,
    )


@router.put("", response_model=GovernmentPageSectionsOut)
async def put_government_page_sections(
    body: GovernmentPageSectionsUpdate,
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> GovernmentPageSectionsOut:
    """Replace the ordered government section list and sync the government page layout."""

    return await government_page_sections_service.replace_for_market(
        db,
        market,
        body,
        region_code=region,
    )
