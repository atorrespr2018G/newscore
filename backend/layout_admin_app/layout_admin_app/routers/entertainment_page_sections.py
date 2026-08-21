"""Entertainment page section list routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import entertainment_page_sections_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.entertainment_page_sections_schemas import (
    EntertainmentPageSectionsOut,
    EntertainmentPageSectionsUpdate,
)

router = APIRouter(prefix="/entertainment-page-sections")


@router.get("", response_model=EntertainmentPageSectionsOut)
async def get_entertainment_page_sections(
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> EntertainmentPageSectionsOut:
    """Return the ordered entertainment section list for a market or state region."""

    return await entertainment_page_sections_service.get_for_market(
        db,
        market,
        region_code=region,
    )


@router.put("", response_model=EntertainmentPageSectionsOut)
async def put_entertainment_page_sections(
    body: EntertainmentPageSectionsUpdate,
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> EntertainmentPageSectionsOut:
    """Replace the ordered entertainment section list and sync the entertainment page layout."""

    return await entertainment_page_sections_service.replace_for_market(
        db,
        market,
        body,
        region_code=region,
    )
