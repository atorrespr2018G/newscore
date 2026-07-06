"""Site-level read aggregations (homepage feed, breaking)."""

from __future__ import annotations

from typing import Any, Awaitable, Callable, List

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.feature_flags import geo_read_from_regions
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.core.regions import get_region_by_code, resolve_region_code_from_legacy
from shared.read.article_reads import article_out, list_by_ids_for_preview, list_published_by_ids
from shared.read.collections import ARTICLES_COLLECTION, WIDGETS_COLLECTION
from shared.read.layout_reads import get_active_layout
from shared.read.loaders import AuthorNameLoader
from shared.read.market_reads import get_market_by_code
from shared.read.slot_pinned_ids import slot_with_preview_pins
from shared.schemas.article_schemas import ArticleOut

DEFAULT_QUERY_RULE_LIMIT = 10


def _compact_pinned_ids(pinned_ids: list[str]) -> list[str]:
    """Drop empty placeholders while preserving pinned article order."""

    return [article_id for article_id in pinned_ids if article_id and str(article_id).strip()]


def _query_rule_limit(query_rule: dict[str, Any]) -> int:
    """Resolve a safe article limit for a slot query rule."""

    return max(1, int(query_rule.get("limit") or DEFAULT_QUERY_RULE_LIMIT))


def _merge_slot_articles(
    pinned_articles: list[ArticleOut],
    query_articles: list[ArticleOut],
    limit: int,
) -> list[ArticleOut]:
    """Merge pinned-first articles with query-fill articles up to a slot limit."""

    if limit <= 0:
        return []
    merged = list(pinned_articles)
    used_ids = {article.id for article in pinned_articles}
    for article in query_articles:
        if article.id in used_ids:
            continue
        merged.append(article)
        used_ids.add(article.id)
        if len(merged) >= limit:
            break
    return merged[:limit]


def _article_scope_query(
    market_id: str | None,
    *,
    town: str | None = None,
    region_id: str | None = None,
) -> dict[str, Any]:
    """Mongo filter for either region-scoped or legacy market-scoped reads."""

    if geo_read_from_regions() and region_id:
        return {
            "status": "published",
            "effective_region_ids": region_id,
        }

    if not market_id:
        return {"status": "published", "_id": {"$in": []}}

    q: dict[str, Any] = {"status": "published", "market_ids": market_id}
    if town:
        q["town_id"] = town.strip()
    else:
        q["$or"] = [{"town_id": None}, {"town_id": {"$exists": False}}]
    return q


def _empty_feed(
    *,
    page_name: str,
    market_code: str,
    region_code: str | None = None,
) -> dict[str, Any]:
    """Build an empty feed payload."""

    return {
        "layout_id": None,
        "page_name": page_name,
        "market_code": market_code,
        "region_code": region_code,
        "slots": [],
    }


PinnedLoader = Callable[..., Awaitable[List[ArticleOut]]]


async def _load_pinned_articles(
    db: AsyncIOMotorDatabase,
    *,
    pinned_ids: list[str],
    market_id: str | None,
    town: str | None,
    loader: AuthorNameLoader,
    pinned_loader: PinnedLoader,
) -> list[ArticleOut]:
    """Resolve pinned article ids via the supplied loader."""

    if not pinned_ids:
        return []
    return await pinned_loader(
        db,
        article_ids=pinned_ids,
        loader=loader,
        market_id=market_id,
        town=town,
        require_market=False,
    )


async def _resolve_slot_articles_with_pinned_loader(
    db: AsyncIOMotorDatabase,
    *,
    slot: dict[str, Any],
    market_id: str | None,
    town: str | None,
    base_query: dict[str, Any],
    loader: AuthorNameLoader,
    pinned_loader: PinnedLoader,
) -> list[ArticleOut]:
    """Resolve slot articles with pinned-first and query-fill semantics."""

    if slot["content_type"] != "articles":
        return []

    pinned_ids = _compact_pinned_ids(list(slot.get("pinned_ids") or []))
    query_rule = slot.get("query_rule")

    pinned_articles = await _load_pinned_articles(
        db,
        pinned_ids=pinned_ids,
        market_id=market_id,
        town=town,
        loader=loader,
        pinned_loader=pinned_loader,
    )

    if not isinstance(query_rule, dict):
        return pinned_articles

    limit = _query_rule_limit(query_rule)
    if len(pinned_articles) >= limit:
        return pinned_articles[:limit]

    query_articles = await _query_rule_articles(
        db,
        query_rule=query_rule,
        base_query=base_query,
        loader=loader,
        limit=limit,
        excluded_ids={article.id for article in pinned_articles},
    )
    return _merge_slot_articles(pinned_articles, query_articles, limit)


async def _resolve_slot_articles(
    db: AsyncIOMotorDatabase,
    *,
    slot: dict[str, Any],
    market_id: str | None,
    town: str | None,
    base_query: dict[str, Any],
    loader: AuthorNameLoader,
) -> list[ArticleOut]:
    """Resolve slot articles using published-only pinned ids."""

    return await _resolve_slot_articles_with_pinned_loader(
        db,
        slot=slot,
        market_id=market_id,
        town=town,
        base_query=base_query,
        loader=loader,
        pinned_loader=list_published_by_ids,
    )


async def _resolve_slot_articles_preview(
    db: AsyncIOMotorDatabase,
    *,
    slot: dict[str, Any],
    market_id: str | None,
    town: str | None,
    base_query: dict[str, Any],
    loader: AuthorNameLoader,
) -> list[ArticleOut]:
    """Resolve slot articles with draft-inclusive pinned ids and published query-fill."""

    return await _resolve_slot_articles_with_pinned_loader(
        db,
        slot=slot,
        market_id=market_id,
        town=town,
        base_query=base_query,
        loader=loader,
        pinned_loader=list_by_ids_for_preview,
    )


async def _query_rule_articles(
    db: AsyncIOMotorDatabase,
    *,
    query_rule: dict[str, Any],
    base_query: dict[str, Any],
    loader: AuthorNameLoader,
    limit: int | None = None,
    excluded_ids: set[str] | None = None,
) -> list[ArticleOut]:
    """Resolve slot articles from a query-rule specification."""

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
    docs = [doc async for doc in cursor]
    await loader.load_many([str(doc["author_id"]) for doc in docs])
    return [article_out(doc, author_name=await loader.load(str(doc["author_id"]))) for doc in docs]


def _slot_to_feed_slot(slot: dict[str, Any], articles: list[ArticleOut]) -> dict[str, Any]:
    """Serialize a layout slot and resolved article DTOs."""

    return {
        "id": slot["id"],
        "position_key": slot["position_key"],
        "display_name": slot.get("display_name"),
        "presentation_type": slot.get("presentation_type") or "grid_4",
        "content_type": slot["content_type"],
        "articles": [article.model_dump() for article in articles],
    }


async def get_breaking(db: AsyncIOMotorDatabase, *, market_code: str = DEFAULT_MARKET_CODE) -> dict[str, Any] | None:
    """Load breaking news widget for a market."""

    normalized = market_code.strip().lower() or DEFAULT_MARKET_CODE
    widget_id = f"breaking:{normalized}"
    doc = await db[WIDGETS_COLLECTION].find_one({"_id": widget_id}, {"_id": 0})
    if doc is not None:
        return doc
    return await db[WIDGETS_COLLECTION].find_one({"_id": "breaking"}, {"_id": 0})


async def get_home_feed(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str = DEFAULT_MARKET_CODE,
    town: str | None = None,
    region_code: str | None = None,
    page_name: str = "homepage",
) -> dict[str, Any]:
    """Assemble a page feed from active layout slots for a market."""

    normalized_page = page_name.strip().lower() or "homepage"
    normalized_region_code = (region_code or "").strip().lower() or None
    requested_region_code = normalized_region_code
    region_id: str | None = None

    if geo_read_from_regions():
        if not requested_region_code:
            requested_region_code = await resolve_region_code_from_legacy(
                db,
                market_code=market_code,
                town=town,
            )
        if requested_region_code:
            region_doc = await get_region_by_code(db, requested_region_code)
            if region_doc is not None:
                region_id = str(region_doc["_id"])

    market = await get_market_by_code(db, market_code)
    if market is None:
        return _empty_feed(
            page_name=normalized_page,
            market_code=market_code,
            region_code=requested_region_code,
        )

    market_id = str(market["_id"])
    layout = await get_active_layout(
        db,
        market_id=market_id,
        region_id=region_id,
        page_name=normalized_page,
    )
    if layout is None:
        return _empty_feed(
            page_name=normalized_page,
            market_code=market_code,
            region_code=requested_region_code,
        )

    loader = AuthorNameLoader(db)
    base_query = _article_scope_query(market_id, town=town, region_id=region_id)
    out_slots = [
        _slot_to_feed_slot(
            slot,
            await _resolve_slot_articles(
                db,
                slot=slot,
                market_id=market_id,
                town=town,
                base_query=base_query,
                loader=loader,
            ),
        )
        for slot in layout["slots"]
    ]

    return {
        "layout_id": layout["layout_id"],
        "page_name": layout["page_name"],
        "market_code": market_code,
        "region_code": requested_region_code,
        "slots": out_slots,
    }


async def get_home_feed_preview(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str = DEFAULT_MARKET_CODE,
    town: str | None = None,
    region_code: str | None = None,
    page_name: str = "homepage",
) -> dict[str, Any]:
    """Assemble a page feed preview with draft pins resolved (no Redis cache)."""

    normalized_page = page_name.strip().lower() or "homepage"
    normalized_region_code = (region_code or "").strip().lower() or None
    requested_region_code = normalized_region_code
    region_id: str | None = None

    if geo_read_from_regions():
        if not requested_region_code:
            requested_region_code = await resolve_region_code_from_legacy(
                db,
                market_code=market_code,
                town=town,
            )
        if requested_region_code:
            region_doc = await get_region_by_code(db, requested_region_code)
            if region_doc is not None:
                region_id = str(region_doc["_id"])

    market = await get_market_by_code(db, market_code)
    if market is None:
        return _empty_feed(
            page_name=normalized_page,
            market_code=market_code,
            region_code=requested_region_code,
        )

    market_id = str(market["_id"])
    layout = await get_active_layout(
        db,
        market_id=market_id,
        region_id=region_id,
        page_name=normalized_page,
    )
    if layout is None:
        return _empty_feed(
            page_name=normalized_page,
            market_code=market_code,
            region_code=requested_region_code,
        )

    loader = AuthorNameLoader(db)
    base_query = _article_scope_query(market_id, town=town, region_id=region_id)
    out_slots = [
        _slot_to_feed_slot(
            slot,
            await _resolve_slot_articles_preview(
                db,
                slot=slot_with_preview_pins(slot),
                market_id=market_id,
                town=town,
                base_query=base_query,
                loader=loader,
            ),
        )
        for slot in layout["slots"]
    ]

    return {
        "layout_id": layout["layout_id"],
        "page_name": layout["page_name"],
        "market_code": market_code,
        "region_code": requested_region_code,
        "slots": out_slots,
    }
