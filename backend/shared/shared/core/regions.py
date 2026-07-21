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


def market_scope_region_ids_from_chain(region_chain: list[dict[str, Any]]) -> list[str]:
    """Return placement scope ids from the active region through its country.

    Editors may place any story tagged within the same country/market into sibling
    state, county, or town category slots (for example Florida Politics into
    Texas Politics when both belong to the USA).

    Args:
        region_chain: Region documents ordered self -> root from ``get_ancestor_chain``.

    Returns:
        De-duplicated region ids from the active node through its country ancestor.
    """

    scope_ids: list[str] = []
    seen: set[str] = set()
    for doc in region_chain:
        region_id = str(doc.get("_id") or "").strip()
        if not region_id or region_id in seen:
            continue
        seen.add(region_id)
        scope_ids.append(region_id)
        if doc.get("kind") == "country":
            break
    return scope_ids


async def resolve_region_ref_ids(
    db: AsyncIOMotorDatabase,
    region_refs: list[str],
) -> list[str]:
    """Resolve region document ids or region codes into document ids.

    Reporter/editor clients often send region codes (for example ``pr-villalba``)
    in ``direct_region_ids``. Ancestor expansion requires document ids.

    Args:
        db: Database connection.
        region_refs: Region document ids and/or region codes.

    Returns:
        De-duplicated region document ids. Unresolvable refs are kept as-is so
        existing code-tagged articles remain queryable.
    """

    unique_refs: list[str] = []
    seen: set[str] = set()
    for ref in region_refs:
        normalized = str(ref).strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            unique_refs.append(normalized)
    if not unique_refs:
        return []

    by_id = db[REGIONS_COLLECTION].find(
        {"_id": {"$in": unique_refs}, "is_active": True},
        {"_id": 1},
    )
    resolved_ids = {str(doc["_id"]) async for doc in by_id}
    unresolved = [ref for ref in unique_refs if ref not in resolved_ids]
    if unresolved:
        by_code = db[REGIONS_COLLECTION].find(
            {"code": {"$in": [_norm_code(ref) for ref in unresolved]}, "is_active": True},
            {"_id": 1, "code": 1},
        )
        code_to_id = {
            _norm_code(str(doc.get("code") or "")): str(doc["_id"])
            async for doc in by_code
        }
        for ref in unresolved:
            mapped = code_to_id.get(_norm_code(ref))
            if mapped:
                resolved_ids.add(mapped)
            else:
                resolved_ids.add(ref)
    return list(resolved_ids)


async def region_ids_under_same_country(
    db: AsyncIOMotorDatabase,
    region_id: str,
) -> list[str]:
    """Return every region id/code under the same country as ``region_id``.

    Used so town stories (Villalba) are eligible on country placements (PR) and
    sibling state/town placements within that country.

    Args:
        db: Database connection.
        region_id: Active region document id.

    Returns:
        Region document ids and codes for the country subtree (including country).
    """

    chain = await get_ancestor_chain(db, region_id)
    if not chain:
        return [region_id]

    country = next((doc for doc in chain if doc.get("kind") == "country"), None)
    root = country if country is not None else chain[0]
    root_id = str(root["_id"])

    cursor = db[REGIONS_COLLECTION].find(
        {
            "is_active": True,
            "$or": [{"_id": root_id}, {"ancestor_ids": root_id}],
        },
        {"_id": 1, "code": 1},
    )
    scope_values: list[str] = []
    seen: set[str] = set()
    async for doc in cursor:
        for value in (str(doc["_id"]), _norm_code(str(doc.get("code") or ""))):
            if value and value not in seen:
                seen.add(value)
                scope_values.append(value)
    return scope_values


def region_scope_article_filter(
    scope_ids: list[str],
    *,
    market_id: str | None = None,
) -> dict[str, Any]:
    """Build a Mongo filter for articles eligible in a region's editorial scope.

    Matches any story whose direct or effective region tags fall within the same
    country/market scope as the active placement region, including sibling states,
    counties, or towns under that country. Also matches legacy articles tagged only
    with ``market_ids`` (for example Villalba stories with ``town_id`` but no region
    fields) so they remain placeable on PR country Politics.

    Args:
        scope_ids: Region ids and/or codes under the active country scope.
        market_id: Optional market id for legacy same-country articles.

    Returns:
        MongoDB ``$or`` filter for region-scoped article reads.
    """

    unique_scope = [
        str(region_id).strip()
        for region_id in dict.fromkeys(scope_ids)
        if str(region_id).strip()
    ]
    clauses: list[dict[str, Any]] = []
    if unique_scope:
        clauses.append({"effective_region_ids": {"$in": unique_scope}})
        clauses.append({"direct_region_ids": {"$in": unique_scope}})
    if market_id and str(market_id).strip():
        clauses.append({"market_ids": str(market_id).strip()})
    if not clauses:
        return {"_id": {"$in": []}}
    if len(clauses) == 1:
        return clauses[0]
    return {"$or": clauses}


def legacy_market_scope_article_filter(
    market_id: str,
    *,
    town: str | None = None,
) -> dict[str, Any]:
    """Build a legacy market filter for editorial placement scope.

    Any story in the same market/country is eligible for category placements in
    that market, including town↔country and sibling localities.

    Args:
        market_id: Market document id.
        town: Unused; retained for call-site compatibility.

    Returns:
        MongoDB filter fields for legacy market-scoped article reads.
    """

    _ = town
    return {"market_ids": market_id}


async def effective_region_ids(
    db: AsyncIOMotorDatabase,
    *,
    direct_region_ids: list[str],
    visibility_mode: str,
) -> list[str]:
    """Compute effective visibility ids for region-based article reads."""

    unique_direct = await resolve_region_ref_ids(db, direct_region_ids)
    if not unique_direct:
        return []

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
