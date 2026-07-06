"""GraphQL types for the content federated subgraph."""

from __future__ import annotations

import strawberry
from strawberry.types import Info

from content_subgraph.context import ContentContext
from shared.core.exceptions import NotFoundError
from shared.core.feature_flags import geo_graphql_region_args
from shared.core.markets import DEFAULT_MARKET_CODE
from shared.core.pagination import PaginationParams
from shared.read import article_reads, market_reads, media_reads
from shared.schemas.article_schemas import ArticleDetailOut, ArticleOut


def _market_from_region(region_code: str | None, fallback_market: str) -> str:
    """Map a region code to its top-level market code for compatibility reads."""

    normalized = (region_code or "").strip().lower()
    if not normalized:
        return fallback_market
    return normalized.split("-", 1)[0]


@strawberry.type
class MediaAsset:
    """An image or video attached to an article."""

    id: strawberry.ID
    url: str
    file_type: str
    width: int | None = None
    height: int | None = None


@strawberry.federation.type(keys=["id"])
class Article:
    """Published article entity owned by the content subgraph."""

    id: strawberry.ID
    slug: str | None = None
    title: str | None = None
    status: str | None = None
    author_name: str | None = None
    thumbnail_url: str | None = None
    video_url: str | None = None
    created_at: str | None = None
    published_at: str | None = None
    body: str | None = None
    tags: list[str] | None = None
    category_id: str | None = None
    story_id: str | None = None
    media_ids: list[str] | None = None
    view_count: int | None = None
    # Internal-only: lets the story_updates resolver scope follow-ups to the
    # parent article's market without exposing market ids in the schema.
    market_ids: strawberry.Private[list[str] | None] = None

    @classmethod
    async def resolve_reference(
        cls,
        info: Info[ContentContext],
        id: strawberry.ID,
    ) -> Article:
        """Federation entity resolver for Article references."""

        detail = await article_reads.get_article_by_id(
            info.context.db,
            article_id=str(id),
            loader=info.context.authors,
        )
        if detail is None:
            return Article(id=id)
        return article_from_detail(detail)

    @strawberry.field
    async def media(self, info: Info[ContentContext]) -> list[MediaAsset]:
        """Resolve every media asset attached to the article, in order.

        The article only persists ``media_ids``; this joins them against the
        media collection so the public site can render the full gallery rather
        than just the single ``thumbnail_url``.
        """

        if not self.media_ids:
            return []
        assets = await media_reads.list_media_by_ids(
            info.context.db,
            media_ids=list(self.media_ids),
        )
        return [
            MediaAsset(
                id=strawberry.ID(asset.id),
                url=asset.url,
                file_type=asset.file_type,
                width=asset.width,
                height=asset.height,
            )
            for asset in assets
        ]

    @strawberry.field
    async def story_updates(self, info: Info[ContentContext]) -> list[Article]:
        """Resolve other published articles in the same story, newest-first.

        Returns an empty list for articles that editors have not grouped into a
        story. Follow-ups are scoped to the parent article's first market so the
        list stays consistent with the market the reader is viewing.
        """

        if not self.story_id:
            return []
        market_id = self.market_ids[0] if self.market_ids else None
        updates = await article_reads.list_story_updates(
            info.context.db,
            story_id=self.story_id,
            exclude_id=str(self.id),
            market_id=market_id,
            loader=info.context.authors,
        )
        return [article_from_detail(update) for update in updates]


def article_from_detail(detail: ArticleDetailOut) -> Article:
    """Map ArticleDetailOut to GraphQL Article."""

    return Article(
        id=strawberry.ID(detail.id),
        slug=detail.slug,
        title=detail.title,
        status=detail.status,
        author_name=detail.author_name,
        thumbnail_url=detail.thumbnail_url,
        video_url=detail.video_url,
        created_at=detail.created_at,
        published_at=detail.published_at,
        body=detail.body,
        tags=detail.tags,
        category_id=detail.category_id,
        story_id=detail.story_id,
        media_ids=detail.media_ids,
        view_count=detail.view_count,
        market_ids=detail.market_ids,
    )


def article_from_out(out: ArticleOut) -> Article:
    """Map ArticleOut to GraphQL Article."""

    return Article(
        id=strawberry.ID(out.id),
        slug=out.slug,
        title=out.title,
        status=out.status,
        author_name=out.author_name,
        thumbnail_url=out.thumbnail_url,
        video_url=out.video_url,
        created_at=out.created_at,
        published_at=out.published_at,
        body=None,
        tags=None,
        category_id=None,
        media_ids=None,
        view_count=None,
    )


@strawberry.type
class ArticleConnection:
    """Paginated list of articles."""

    items: list[Article]
    total: int
    page: int
    page_size: int
    has_more: bool


@strawberry.type
class ContentQuery:
    """Root query for the content subgraph."""

    @strawberry.field
    async def article_by_slug(
        self,
        info: Info[ContentContext],
        slug: str,
        market: str = DEFAULT_MARKET_CODE,
        region_code: str | None = None,
    ) -> Article | None:
        """Load a published article by slug for a market."""

        requested_market = (
            _market_from_region(region_code, market) if geo_graphql_region_args() else market
        )
        market_doc = await market_reads.get_market_by_code(info.context.db, requested_market)
        market_id = str(market_doc["_id"]) if market_doc else None
        try:
            detail = await article_reads.get_article_by_slug(
                info.context.db,
                slug=slug,
                market_id=market_id,
                loader=info.context.authors,
            )
        except NotFoundError:
            return None
        return article_from_detail(detail)

    @strawberry.field
    async def search_articles(
        self,
        info: Info[ContentContext],
        q: str,
        market: str = DEFAULT_MARKET_CODE,
        region_code: str | None = None,
    ) -> list[Article]:
        """Search published articles for a market."""

        requested_market = (
            _market_from_region(region_code, market) if geo_graphql_region_args() else market
        )
        market_doc = await market_reads.get_market_by_code(info.context.db, requested_market)
        market_id = str(market_doc["_id"]) if market_doc else None
        items = await article_reads.search_published(
            info.context.db,
            query=q,
            market_id=market_id,
            loader=info.context.authors,
        )
        return [article_from_out(i) for i in items]

    @strawberry.field
    async def category_articles(
        self,
        info: Info[ContentContext],
        slug: str,
        page: int,
        page_size: int,
        market: str = DEFAULT_MARKET_CODE,
        region_code: str | None = None,
    ) -> ArticleConnection:
        """List published articles for a category in a market."""

        requested_market = (
            _market_from_region(region_code, market) if geo_graphql_region_args() else market
        )
        market_doc = await market_reads.get_market_by_code(info.context.db, requested_market)
        market_id = str(market_doc["_id"]) if market_doc else None
        result = await article_reads.list_category_articles(
            info.context.db,
            category_slug=slug,
            params=PaginationParams(page=page, page_size=page_size),
            market_id=market_id,
            loader=info.context.authors,
        )
        items = [article_from_out(ArticleOut(**raw)) for raw in result.items]
        return ArticleConnection(
            items=items,
            total=result.total,
            page=result.page,
            page_size=result.page_size,
            has_more=result.has_more,
        )
