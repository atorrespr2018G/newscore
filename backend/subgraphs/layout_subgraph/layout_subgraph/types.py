"""GraphQL types for the layout federated subgraph."""

from __future__ import annotations

import strawberry
from strawberry.types import Info

from shared.core.markets import DEFAULT_MARKET_CODE
from shared.read import layout_reads

from layout_subgraph.context import LayoutContext


@strawberry.federation.type(keys=["id"])
class Slot:
    """Layout slot entity."""

    id: strawberry.ID
    position_key: str
    content_type: str
    pinned_article_ids: list[strawberry.ID]


@strawberry.type
class Layout:
    """Page layout with ordered slots."""

    id: strawberry.ID
    page_name: str
    slots: list[Slot]


@strawberry.type
class LayoutQuery:
    """Root query for the layout subgraph."""

    @strawberry.field
    async def active_homepage_layout(
        self,
        info: Info[LayoutContext],
        market: str = DEFAULT_MARKET_CODE,
    ) -> Layout | None:
        """Return the active homepage layout and slot metadata for a market."""

        layout = await layout_reads.get_active_homepage_layout(info.context.db, market_code=market)
        if layout is None:
            return None

        slots = [
            Slot(
                id=strawberry.ID(s["id"]),
                position_key=str(s.get("position_key") or ""),
                content_type=s["content_type"],
                pinned_article_ids=[strawberry.ID(aid) for aid in s["pinned_ids"]],
            )
            for s in layout["slots"]
        ]
        return Layout(
            id=strawberry.ID(layout["layout_id"]),
            page_name=layout["page_name"],
            slots=slots,
        )
