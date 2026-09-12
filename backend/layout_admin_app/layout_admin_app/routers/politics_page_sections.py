"""Politics page section list routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import politics_page_sections_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.politics_page_sections_schemas import (
    PoliticsPageSectionsOut,
    PoliticsPageSectionsUpdate,
)

router = APIRouter(prefix="/politics-page-sections")


@router.get("", response_model=PoliticsPageSectionsOut)
async def get_politics_page_sections(
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> PoliticsPageSectionsOut:
    """Return the ordered Politics-page section list for a market or geo region."""

    return await politics_page_sections_service.get_for_market(
        db,
        market,
        region_code=region,
    )


@router.put("", response_model=PoliticsPageSectionsOut)
async def put_politics_page_sections(
    body: PoliticsPageSectionsUpdate,
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> PoliticsPageSectionsOut:
    """Replace the ordered Politics-page section list and sync the Politics layout."""

    return await politics_page_sections_service.replace_for_market(
        db,
        market,
        body,
        region_code=region,
    )
