"""Workflow badge logic for the layout admin app (placement tab)."""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import NotFoundError
from shared.core.placement_events import count_new_placements
from shared.core.view_state import VIEW_PLACEMENT, get_last_seen
from shared.read.market_reads import get_market_by_code


async def count_new_placements_for_user(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    market_code: str,
) -> int:
    """Count stories placed in a market since the user last opened Placement.

    Args:
        db: Database connection.
        user_id: Authenticated user id.
        market_code: Market short code to scope the count to.

    Returns:
        Number of placement events newer than the user's last-seen timestamp.

    Raises:
        NotFoundError: If the market code does not resolve to a market.
    """

    market = await get_market_by_code(db, market_code)
    if market is None:
        raise NotFoundError("Market not found")

    last_seen = await get_last_seen(db, user_id=user_id, view=VIEW_PLACEMENT)
    return await count_new_placements(db, market_id=str(market["_id"]), since=last_seen)
