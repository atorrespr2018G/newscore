"""Health page section list routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import health_page_sections_service
from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.schemas.health_page_sections_schemas import (
    HealthPageSectionsOut,
    HealthPageSectionsUpdate,
)

router = APIRouter(prefix="/health-page-sections")


@router.get("", response_model=HealthPageSectionsOut)
async def get_health_page_sections(
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> HealthPageSectionsOut:
    """Return the ordered health section list for a market or state region."""

    return await health_page_sections_service.get_for_market(
        db,
        market,
        region_code=region,
    )


@router.put("", response_model=HealthPageSectionsOut)
async def put_health_page_sections(
    body: HealthPageSectionsUpdate,
    market: str = Query(DEFAULT_MARKET_CODE),
    region: str | None = Query(None, description="Region code such as us-fl"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin")),
) -> HealthPageSectionsOut:
    """Replace the ordered health section list and sync the health page layout."""

    return await health_page_sections_service.replace_for_market(
        db,
        market,
        body,
        region_code=region,
    )
