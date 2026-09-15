"""Landing page enablement routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import page_visibility_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.page_visibility_schemas import PageVisibilityOut, PageVisibilityUpdate

router = APIRouter(prefix="/page-visibility")


@router.get("", response_model=PageVisibilityOut)
async def get_page_visibility(
    page: str = Query(..., description="Layout page name such as sports"),
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> PageVisibilityOut:
    """Return whether a landing page is enabled at the selected geo."""

    return await page_visibility_service.get_for_scope(
        db,
        market_code=market,
        page_name=page,
        region_code=region,
    )


@router.put("", response_model=PageVisibilityOut)
async def put_page_visibility(
    body: PageVisibilityUpdate,
    page: str = Query(..., description="Layout page name such as sports"),
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> PageVisibilityOut:
    """Enable or disable a landing page at the selected geo.

    Disabling a country hides the page for every nested state, county, and town.
    Disabling a state hides it for that state and its counties. A town or county
    disable applies to that locality only.
    """

    return await page_visibility_service.replace_for_scope(
        db,
        market_code=market,
        page_name=page,
        body=body,
        region_code=region,
    )
