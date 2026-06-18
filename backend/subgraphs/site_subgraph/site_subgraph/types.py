"""GraphQL types for the site federated subgraph."""

from __future__ import annotations

import json
from typing import Any

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from shared.core.cache import get_json, set_json
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.read import site_reads

from site_subgraph.constants import HOMEPAGE_FEED_TTL_SECONDS, homepage_feed_cache_key
from site_subgraph.context import SiteContext


@strawberry.federation.type(keys=["id"], extend=True)
class Article:
    """Article entity extended from the content subgraph."""

    id: strawberry.ID = strawberry.federation.field(external=True)


@strawberry.type
class HomepageSlot:
    """Homepage slot with federated article references."""

    id: strawberry.ID
    position_key: str
    display_name: str | None
    presentation_type: str
    content_type: str
    articles: list[Article]


@strawberry.type
class HomepageFeed:
    """Homepage feed for the public site."""

    layout_id: strawberry.ID | None
    page_name: str
    slots: list[HomepageSlot]


def _feed_from_cache(raw: dict[str, Any]) -> HomepageFeed:
    """Map cached feed JSON to GraphQL types."""

    slots: list[HomepageSlot] = []
    for slot in raw.get("slots") or []:
        articles = [Article(id=strawberry.ID(a["id"])) for a in slot.get("articles") or []]
        slots.append(
            HomepageSlot(
                id=strawberry.ID(slot["id"]),
                position_key=str(slot.get("position_key") or ""),
                display_name=slot.get("display_name"),
                presentation_type=str(slot.get("presentation_type") or "grid_4"),
                content_type=str(slot.get("content_type") or ""),
                articles=articles,
            )
        )
    layout_id = raw.get("layout_id")
    return HomepageFeed(
        layout_id=strawberry.ID(layout_id) if layout_id else None,
        page_name=str(raw.get("page_name") or "homepage"),
        slots=slots,
    )


@strawberry.type
class SiteQuery:
    """Root query for the site subgraph."""

    @strawberry.field
    async def homepage_feed(
        self,
        info: Info[SiteContext],
        market: str = DEFAULT_MARKET_CODE,
        town: str | None = None,
        page_name: str = "homepage",
    ) -> HomepageFeed:
        """Return a page feed for a market (Redis-cached)."""

        normalized_page = page_name.strip().lower() or "homepage"
        cache_key = homepage_feed_cache_key(market, town, page_name=normalized_page)
        cached = await get_json(cache_key)
        if cached is not None:
            return _feed_from_cache(cached)

        raw = await site_reads.get_home_feed(
            info.context.db,
            market_code=market,
            town=town,
            page_name=normalized_page,
        )
        await set_json(key=cache_key, value=raw, ttl_seconds=HOMEPAGE_FEED_TTL_SECONDS)
        return _feed_from_cache(raw)

    @strawberry.field
    async def breaking_news(
        self,
        info: Info[SiteContext],
        market: str = DEFAULT_MARKET_CODE,
    ) -> JSON | None:
        """Return breaking news widget payload for a market."""

        payload = await site_reads.get_breaking(info.context.db, market_code=market)
        if payload is None:
            return None
        return json.loads(json.dumps(payload))
