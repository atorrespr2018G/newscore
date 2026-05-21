"""Slug utilities for articles and categories."""

from __future__ import annotations

from slugify import slugify


def slugify_title(title: str) -> str:
    """Convert a title to a URL-safe slug.

    Args:
        title: Article title.

    Returns:
        URL-safe slug.
    """

    return slugify(title, lowercase=True, max_length=120)

