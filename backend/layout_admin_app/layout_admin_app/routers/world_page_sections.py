"""World page section list routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import world_page_sections_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.world_page_sections_schemas import (
    WorldPageSectionsOut,
    WorldPageSectionsUpdate,
)

router = APIRouter(prefix="/world-page-sections")


@router.get("", response_model=WorldPageSectionsOut)
async def get_world_page_sections(
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> WorldPageSectionsOut:
    """Return the ordered World-page section list for a market or geo region."""

    return await world_page_sections_service.get_for_market(
        db,
        market,
        region_code=region,
    )


@router.put("", response_model=WorldPageSectionsOut)
async def put_world_page_sections(
    body: WorldPageSectionsUpdate,
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> WorldPageSectionsOut:
    """Replace the ordered World-page section list and sync the World layout."""

    return await world_page_sections_service.replace_for_market(
        db,
        market,
        body,
        region_code=region,
    )
