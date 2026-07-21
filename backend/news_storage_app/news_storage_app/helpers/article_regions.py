"""Region dual-write helpers for article create/update flows."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.feature_flags import geo_dual_write_enabled
from shared.core.regions import effective_region_ids, get_region_by_code, resolve_region_ref_ids

MARKETS_COLLECTION = "markets"


async def _region_ids_from_market_ids(
    db: AsyncIOMotorDatabase,
    market_ids: list[str],
) -> list[str]:
    """Map market ids to sibling top-level region ids when present."""

    if not market_ids:
        return []
    cursor = db[MARKETS_COLLECTION].find({"_id": {"$in": market_ids}}, {"code": 1})
    region_ids: list[str] = []
    async for market in cursor:
        code = str(market.get("code") or "").strip().lower()
        if not code:
            continue
        region = await get_region_by_code(db, code)
        if region is not None:
            region_ids.append(str(region["_id"]))
    return region_ids


async def compute_create_region_fields(
    db: AsyncIOMotorDatabase,
    *,
    payload: Any,
    market_ids: list[str],
) -> dict[str, Any]:
    """Return region fields for new article when dual-write is enabled."""

    if not geo_dual_write_enabled():
        return {}

    direct_region_ids = await resolve_region_ref_ids(
        db,
        list(payload.direct_region_ids or []),
    )
    if not direct_region_ids:
        direct_region_ids = await _region_ids_from_market_ids(db, market_ids)

    visibility_mode = str(payload.region_visibility_mode or "upward_only")
    return {
        "direct_region_ids": direct_region_ids,
        "effective_region_ids": await effective_region_ids(
            db,
            direct_region_ids=direct_region_ids,
            visibility_mode=visibility_mode,
        ),
        "region_visibility_mode": visibility_mode,
        "primary_region_id": payload.primary_region_id,
    }


async def apply_update_region_fields(
    db: AsyncIOMotorDatabase,
    *,
    existing: dict[str, Any],
    update_doc: dict[str, Any],
) -> None:
    """Mutate update doc with region fields when dual-write is enabled."""

    if not geo_dual_write_enabled():
        return

    if "direct_region_ids" not in update_doc and "market_ids" in update_doc:
        update_doc["direct_region_ids"] = await _region_ids_from_market_ids(
            db,
            list(update_doc.get("market_ids") or []),
        )

    raw_direct = list(
        update_doc.get("direct_region_ids")
        if "direct_region_ids" in update_doc
        else existing.get("direct_region_ids") or []
    )
    direct_region_ids = await resolve_region_ref_ids(db, raw_direct)
    if "direct_region_ids" in update_doc:
        update_doc["direct_region_ids"] = direct_region_ids
    visibility_mode = str(
        update_doc.get("region_visibility_mode")
        if "region_visibility_mode" in update_doc
        else existing.get("region_visibility_mode") or "upward_only"
    )
    if direct_region_ids:
        update_doc["effective_region_ids"] = await effective_region_ids(
            db,
            direct_region_ids=direct_region_ids,
            visibility_mode=visibility_mode,
        )
