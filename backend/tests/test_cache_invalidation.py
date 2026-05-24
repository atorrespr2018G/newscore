"""Integration test: publish invalidates homepage feed cache."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))
if str(_ROOT / "news_storage_app") not in sys.path:
    sys.path.insert(0, str(_ROOT / "news_storage_app"))

from news_storage_app.services import article_service


@pytest.mark.integration
@pytest.mark.asyncio
async def test_publish_invalidates_homepage_feed_cache() -> None:
    """Publishing an article clears market homepage feed Redis keys."""

    if not os.getenv("REDIS_URL"):
        pytest.skip("REDIS_URL not configured")

    db = AsyncMock()
    db.__getitem__ = MagicMock()

    articles = MagicMock()
    articles.find_one = AsyncMock(
        return_value={
            "_id": "article-1",
            "status": "draft",
            "author_id": "user-1",
            "market_ids": ["market-us"],
        }
    )
    articles.find_one_and_update = AsyncMock(
        return_value={
            "_id": "article-1",
            "status": "published",
            "author_id": "user-1",
            "market_ids": ["market-us"],
            "title": "Fresh headline",
            "slug": "fresh-headline",
            "body": "Body",
            "tags": [],
            "media_ids": [],
            "view_count": 0,
            "created_at": "2026-01-01",
            "published_at": "2026-01-02",
        }
    )

    users = MagicMock()
    users.find_one = AsyncMock(return_value={"full_name": "Reporter"})

    def get_collection(name: str):
        if name == "articles":
            return articles
        if name == "users":
            return users
        return MagicMock()

    db.__getitem__.side_effect = get_collection

    with patch(
        "news_storage_app.services.article_service.invalidate_homepage_for_market_ids",
        new=AsyncMock(),
    ) as invalidate, patch(
        "news_storage_app.services.article_service.write_event",
        new=AsyncMock(),
    ) as write_audit:
        await article_service.publish(db, article_id="article-1", actor_id="editor-1")
        invalidate.assert_awaited_once_with(db, ["market-us"])
        write_audit.assert_awaited_once()
