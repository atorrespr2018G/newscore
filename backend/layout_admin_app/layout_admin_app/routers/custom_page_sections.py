"""Custom page section list routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import custom_page_sections_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.custom_page_sections_schemas import (
    CustomPageSectionsOut,
    CustomPageSectionsUpdate,
)

router = APIRouter(prefix="/custom-page-sections")


@router.get("", response_model=CustomPageSectionsOut)
async def get_custom_page_sections(
    page: str = Query(..., description="Custom tab slug / page name"),
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> CustomPageSectionsOut:
    """Return the ordered custom section list for a tab and geo scope."""

    return await custom_page_sections_service.get_for_page(
        db,
        page,
        market,
        region_code=region,
    )


@router.put("", response_model=CustomPageSectionsOut)
async def put_custom_page_sections(
    body: CustomPageSectionsUpdate,
    page: str = Query(..., description="Custom tab slug / page name"),
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> CustomPageSectionsOut:
    """Replace the ordered custom section list and sync the page layout."""

    return await custom_page_sections_service.replace_for_page(
        db,
        page,
        market,
        body,
        region_code=region,
    )
