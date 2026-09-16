"""Market list routes for editorial targeting."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from shared.core.auth import TokenPayload, require_role
from shared.core.db import get_db
from shared.read.market_reads import list_markets

router = APIRouter(prefix="/markets")


class MarketOut(BaseModel):
    """One market edition for admin targeting UIs."""

    id: str
    code: str
    label: str


@router.get("", response_model=list[MarketOut])
async def get_markets(
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: TokenPayload = Depends(require_role("editor", "admin", "reporter")),
) -> list[MarketOut]:
    """List all markets for worldwide targeting and exclusions."""

    docs = await list_markets(db)
    return [
        MarketOut(
            id=str(doc["_id"]),
            code=str(doc.get("code") or ""),
            label=str(doc.get("label") or doc.get("code") or ""),
        )
        for doc in docs
    ]
