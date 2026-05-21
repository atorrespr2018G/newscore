"""Site-level read aggregations (homepage feed, breaking)."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.read.article_reads import article_out, list_published_by_ids
from shared.read.collections import ARTICLES_COLLECTION, WIDGETS_COLLECTION
from shared.read.loaders import AuthorNameLoader
from shared.schemas.article_schemas import ArticleOut


async def get_breaking(db: AsyncIOMotorDatabase) -> dict[str, Any] | None:
    """Load breaking news widget configuration."""

    return await db[WIDGETS_COLLECTION].find_one({"_id": "breaking"}, {"_id": 0})


async def get_home_feed(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    """Assemble homepage feed from active homepage layout slots."""

    from shared.read.layout_reads import get_active_homepage_layout

    layout = await get_active_homepage_layout(db)
    if layout is None:
        return {"layout_id": None, "page_name": "homepage", "slots": []}

    loader = AuthorNameLoader(db)
    out_slots: list[dict[str, Any]] = []

    for slot in layout["slots"]:
        content_type = slot["content_type"]
        pinned_ids = slot["pinned_ids"]
        query_rule = slot["query_rule"]
        articles: list[ArticleOut] = []

        if content_type == "articles":
            if pinned_ids:
                articles = await list_published_by_ids(db, article_ids=pinned_ids, loader=loader)
            elif isinstance(query_rule, dict):
                limit = int(query_rule.get("limit") or 10)
                category_id = query_rule.get("category_id")
                q: dict[str, Any] = {"status": "published"}
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
                "content_type": content_type,
                "articles": [a.model_dump() for a in articles],
            }
        )

    return {
        "layout_id": layout["layout_id"],
        "page_name": layout["page_name"],
        "slots": out_slots,
    }
