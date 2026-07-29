"""Main (homepage) page section list routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import homepage_page_sections_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.homepage_page_sections_schemas import (
    HomepagePageSectionsOut,
    HomepagePageSectionsUpdate,
)

router = APIRouter(prefix="/main-page-sections")


@router.get("", response_model=HomepagePageSectionsOut)
async def get_main_page_sections(
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> HomepagePageSectionsOut:
    """Return the ordered main-page section list for a market or geo region."""

    return await homepage_page_sections_service.get_for_market(
        db,
        market,
        region_code=region,
    )


@router.put("", response_model=HomepagePageSectionsOut)
async def put_main_page_sections(
    body: HomepagePageSectionsUpdate,
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> HomepagePageSectionsOut:
    """Replace the ordered main-page section list and sync the homepage layout."""

    return await homepage_page_sections_service.replace_for_market(
        db,
        market,
        body,
        region_code=region,
    )
