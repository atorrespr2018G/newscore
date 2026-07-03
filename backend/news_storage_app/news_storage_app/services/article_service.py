"""Article lifecycle service facade (draft/review/publish/archive)."""

from __future__ import annotations

from shared.core.audit import write_event
from shared.core.cache_invalidation import invalidate_homepage_for_market_ids
from news_storage_app.helpers.article_validation import _validate_market_ids
from news_storage_app.services import (
    article_create_service,
    article_lifecycle_service,
    article_read_service,
    article_update_service,
)

create = article_create_service.create
get_by_id = article_read_service.get_by_id
get_detail_by_id = article_read_service.get_detail_by_id
list_all = article_read_service.list_all
list_story_groups = article_read_service.list_story_groups
update = article_update_service.update
publish = article_lifecycle_service.publish
submit_for_review = article_lifecycle_service.submit_for_review
approve = article_lifecycle_service.approve
send_back = article_lifecycle_service.send_back
archive = article_lifecycle_service.archive

__all__ = [
    "_validate_market_ids",
    "archive",
    "approve",
    "create",
    "get_by_id",
    "get_detail_by_id",
    "invalidate_homepage_for_market_ids",
    "list_all",
    "list_story_groups",
    "publish",
    "send_back",
    "submit_for_review",
    "update",
    "write_event",
]
