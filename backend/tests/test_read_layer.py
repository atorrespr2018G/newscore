"""Unit tests for shared read layer."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1] / "shared"
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from shared.read.article_reads import article_out


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
