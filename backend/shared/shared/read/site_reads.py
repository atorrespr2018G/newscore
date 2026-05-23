"""Site-level read aggregations (homepage feed, breaking)."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.markets import DEFAULT_MARKET_CODE
from shared.read.article_reads import article_out, list_published_by_ids
from shared.read.collections import ARTICLES_COLLECTION, WIDGETS_COLLECTION
from shared.read.layout_reads import get_active_homepage_layout
from shared.read.loaders import AuthorNameLoader
from shared.read.market_reads import get_market_by_code
from shared.schemas.article_schemas import ArticleOut


def _article_market_query(market_id: str, town: str | None = None) -> dict[str, Any]:
    """Mongo filter ensuring articles belong to the active market (and optional town)."""

    q: dict[str, Any] = {"status": "published", "market_ids": market_id}
    if town:
        q["town_id"] = town.strip()
    return q


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
) -> dict[str, Any]:
    """Assemble homepage feed from active layout slots for a market."""

    market = await get_market_by_code(db, market_code)
    if market is None:
        return {"layout_id": None, "page_name": "homepage", "market_code": market_code, "slots": []}

    market_id = str(market["_id"])
    layout = await get_active_homepage_layout(db, market_code=market_code)
    if layout is None:
        return {"layout_id": None, "page_name": "homepage", "market_code": market_code, "slots": []}

    loader = AuthorNameLoader(db)
    out_slots: list[dict[str, Any]] = []
    base_query = _article_market_query(market_id, town)

    for slot in layout["slots"]:
        content_type = slot["content_type"]
        pinned_ids = slot["pinned_ids"]
        query_rule = slot["query_rule"]
        articles: list[ArticleOut] = []

        if content_type == "articles":
            if pinned_ids:
                articles = await list_published_by_ids(
                    db,
                    article_ids=pinned_ids,
                    loader=loader,
                    market_id=market_id,
                    town=town,
                )
            elif isinstance(query_rule, dict):
                limit = int(query_rule.get("limit") or 10)
                q: dict[str, Any] = dict(base_query)
                category_id = query_rule.get("category_id")
                if category_id:
                    q["category_id"] = category_id
                cursor = db[ARTICLES_COLLECTION].find(q).sort("published_at", -1).limit(limit)
                docs = [d async for d in cursor]
                await loader.load_many([str(d["author_id"]) for d in docs])
                for doc in docs:
                    author = await loader.load(str(doc["author_id"]))
                    articles.append(article_out(doc, author_name=author))

        out_slots.append(
            {
                "id": slot["id"],
                "position_key": slot["position_key"],
                "display_name": slot.get("display_name"),
                "presentation_type": slot.get("presentation_type") or "grid_4",
                "content_type": content_type,
                "articles": [a.model_dump() for a in articles],
            }
        )

    return {
        "layout_id": layout["layout_id"],
        "page_name": layout["page_name"],
        "market_code": market_code,
        "slots": out_slots,
    }
