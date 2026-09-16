"""Worldwide article targeting helpers (all markets minus exclusions)."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

MARKETS_COLLECTION = "markets"


async def list_market_ids(db: AsyncIOMotorDatabase) -> list[str]:
    """Return every market document id in stable code order.

    Args:
        db: Database connection.

    Returns:
        Market ids sorted by market code.
    """

    cursor = db[MARKETS_COLLECTION].find({}, {"_id": 1, "code": 1}).sort("code", 1)
    return [str(doc["_id"]) async for doc in cursor]


async def list_markets(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    """Return every market document ordered by code.

    Args:
        db: Database connection.

    Returns:
        Market documents with ``_id``, ``code``, and ``label``.
    """

    cursor = db[MARKETS_COLLECTION].find({}, {"_id": 1, "code": 1, "label": 1}).sort("code", 1)
    return [doc async for doc in cursor]


def normalize_excluded_market_ids(excluded_market_ids: list[str] | None) -> list[str]:
    """De-duplicate and strip exclusion ids while preserving order.

    Args:
        excluded_market_ids: Raw exclusion list from a client payload.

    Returns:
        Normalized market id list.
    """

    normalized: list[str] = []
    for market_id in excluded_market_ids or []:
        clean = str(market_id).strip()
        if clean and clean not in normalized:
            normalized.append(clean)
    return normalized


def effective_market_ids(
    all_market_ids: list[str],
    *,
    excluded_market_ids: list[str] | None,
) -> list[str]:
    """Compute markets that receive a worldwide story.

    Args:
        all_market_ids: Full set of market ids.
        excluded_market_ids: Markets to leave out.

    Returns:
        Market ids in ``all_market_ids`` order after exclusions.
    """

    excluded = set(normalize_excluded_market_ids(excluded_market_ids))
    return [market_id for market_id in all_market_ids if market_id not in excluded]


def market_eligibility_clauses(market_id: str) -> list[dict[str, Any]]:
    """Mongo clauses matching articles eligible for one market.

    Includes explicit ``market_ids`` tags and worldwide stories that do not
    exclude this market.

    Args:
        market_id: Market document id.

    Returns:
        One or more clause dicts suitable for ``$or`` composition.
    """

    mid = str(market_id).strip()
    if not mid:
        return []
    return [
        {"market_ids": mid},
        {
            "worldwide": True,
            "excluded_market_ids": {"$nin": [mid]},
        },
    ]


def market_eligibility_filter(market_id: str) -> dict[str, Any]:
    """Mongo filter for articles eligible in a market (tagged or worldwide).

    Args:
        market_id: Market document id.

    Returns:
        Filter matching tagged or non-excluded worldwide articles.
    """

    clauses = market_eligibility_clauses(market_id)
    if not clauses:
        return {"_id": {"$in": []}}
    if len(clauses) == 1:
        return clauses[0]
    return {"$or": clauses}


def apply_market_eligibility(query: dict[str, Any], market_id: str) -> dict[str, Any]:
    """Merge market eligibility into an existing article query.

    Uses ``$and`` when either side already contains boolean operators so
    category ``$or`` clauses are preserved.

    Args:
        query: Existing Mongo query.
        market_id: Market document id.

    Returns:
        Combined query document.
    """

    eligibility = market_eligibility_filter(market_id)
    if any(key.startswith("$") for key in query) or any(
        key.startswith("$") for key in eligibility
    ):
        return {"$and": [query, eligibility]}
    merged = dict(query)
    merged.update(eligibility)
    return merged
