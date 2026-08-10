"""Compose a NewsCore article body from Media Desk story and asset editions."""

from __future__ import annotations

import html
import re

from media_editor_app.schemas import MediaAssetOut, MediaStoryOut

_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")
_MIN_BODY_TEXT_LENGTH = 10


def html_text_length(value: str | None) -> int:
    """Count trimmed plain-text characters inside HTML.

    Args:
        value: HTML or plain text.

    Returns:
        Number of non-whitespace-trimmed text characters.
    """

    text = _TAG_RE.sub(" ", value or "")
    return len(_SPACE_RE.sub(" ", text).strip())


def build_article_body(story: MediaStoryOut, assets: list[MediaAssetOut]) -> str:
    """Build article HTML from selected asset editions, then story description.

    Args:
        story: Media Desk story package.
        assets: Selected report assets in transfer order.

    Returns:
        HTML body for ``POST /articles``.

    Raises:
        ValueError: If the composed body is shorter than the NewsCore minimum.
    """

    parts: list[str] = []
    for asset in assets:
        parts.extend(_asset_body_parts(asset))
    body = "".join(parts).strip()
    if html_text_length(body) < _MIN_BODY_TEXT_LENGTH:
        story_body = (story.description or "").strip()
        if html_text_length(story_body) >= _MIN_BODY_TEXT_LENGTH:
            body = story_body
    if html_text_length(body) < _MIN_BODY_TEXT_LENGTH:
        raise ValueError(
            "Add a headline description of at least 10 characters on a selected "
            "picture/video (Edition panel) before sending to the editor",
        )
    return body


def _asset_body_parts(asset: MediaAssetOut) -> list[str]:
    """Return HTML fragments for one asset edition.

    Args:
        asset: Selected Media Desk asset.

    Returns:
        Zero or more HTML fragments to append to the article body.
    """

    title = (asset.title or "").strip()
    description = (asset.description or "").strip()
    fragments: list[str] = []
    if title:
        fragments.append(f"<h2>{html.escape(title)}</h2>")
    if html_text_length(description) > 0:
        fragments.append(description)
    elif title:
        fragments.append(f"<p>{html.escape(title)}</p>")
    return fragments
