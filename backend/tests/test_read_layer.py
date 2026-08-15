"""Unit tests for shared read layer."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1] / "shared"
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from shared.core.pagination import PaginationParams
from shared.read.article_reads import article_out, get_article_by_slug, list_category_articles
from shared.read.collections import ARTICLES_COLLECTION, CATEGORIES_COLLECTION
from shared.read.placement_reads import _article_ids_for_slot
from shared.read.site_reads import _resolve_slot_articles, _resolve_slot_articles_preview
from shared.read.slot_pinned_ids import effective_pinned_ids_for_preview, slot_with_preview_pins
from shared.schemas.article_schemas import ArticleOut


def test_article_out_maps_document() -> None:
    """article_out maps Mongo fields to ArticleOut."""

    doc = {
        "_id": "abc123",
        "title": "Hello",
        "slug": "hello",
        "status": "published",
        "thumbnail_url": None,
        "created_at": "2026-01-01",
        "published_at": "2026-01-02",
    }
    out = article_out(doc, author_name="Reporter")
    assert out.id == "abc123"
    assert out.slug == "hello"
    assert out.author_name == "Reporter"
    assert out.source == "reporter"
    assert out.source_package_id is None


def test_article_out_maps_media_desk_source() -> None:
    """article_out preserves Media Desk handoff provenance."""

    doc = {
        "_id": "desk1",
        "title": "From desk",
        "slug": "from-desk",
        "status": "draft",
        "thumbnail_url": None,
        "source": "media_desk",
        "source_package_id": "story-9",
        "created_at": "2026-01-01",
        "published_at": None,
    }
    out = article_out(doc, author_name="Editor")
    assert out.source == "media_desk"
    assert out.source_package_id == "story-9"


def _make_article(article_id: str) -> ArticleOut:
    """Create a minimal ArticleOut for read-layer tests."""

    return ArticleOut(
        id=article_id,
        title=f"Title {article_id}",
        slug=f"slug-{article_id}",
        status="published",
        author_name="Reporter",
        thumbnail_url=None,
        video_url=None,
        created_at="2026-01-01T00:00:00+00:00",
        published_at="2026-01-01T00:00:00+00:00",
    )


@pytest.mark.asyncio
async def test_site_slot_resolution_keeps_query_fill_after_pin() -> None:
    """Pinned stories lead while query stories continue filling the slot."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["pin-1"],
        "query_rule": {"limit": 4, "category_id": "cat-1"},
    }
    pinned_result = [_make_article("pin-1")]
    query_result = [_make_article("query-1"), _make_article("query-2")]

    with patch(
        "shared.read.site_reads.list_published_by_ids",
        AsyncMock(return_value=pinned_result),
    ):
        with patch(
            "shared.read.site_reads._query_rule_articles",
            AsyncMock(return_value=query_result),
        ) as query_mock:
            resolved = await _resolve_slot_articles(
                MagicMock(),
                slot=slot,
                market_id="market-1",
                town=None,
                base_queries=[{}],
                loader=MagicMock(),
            )

    assert [article.id for article in resolved] == ["pin-1", "query-1", "query-2"]
    assert query_mock.await_count == 1


@pytest.mark.asyncio
async def test_placement_slot_resolution_merges_pin_and_query_ids() -> None:
    """Placement reads include pinned ids and query-filled ids up to slot limit."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["pin-1"],
        "query_rule": {"limit": 2, "category_id": "cat-1"},
    }

    with patch(
        "shared.read.placement_reads._article_ids_for_query_rule",
        AsyncMock(return_value=["query-1", "query-2"]),
    ):
        article_ids = await _article_ids_for_slot(
            MagicMock(),
            slot=slot,
            base_queries=[{}],
        )

    assert article_ids == ["pin-1", "query-1"]


@pytest.mark.asyncio
async def test_site_slot_resolution_ignores_market_for_pinned_ids() -> None:
    """Pinned editorial ids resolve even when not tagged for the active market."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["pin-1", "pin-2"],
        "query_rule": {"limit": 4},
    }
    pinned_result = [_make_article("pin-1"), _make_article("pin-2")]

    with patch(
        "shared.read.site_reads.list_published_by_ids",
        AsyncMock(return_value=pinned_result),
    ) as pinned_mock:
        with patch(
            "shared.read.site_reads._query_rule_articles",
            AsyncMock(return_value=[]),
        ):
            resolved = await _resolve_slot_articles(
                MagicMock(),
                slot=slot,
                market_id="market-1",
                town=None,
                base_queries=[{}],
                loader=MagicMock(),
            )

    assert [article.id for article in resolved] == ["pin-1", "pin-2"]
    assert pinned_mock.await_args.kwargs["require_market"] is False


@pytest.mark.asyncio
async def test_placement_slot_resolution_ignores_empty_pin_placeholders() -> None:
    """Placement reads compact empty pinned placeholders before resolving ids."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["", "pin-2", "  "],
        "query_rule": {"limit": 3, "category_id": "cat-1"},
    }

    with patch(
        "shared.read.placement_reads._article_ids_for_query_rule",
        AsyncMock(return_value=["query-1"]),
    ):
        article_ids = await _article_ids_for_slot(
            MagicMock(),
            slot=slot,
            base_queries=[{}],
        )

    assert article_ids == ["pin-2", "query-1"]


def _make_draft_article(article_id: str) -> ArticleOut:
    """Create a minimal draft ArticleOut for preview tests."""

    return ArticleOut(
        id=article_id,
        title=f"Draft {article_id}",
        slug=f"draft-{article_id}",
        status="draft",
        author_name="Reporter",
        thumbnail_url=None,
        video_url=None,
        created_at="2026-01-01T00:00:00+00:00",
        published_at=None,
    )


@pytest.mark.asyncio
async def test_preview_slot_resolution_includes_pinned_draft() -> None:
    """Preview resolver returns pinned draft articles."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["draft-1"],
        "query_rule": {"limit": 4},
    }
    preview_result = [_make_draft_article("draft-1")]

    with patch(
        "shared.read.site_reads.list_by_ids_for_preview",
        AsyncMock(return_value=preview_result),
    ):
        with patch(
            "shared.read.site_reads._query_rule_articles",
            AsyncMock(return_value=[]),
        ):
            resolved = await _resolve_slot_articles_preview(
                MagicMock(),
                slot=slot,
                market_id="market-1",
                town=None,
                base_queries=[{}],
                loader=MagicMock(),
            )

    assert [article.id for article in resolved] == ["draft-1"]
    assert resolved[0].status == "draft"


@pytest.mark.asyncio
async def test_published_slot_resolution_excludes_pinned_draft() -> None:
    """Published resolver does not return pinned draft articles."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["draft-1"],
        "query_rule": {"limit": 4, "category_id": "cat-1"},
    }

    with patch(
        "shared.read.site_reads.list_published_by_ids",
        AsyncMock(return_value=[]),
    ):
        with patch(
            "shared.read.site_reads._query_rule_articles",
            AsyncMock(return_value=[_make_article("query-1")]),
        ):
            resolved = await _resolve_slot_articles(
                MagicMock(),
                slot=slot,
                market_id="market-1",
                town=None,
                base_queries=[{}],
                loader=MagicMock(),
            )

    assert [article.id for article in resolved] == ["query-1"]


@pytest.mark.asyncio
async def test_preview_slot_resolution_query_fill_uses_published_only() -> None:
    """Preview resolver still backfills slots with published query articles."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["draft-1"],
        "query_rule": {"limit": 3, "category_id": "cat-1"},
    }
    preview_result = [_make_draft_article("draft-1")]
    query_result = [_make_article("pub-1"), _make_article("pub-2")]

    with patch(
        "shared.read.site_reads.list_by_ids_for_preview",
        AsyncMock(return_value=preview_result),
    ):
        with patch(
            "shared.read.site_reads._query_rule_articles",
            AsyncMock(return_value=query_result),
        ) as query_mock:
            resolved = await _resolve_slot_articles_preview(
                MagicMock(),
                slot=slot,
                market_id="market-1",
                town=None,
                base_queries=[{}],
                loader=MagicMock(),
            )

    assert [article.id for article in resolved] == ["draft-1", "pub-1", "pub-2"]
    assert query_mock.await_count == 1


def test_effective_pinned_ids_for_preview_uses_draft_when_present() -> None:
    """Preview pin resolution prefers staged draft pins over live pins."""

    slot = {
        "pinned_ids": ["live-1"],
        "draft_pinned_ids": ["draft-1"],
    }

    assert effective_pinned_ids_for_preview(slot) == ["draft-1"]


def test_effective_pinned_ids_for_preview_falls_back_to_live_pins() -> None:
    """Preview pin resolution uses live pins when no draft is staged."""

    slot = {
        "pinned_ids": ["live-1"],
    }

    assert effective_pinned_ids_for_preview(slot) == ["live-1"]


def test_slot_with_preview_pins_replaces_live_pins() -> None:
    """Preview slot helper swaps pinned ids without mutating the source slot."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["live-1"],
        "draft_pinned_ids": ["draft-1"],
    }

    preview_slot = slot_with_preview_pins(slot)

    assert slot["pinned_ids"] == ["live-1"]
    assert preview_slot["pinned_ids"] == ["draft-1"]


@pytest.mark.asyncio
async def test_article_ids_for_slot_uses_draft_pins_for_editor() -> None:
    """Editor placement resolution reads staged draft pins instead of live pins."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["live-1"],
        "draft_pinned_ids": ["draft-1"],
    }

    article_ids = await _article_ids_for_slot(
        MagicMock(),
        slot=slot,
        base_queries=[{}],
        use_draft_pins=True,
    )

    assert article_ids == ["draft-1"]


@pytest.mark.asyncio
async def test_query_rule_articles_merges_sparse_region_then_market_fallback() -> None:
    """Region hits below the limit continue into the market fallback query."""

    from shared.read.site_reads import _query_rule_articles

    region_batch = [_make_article("r1")]
    market_batch = [_make_article("m1"), _make_article("m2")]

    with patch(
        "shared.read.site_reads._load_articles_for_scope_query",
        AsyncMock(side_effect=[region_batch, market_batch]),
    ) as load_mock:
        resolved = await _query_rule_articles(
            MagicMock(),
            query_rule={"limit": 3, "category_id": "sports"},
            base_queries=[{"scope": "region"}, {"scope": "market"}],
            loader=MagicMock(),
        )

    assert [article.id for article in resolved] == ["r1", "m1", "m2"]
    assert load_mock.await_count == 2


@pytest.mark.asyncio
async def test_site_slot_resolution_pin_only_skips_uncategorized_fill() -> None:
    """Slots without category_id stay pin-only and do not auto-fill market news."""

    slot = {
        "content_type": "articles",
        "pinned_ids": [],
        "query_rule": {"limit": 12},
    }

    with patch(
        "shared.read.site_reads.list_published_by_ids",
        AsyncMock(return_value=[]),
    ):
        with patch(
            "shared.read.site_reads._query_rule_articles",
            AsyncMock(return_value=[_make_article("leak-1")]),
        ) as query_mock:
            resolved = await _resolve_slot_articles(
                MagicMock(),
                slot=slot,
                market_id="market-1",
                town=None,
                base_queries=[{}],
                loader=MagicMock(),
            )

    assert resolved == []
    assert query_mock.await_count == 0


@pytest.mark.asyncio
async def test_placement_slot_resolution_pin_only_skips_uncategorized_fill() -> None:
    """Placement pin-only slots do not pull unrelated market article ids."""

    slot = {
        "content_type": "articles",
        "pinned_ids": [],
        "query_rule": {"limit": 12},
    }

    with patch(
        "shared.read.placement_reads._article_ids_for_query_rule",
        AsyncMock(return_value=["leak-1"]),
    ) as query_mock:
        article_ids = await _article_ids_for_slot(
            MagicMock(),
            slot=slot,
            base_queries=[{}],
        )

    assert article_ids == []
    assert query_mock.await_count == 0


@pytest.mark.asyncio
async def test_published_slot_resolution_ignores_draft_pins() -> None:
    """Published feed resolution continues to use live pins only."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["live-1"],
        "draft_pinned_ids": ["draft-1"],
        "query_rule": {"limit": 2},
    }

    with patch(
        "shared.read.site_reads.list_published_by_ids",
        AsyncMock(return_value=[_make_article("live-1")]),
    ):
        with patch(
            "shared.read.site_reads._query_rule_articles",
            AsyncMock(return_value=[]),
        ):
            resolved = await _resolve_slot_articles(
                MagicMock(),
                slot=slot,
                market_id="market-1",
                town=None,
                base_queries=[{}],
                loader=MagicMock(),
            )

    assert [article.id for article in resolved] == ["live-1"]


def _slug_lookup_doc() -> dict:
    """Published article tagged to Colombia, not Puerto Rico."""

    return {
        "_id": "art-ve-1",
        "title": "Edificio colapsan tras terremotos en Venezuela",
        "slug": "edificio-colapsan-tras-terremotos-en-venezuela",
        "status": "published",
        "author_id": "user-1",
        "thumbnail_url": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "published_at": "2026-01-01T00:00:00+00:00",
        "body": "<p>Los edificios colapsaron.</p>",
        "tags": [],
        "market_ids": ["mkt-co"],
    }


@pytest.mark.asyncio
async def test_get_article_by_slug_falls_back_without_market() -> None:
    """A story pinned on another market remains readable by its unique slug."""

    doc = _slug_lookup_doc()
    collection = MagicMock()
    collection.find_one = AsyncMock(side_effect=[None, doc])
    db = MagicMock()
    db.__getitem__.return_value = collection
    loader = MagicMock()
    loader.load = AsyncMock(return_value="Reporter")

    result = await get_article_by_slug(
        db,
        slug=doc["slug"],
        market_id="mkt-pr",
        loader=loader,
    )

    assert result.id == "art-ve-1"
    assert result.slug == doc["slug"]
    assert collection.find_one.await_count == 2


@pytest.mark.asyncio
async def test_get_article_by_slug_prefers_active_market() -> None:
    """When the slug exists in the reader's market, that document is used."""

    doc = _slug_lookup_doc()
    collection = MagicMock()
    collection.find_one = AsyncMock(return_value=doc)
    db = MagicMock()
    db.__getitem__.return_value = collection
    loader = MagicMock()
    loader.load = AsyncMock(return_value="Reporter")

    result = await get_article_by_slug(
        db,
        slug=doc["slug"],
        market_id="mkt-co",
        loader=loader,
    )

    assert result.id == "art-ve-1"
    assert collection.find_one.await_count == 1
    query = collection.find_one.await_args.args[0]
    assert query["market_ids"] == "mkt-co"


class _EmptyAsyncCursor:
    """Motor-like cursor that records sort/skip/limit args and yields no documents."""

    def __init__(self) -> None:
        self.sort_args: tuple[object, ...] | None = None
        self.skip_args: tuple[object, ...] | None = None
        self.limit_args: tuple[object, ...] | None = None

    def sort(self, *args: object) -> _EmptyAsyncCursor:
        self.sort_args = args
        return self

    def skip(self, *args: object) -> _EmptyAsyncCursor:
        self.skip_args = args
        return self

    def limit(self, *args: object) -> _EmptyAsyncCursor:
        self.limit_args = args
        return self

    def __aiter__(self) -> _EmptyAsyncCursor:
        return self

    async def __anext__(self) -> dict:
        raise StopAsyncIteration


def _category_articles_mocks(
    *, total: int = 0
) -> tuple[MagicMock, _EmptyAsyncCursor, MagicMock]:
    """Build db, empty cursor, and author loader mocks for category archives.

    Args:
        total: Published article count returned by ``count_documents``.

    Returns:
        Database mock, cursor mock, and author-name loader mock.
    """

    cursor = _EmptyAsyncCursor()
    categories = MagicMock()
    categories.find_one = AsyncMock(return_value={"_id": "cat-baseball", "slug": "baseball"})
    articles = MagicMock()
    articles.count_documents = AsyncMock(return_value=total)
    articles.find.return_value = cursor

    def _collection(name: str) -> MagicMock:
        if name == CATEGORIES_COLLECTION:
            return categories
        if name == ARTICLES_COLLECTION:
            return articles
        raise AssertionError(name)

    db = MagicMock()
    db.__getitem__.side_effect = _collection
    loader = MagicMock()
    loader.load_many = AsyncMock()
    loader.load = AsyncMock()
    return db, cursor, loader


@pytest.mark.asyncio
async def test_list_category_articles_sorts_by_published_at_desc() -> None:
    """Category archives list published stories newest first by published_at."""

    db, cursor, loader = _category_articles_mocks()
    result = await list_category_articles(
        db,
        category_slug="baseball",
        params=PaginationParams(page=1, page_size=16),
        market_id="market-1",
        loader=loader,
    )

    assert cursor.sort_args == ("published_at", -1)
    assert cursor.skip_args == (0,)
    assert cursor.limit_args == (16,)
    assert result.items == []
    assert result.total == 0


@pytest.mark.asyncio
async def test_list_category_articles_paginates_sixteen_per_page() -> None:
    """Page 2 skips the first 16 documents so archives paginate in MongoDB."""

    db, cursor, loader = _category_articles_mocks(total=33)
    result = await list_category_articles(
        db,
        category_slug="baseball",
        params=PaginationParams(page=2, page_size=16),
        market_id="market-1",
        loader=loader,
    )

    assert cursor.skip_args == (16,)
    assert cursor.limit_args == (16,)
    assert result.page == 2
    assert result.page_size == 16
    assert result.has_more is True
