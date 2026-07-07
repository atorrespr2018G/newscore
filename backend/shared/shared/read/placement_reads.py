"""Article placement resolution across layout slots."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.markets import DEFAULT_MARKET_CODE
from shared.core.regions import get_region_by_code, resolve_region_code_from_legacy
from shared.read.collections import ARTICLES_COLLECTION
from shared.read.layout_reads import get_active_layout
from shared.read.market_reads import get_market_by_code
from shared.read.slot_pinned_ids import effective_pinned_ids_for_preview
from shared.schemas.layout_schemas import ArticlePlacementOut

DEFAULT_EDITOR_PAGE_NAMES = ("homepage", "world")
DEFAULT_QUERY_RULE_LIMIT = 10


def _compact_pinned_ids(pinned_ids: list[str]) -> list[str]:
    """Drop empty placeholders while preserving pinned article order."""

    return [article_id for article_id in pinned_ids if article_id and str(article_id).strip()]


def _query_rule_limit(query_rule: dict[str, Any]) -> int:
    """Resolve a safe article limit for placement query rules."""

    return max(1, int(query_rule.get("limit") or DEFAULT_QUERY_RULE_LIMIT))


def _merge_article_ids(pinned_ids: list[str], query_ids: list[str], limit: int) -> list[str]:
    """Merge pinned-first ids with query ids without duplicates."""

    merged = list(pinned_ids)
    seen = set(pinned_ids)
    for article_id in query_ids:
        if article_id in seen:
            continue
        merged.append(article_id)
        seen.add(article_id)
        if len(merged) >= limit:
            break
    return merged[:limit]


def _published_market_query(market_id: str) -> dict[str, Any]:
    """Mongo filter for published articles in a market."""

    return {"status": "published", "market_ids": market_id}


def _published_scope_query(market_id: str, region_id: str | None) -> dict[str, Any]:
    """Mongo filter for region-aware (or market fallback) published articles."""

    if region_id:
        return {
            "status": "published",
            "effective_region_ids": region_id,
        }
    return _published_market_query(market_id)


async def _article_ids_for_query_rule(
    db: AsyncIOMotorDatabase,
    *,
    query_rule: dict[str, Any],
    base_query: dict[str, Any],
    limit: int | None = None,
    excluded_ids: set[str] | None = None,
) -> list[str]:
    """Resolve ordered article ids for a slot query rule.

    Args:
        db: Database connection.
        query_rule: Slot query rule payload.
        base_query: Base article filter (market + published).

    Returns:
        Ordered article ids matching the rule.
    """

    query_limit = limit if limit is not None else _query_rule_limit(query_rule)
    query: dict[str, Any] = dict(base_query)
    if excluded_ids:
        query["_id"] = {"$nin": list(excluded_ids)}
    category_id = query_rule.get("category_id")
    if category_id:
        # Match legacy single-category articles plus multi-category articles
        # that include this category in their category_ids list.
        query["$or"] = [{"category_id": category_id}, {"category_ids": category_id}]
    cursor = db[ARTICLES_COLLECTION].find(query).sort("published_at", -1).limit(query_limit)
    return [str(doc["_id"]) async for doc in cursor]


async def _article_ids_for_slot(
    db: AsyncIOMotorDatabase,
    *,
    slot: dict[str, Any],
    base_query: dict[str, Any],
    use_draft_pins: bool = False,
) -> list[str]:
    """Resolve ordered article ids occupying a slot.

    Args:
        db: Database connection.
        slot: Slot document from layout reads.
        base_query: Base article filter (market + published).
        use_draft_pins: When True, resolve staged editor pins instead of live pins.

    Returns:
        Ordered article ids for the slot.
    """

    if slot.get("content_type") != "articles":
        return []

    pinned_ids = _compact_pinned_ids(
        effective_pinned_ids_for_preview(slot)
        if use_draft_pins
        else list(slot.get("pinned_ids") or []),
    )
    query_rule = slot.get("query_rule")
    if not isinstance(query_rule, dict):
        return pinned_ids

    limit = _query_rule_limit(query_rule)
    if len(pinned_ids) >= limit:
        return pinned_ids[:limit]

    query_ids = await _article_ids_for_query_rule(
        db,
        query_rule=query_rule,
        base_query=base_query,
        limit=limit,
        excluded_ids=set(pinned_ids),
    )
    return _merge_article_ids(pinned_ids, query_ids, limit)


async def get_article_placements(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str = DEFAULT_MARKET_CODE,
    town: str | None = None,
    region_code: str | None = None,
    page_names: tuple[str, ...] = DEFAULT_EDITOR_PAGE_NAMES,
) -> dict[str, list[ArticlePlacementOut]]:
    """Resolve homepage/world slot placements for editor staging and review.

    Args:
        db: Database connection.
        market_code: Market code such as `us`.
        page_names: Layout page names to scan.

    Returns:
        Map of article id to all resolved placements.
    """

    market = await get_market_by_code(db, market_code)
    if market is None:
        return {}

    market_id = str(market["_id"])
    requested_region_code = (region_code or "").strip().lower() or None
    if not requested_region_code and town:
        requested_region_code = await resolve_region_code_from_legacy(
            db,
            market_code=market_code,
            town=town,
        )

    region_id: str | None = None
    if requested_region_code:
        region = await get_region_by_code(db, requested_region_code)
        if region is not None:
            region_id = str(region["_id"])

    base_query = _published_scope_query(market_id, region_id)
    placements_by_article: dict[str, list[ArticlePlacementOut]] = defaultdict(list)

    for page_name in page_names:
        layout = await get_active_layout(
            db,
            market_id=market_id,
            region_id=region_id,
            page_name=page_name,
        )
        if layout is None:
            continue

        for slot in layout["slots"]:
            article_ids = await _article_ids_for_slot(
                db,
                slot=slot,
                base_query=base_query,
                use_draft_pins=True,
            )
            if not article_ids:
                continue

            display_name = str(slot.get("display_name") or slot.get("position_key") or page_name)
            position_key = str(slot.get("position_key") or page_name)
            for index, article_id in enumerate(article_ids, start=1):
                placements_by_article[article_id].append(
                    ArticlePlacementOut(
                        page_name=page_name,
                        position_key=position_key,
                        display_name=display_name,
                        position=index,
                    ),
                )

    return dict(placements_by_article)
