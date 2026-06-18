"""Unit tests for shared read layer."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1] / "shared"
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from shared.read.article_reads import article_out
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
        "query_rule": {"limit": 4},
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
                base_query={},
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
        "query_rule": {"limit": 2},
    }

    with patch(
        "shared.read.placement_reads._article_ids_for_query_rule",
        AsyncMock(return_value=["query-1", "query-2"]),
    ):
        article_ids = await _article_ids_for_slot(
            MagicMock(),
            slot=slot,
            base_query={},
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
                base_query={},
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
        "query_rule": {"limit": 3},
    }

    with patch(
        "shared.read.placement_reads._article_ids_for_query_rule",
        AsyncMock(return_value=["query-1"]),
    ):
        article_ids = await _article_ids_for_slot(
            MagicMock(),
            slot=slot,
            base_query={},
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
                base_query={},
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
        "query_rule": {"limit": 4},
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
                base_query={},
                loader=MagicMock(),
            )

    assert [article.id for article in resolved] == ["query-1"]


@pytest.mark.asyncio
async def test_preview_slot_resolution_query_fill_uses_published_only() -> None:
    """Preview resolver still backfills slots with published query articles."""

    slot = {
        "content_type": "articles",
        "pinned_ids": ["draft-1"],
        "query_rule": {"limit": 3},
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
                base_query={},
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
        base_query={},
        use_draft_pins=True,
    )

    assert article_ids == ["draft-1"]


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
                base_query={},
                loader=MagicMock(),
            )

    assert [article.id for article in resolved] == ["live-1"]
