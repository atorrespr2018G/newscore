"""Technology page section list routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import technology_page_sections_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.technology_page_sections_schemas import (
    TechnologyPageSectionsOut,
    TechnologyPageSectionsUpdate,
)

router = APIRouter(prefix="/technology-page-sections")


@router.get("", response_model=TechnologyPageSectionsOut)
async def get_technology_page_sections(
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> TechnologyPageSectionsOut:
    """Return the ordered technology section list for a market or state region."""

    return await technology_page_sections_service.get_for_market(
        db,
        market,
        region_code=region,
    )


@router.put("", response_model=TechnologyPageSectionsOut)
async def put_technology_page_sections(
    body: TechnologyPageSectionsUpdate,
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> TechnologyPageSectionsOut:
    """Replace the ordered technology section list and sync the technology page layout."""

    return await technology_page_sections_service.replace_for_market(
        db,
        market,
        body,
        region_code=region,
    )
