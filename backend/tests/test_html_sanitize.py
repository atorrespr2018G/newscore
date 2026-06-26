"""Tests for reporter-authored article HTML sanitization."""

from __future__ import annotations

import pytest

from shared.core.exceptions import ValidationError
from shared.helpers.html_sanitize import sanitize_article_html


def test_allowed_formatting_tags_are_preserved() -> None:
    """Editor formatting tags survive sanitization."""

    raw = "<p>Hello <strong>bold</strong> and <em>italic</em></p>"
    assert sanitize_article_html(raw) == raw


def test_disallowed_tags_are_stripped() -> None:
    """Tags outside the allowlist are removed while inner text is kept."""

    raw = "<div><p>Body</p><span>inline</span></div>"
    cleaned = sanitize_article_html(raw)
    assert "<div" not in cleaned
    assert "<span" not in cleaned
    assert "<p>Body</p>" in cleaned
    assert "inline" in cleaned


def test_script_tags_are_removed() -> None:
    """Script payloads are dropped to prevent stored XSS."""

    raw = "<p>safe</p><script>alert('x')</script>"
    cleaned = sanitize_article_html(raw)
    assert "<script" not in cleaned
    assert "alert" not in cleaned


def test_javascript_link_scheme_is_stripped() -> None:
    """Links with unsafe schemes lose their href."""

    raw = '<p><a href="javascript:alert(1)">click</a></p>'
    cleaned = sanitize_article_html(raw)
    assert "javascript:" not in cleaned


def test_safe_link_keeps_href_and_gets_rel() -> None:
    """Allowed links keep href and gain the security rel attribute."""

    raw = '<p><a href="https://example.com">link</a></p>'
    cleaned = sanitize_article_html(raw)
    assert 'href="https://example.com"' in cleaned
    assert "noopener" in cleaned


def test_non_string_input_raises() -> None:
    """Non-string bodies are rejected loudly."""

    with pytest.raises(ValidationError):
        sanitize_article_html(None)  # type: ignore[arg-type]
