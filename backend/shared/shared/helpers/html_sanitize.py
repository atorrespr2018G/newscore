"""Sanitize reporter-authored article HTML to a safe allowlist.

Article bodies are authored in a rich-text (WYSIWYG) editor and stored as
HTML. Untrusted HTML is sanitized here before persistence so the public site can
render it directly without XSS risk.
"""

from __future__ import annotations

import nh3

from shared.core.exceptions import ValidationError

# Block/inline tags the rich-text editor can produce. Anything else is stripped.
ALLOWED_TAGS: frozenset[str] = frozenset(
    {
        "p",
        "br",
        "strong",
        "em",
        "u",
        "s",
        "h2",
        "h3",
        "blockquote",
        "ul",
        "ol",
        "li",
        "a",
        "code",
        "pre",
    }
)

# Only links carry attributes; href is constrained to safe schemes below. The
# "rel" attribute is managed by nh3 via the link_rel option, not the allowlist.
ALLOWED_ATTRIBUTES: dict[str, set[str]] = {"a": {"href", "target"}}

ALLOWED_URL_SCHEMES: frozenset[str] = frozenset({"http", "https", "mailto"})


def sanitize_article_html(raw: str) -> str:
    """Return a sanitized copy of reporter-authored article HTML.

    Args:
        raw: Raw HTML string emitted by the rich-text editor.

    Returns:
        Sanitized HTML containing only allowlisted tags and attributes.

    Raises:
        ValidationError: If ``raw`` is not a string.
    """

    if not isinstance(raw, str):
        raise ValidationError("Article body must be a string.")

    return nh3.clean(
        raw,
        tags=set(ALLOWED_TAGS),
        attributes={tag: set(attrs) for tag, attrs in ALLOWED_ATTRIBUTES.items()},
        url_schemes=set(ALLOWED_URL_SCHEMES),
        link_rel="noopener noreferrer",
    )
