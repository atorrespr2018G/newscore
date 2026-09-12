"""Business page section list routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import business_page_sections_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.business_page_sections_schemas import (
    BusinessPageSectionsOut,
    BusinessPageSectionsUpdate,
)

router = APIRouter(prefix="/business-page-sections")


@router.get("", response_model=BusinessPageSectionsOut)
async def get_business_page_sections(
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> BusinessPageSectionsOut:
    """Return the ordered business section list for a market or state region."""

    return await business_page_sections_service.get_for_market(
        db,
        market,
        region_code=region,
    )


@router.put("", response_model=BusinessPageSectionsOut)
async def put_business_page_sections(
    body: BusinessPageSectionsUpdate,
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> BusinessPageSectionsOut:
    """Replace the ordered business section list and sync the business page layout."""

    return await business_page_sections_service.replace_for_market(
        db,
        market,
        body,
        region_code=region,
    )
