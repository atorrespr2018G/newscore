"""Helpers for region hierarchy reads and effective targeting."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

MARKETS_COLLECTION = "markets"
REGIONS_COLLECTION = "regions"


def _norm_code(value: str | None) -> str:
    return (value or "").strip().lower()


async def get_region_by_code(db: AsyncIOMotorDatabase, region_code: str) -> dict[str, Any] | None:
    """Return an active region by normalized code."""

    code = _norm_code(region_code)
    if not code:
        return None
    return await db[REGIONS_COLLECTION].find_one({"code": code, "is_active": True})


async def get_region_by_id(db: AsyncIOMotorDatabase, region_id: str) -> dict[str, Any] | None:
    """Return an active region by id."""

    return await db[REGIONS_COLLECTION].find_one({"_id": region_id, "is_active": True})


async def get_ancestor_chain(db: AsyncIOMotorDatabase, region_id: str) -> list[dict[str, Any]]:
    """Return region and its ancestors ordered self -> root."""

    region = await db[REGIONS_COLLECTION].find_one({"_id": region_id, "is_active": True})
    if region is None:
        return []
    ancestor_ids = list(region.get("ancestor_ids") or [])
    if not ancestor_ids:
        return [region]
    cursor = db[REGIONS_COLLECTION].find({"_id": {"$in": ancestor_ids}, "is_active": True})
    by_id = {str(doc["_id"]): doc async for doc in cursor}
    ordered = [region]
    for aid in reversed(ancestor_ids):
        doc = by_id.get(str(aid))
        if doc is not None:
            ordered.append(doc)
    return ordered


async def resolve_region_code_from_legacy(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str,
    town: str | None = None,
) -> str | None:
    """Map legacy market/town params to a region code.

    If town is provided, try a town/municipality code under the market country.
    """

    normalized_market = _norm_code(market_code)
    if not normalized_market:
        return None

    market = await db[MARKETS_COLLECTION].find_one({"code": normalized_market}, {"_id": 1, "code": 1})
    if market is None:
        return None

    if town:
        normalized_town = _norm_code(town)
        for candidate in (
            f"{normalized_market}-{normalized_town}",
            f"{normalized_market}-fl-{normalized_town}",
        ):
            region = await get_region_by_code(db, candidate)
            if region is not None:
                return str(region["code"])

    root = await get_region_by_code(db, normalized_market)
    if root is not None:
        return str(root["code"])
    return None


async def effective_region_ids(
    db: AsyncIOMotorDatabase,
    *,
    direct_region_ids: list[str],
    visibility_mode: str,
) -> list[str]:
    """Compute effective visibility ids for region-based article reads."""

    if not direct_region_ids:
        return []

    unique_direct: list[str] = []
    seen: set[str] = set()
    for region_id in direct_region_ids:
        normalized = str(region_id).strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            unique_direct.append(normalized)

    if visibility_mode == "explicit_only":
        return unique_direct

    cursor = db[REGIONS_COLLECTION].find(
        {"_id": {"$in": unique_direct}},
        {"ancestor_ids": 1},
    )
    all_ids = set(unique_direct)
    async for doc in cursor:
        all_ids.update(str(rid) for rid in (doc.get("ancestor_ids") or []) if str(rid).strip())
    return list(all_ids)


async def resolve_region_codes(db: AsyncIOMotorDatabase, region_ids: list[str]) -> list[str]:
    """Resolve region ids to normalized region codes."""

    if not region_ids:
        return []
    cursor = db[REGIONS_COLLECTION].find({"_id": {"$in": region_ids}}, {"code": 1})
    codes: list[str] = []
    async for doc in cursor:
        code = _norm_code(str(doc.get("code") or ""))
        if code:
            codes.append(code)
    return codes
