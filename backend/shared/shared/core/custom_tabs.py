"""Custom tab registry helpers: reserved slugs and label slugification."""

from __future__ import annotations

import re

from shared.core.exceptions import ValidationError

_SLUG_SAFE_RE = re.compile(r"[^a-z0-9]+")

# Built-in site segments and admin paths that custom tabs must not claim.
RESERVED_CUSTOM_TAB_SLUGS = frozenset(
    {
        "admin",
        "api",
        "article",
        "articles",
        "business",
        "entertainment",
        "government",
        "health",
        "homepage",
        "login",
        "logout",
        "main",
        "main-page",
        "more",
        "news",
        "politics",
        "preview",
        "reporter",
        "sports",
        "technology",
        "world",
    },
)


def slugify_tab_label(label: str) -> str:
    """Derive a URL-safe tab slug from a display label.

    Args:
        label: Human-readable tab name.

    Returns:
        Lowercase hyphenated slug.

    Raises:
        ValidationError: When the label yields an empty slug.
    """

    normalized = _SLUG_SAFE_RE.sub("-", label.strip().lower()).strip("-")
    if not normalized:
        raise ValidationError("Tab label must contain letters or numbers")
    return normalized


def assert_custom_tab_slug_allowed(slug: str) -> str:
    """Normalize and validate a custom tab slug against reserved names.

    Args:
        slug: Proposed page name / URL segment.

    Returns:
        Normalized slug.

    Raises:
        ValidationError: When the slug is empty or reserved.
    """

    normalized = slugify_tab_label(slug)
    if normalized in RESERVED_CUSTOM_TAB_SLUGS:
        raise ValidationError(f"Tab slug '{normalized}' is reserved")
    return normalized
