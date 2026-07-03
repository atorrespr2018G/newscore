"""Slug uniqueness helpers for article create and update flows."""

from __future__ import annotations

from typing import Any

from news_storage_app.helpers.slug_helpers import slugify_title
from shared.core.exceptions import ValidationError
from shared.repositories.article_repository import ArticleRepository


async def _ensure_unique_slug(
    repo: ArticleRepository,
    *,
    slug: str,
    exclude_id: str | None = None,
) -> str:
    """Return a slug that does not collide with an existing article.

    Args:
        repo: Article repository.
        slug: Base slug candidate.
        exclude_id: Article id to exclude when checking collisions.

    Returns:
        Unique slug, with a numeric suffix appended when needed.
    """

    candidate = slug
    suffix = 2
    while await repo.slug_exists(candidate, exclude_id=exclude_id):
        candidate = f"{slug}-{suffix}"
        suffix += 1
    return candidate


async def _apply_slug_update(
    repo: ArticleRepository,
    *,
    update_doc: dict[str, Any],
    article_id: str,
) -> None:
    """Derive a unique slug when the title changes.

    Mutates ``update_doc`` in place with the new slug when applicable.

    Args:
        repo: Article repository.
        update_doc: Pending update fields.
        article_id: Article id being updated.

    Raises:
        ValidationError: If the new title cannot produce a slug.
    """

    if "title" not in update_doc:
        return
    base_slug = slugify_title(str(update_doc["title"]))
    if not base_slug:
        raise ValidationError("Title cannot produce a slug")
    update_doc["slug"] = await _ensure_unique_slug(repo, slug=base_slug, exclude_id=article_id)
