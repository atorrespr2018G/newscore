"""Push a Media Desk story package into NewsCore as an editor draft."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from media_editor_app.config import (
    get_layout_admin_api_url,
    get_news_storage_api_url,
    get_public_base_url,
)
from media_editor_app.helpers.article_body import build_article_body
from media_editor_app.helpers.region_code import to_region_code
from media_editor_app.schemas import MediaAssetOut, MediaStoryOut, SendToEditorOut
from media_editor_app.services import media_service, story_service

logger = logging.getLogger(__name__)

_HOMEPAGE_PAGE_NAME = "homepage"
_IMPORTABLE_TYPES = frozenset({"image", "video"})
_REQUEST_TIMEOUT_SECONDS = 30.0


async def send_story_to_editor(
    db: AsyncIOMotorDatabase,
    *,
    story_id: str,
    owner_id: str,
    asset_ids: list[str],
    access_token: str,
) -> SendToEditorOut:
    """Register selected Media Desk assets and create a NewsCore draft article.

    Args:
        db: Media editor database.
        story_id: Story package to send.
        owner_id: Authenticated owner id.
        asset_ids: Ordered subset of report assets to include.
        access_token: NewsCore JWT forwarded to News Storage / Layout Admin.

    Returns:
        Created article summary for the Media Desk UI.

    Raises:
        LookupError: If the story is missing.
        ValueError: If taxonomy, assets, or NewsCore writes fail validation.
    """

    story = await story_service.get_story(db, story_id=story_id, owner_id=owner_id)
    assets = await _load_selected_assets(
        db, story=story, owner_id=owner_id, asset_ids=asset_ids,
    )
    _assert_taxonomy(story)
    body = build_article_body(story, assets)
    market_id = await _resolve_market_id(story, access_token=access_token)
    category_ids = await _resolve_category_ids(story, access_token=access_token)
    media_rows = await _register_assets(assets, access_token=access_token)
    article = await _create_draft_article(
        story=story,
        body=body,
        market_id=market_id,
        category_ids=category_ids,
        media_rows=media_rows,
        access_token=access_token,
    )
    await story_service.update_story_status(
        db, story_id=story_id, owner_id=owner_id, status="ready",
    )
    return SendToEditorOut(
        article_id=str(article["id"]),
        article_title=str(article["title"]),
        article_status=str(article.get("status") or "draft"),
        media_count=len(media_rows),
    )


async def _load_selected_assets(
    db: AsyncIOMotorDatabase,
    *,
    story: MediaStoryOut,
    owner_id: str,
    asset_ids: list[str],
) -> list[MediaAssetOut]:
    """Load and validate selected report assets in caller order.

    Args:
        db: Media editor database.
        story: Story package being sent.
        owner_id: Authenticated owner id.
        asset_ids: Requested asset ids.

    Returns:
        Importable assets in the requested order.

    Raises:
        ValueError: If an id is not in report order or is not image/video.
    """

    report_ids = set(story.selected_asset_ids)
    assets: list[MediaAssetOut] = []
    for asset_id in asset_ids:
        if asset_id not in report_ids:
            raise ValueError(f"Asset {asset_id} is not in this story's report order")
        asset = await media_service.get_media(db, media_id=asset_id, owner_id=owner_id)
        if asset.file_type not in _IMPORTABLE_TYPES:
            raise ValueError(f"Asset {asset_id} must be an image or video")
        assets.append(asset)
    return assets


def _assert_taxonomy(story: MediaStoryOut) -> None:
    """Require reporter-parity category selection before handoff.

    Args:
        story: Story package being sent.

    Raises:
        ValueError: When categories are missing.
    """

    if not story.category_slugs:
        raise ValueError("Select at least 1 category before sending to the editor")


async def _resolve_market_id(story: MediaStoryOut, *, access_token: str) -> str:
    """Resolve the NewsCore market uuid from Layout Admin.

    Args:
        story: Story with market / locality taxonomy.
        access_token: Bearer token (unused for public layout read; kept for parity).

    Returns:
        Market document id.

    Raises:
        ValueError: When the layout response lacks a market id.
    """

    region_code = to_region_code(story.market_code, story.town_id, story.county_id)
    params = {"market": story.market_code, "region_code": region_code}
    url = f"{get_layout_admin_api_url()}/layouts/page/{_HOMEPAGE_PAGE_NAME}"
    data = await _get_json(url, params=params, access_token=access_token)
    market_id = data.get("market_id")
    if not market_id:
        raise ValueError("Unable to resolve market id for this story location")
    return str(market_id)


async def _resolve_category_ids(story: MediaStoryOut, *, access_token: str) -> list[str]:
    """Map Media Desk category slugs to News Storage category ids.

    Args:
        story: Story with category slugs.
        access_token: Bearer token (categories are public; kept for parity).

    Returns:
        Ordered category ids matching the story slugs.

    Raises:
        ValueError: When a slug cannot be resolved.
    """

    url = f"{get_news_storage_api_url()}/categories"
    rows = await _get_json(url, access_token=access_token)
    if not isinstance(rows, list):
        raise ValueError("Unexpected categories response from News Storage")
    by_slug = {
        str(row.get("slug") or "").strip().lower(): str(row.get("id") or "")
        for row in rows
        if isinstance(row, dict)
    }
    resolved: list[str] = []
    for slug in story.category_slugs:
        category_id = by_slug.get(slug.strip().lower())
        if not category_id:
            raise ValueError(f"Unknown category slug: {slug}")
        resolved.append(category_id)
    return resolved


async def _register_assets(
    assets: list[MediaAssetOut],
    *,
    access_token: str,
) -> list[dict[str, Any]]:
    """Register each Media Desk asset URL into News Storage media.

    Args:
        assets: Selected image/video assets.
        access_token: Bearer token for News Storage.

    Returns:
        Registered media rows in the same order.
    """

    rows: list[dict[str, Any]] = []
    for asset in assets:
        payload = {
            "file_type": asset.file_type,
            "url": _absolute_asset_url(asset.url),
            "width": asset.width,
            "height": asset.height,
            "duration": asset.duration,
            "source_asset_id": asset.id,
        }
        row = await _post_json(
            f"{get_news_storage_api_url()}/media/external",
            payload=payload,
            access_token=access_token,
        )
        rows.append(row)
    return rows


async def _create_draft_article(
    *,
    story: MediaStoryOut,
    body: str,
    market_id: str,
    category_ids: list[str],
    media_rows: list[dict[str, Any]],
    access_token: str,
) -> dict[str, Any]:
    """Create a NewsCore draft article mirroring the reporter save path.

    Args:
        story: Source Media Desk story.
        body: Composed HTML body.
        market_id: Resolved market uuid.
        category_ids: Resolved category uuids.
        media_rows: Registered News Storage media rows.
        access_token: Bearer token for News Storage.

    Returns:
        Created article payload.
    """

    images = [row for row in media_rows if row.get("file_type") == "image"]
    videos = [row for row in media_rows if row.get("file_type") == "video"]
    region_code = to_region_code(story.market_code, story.town_id, story.county_id)
    payload = {
        "title": story.title.strip(),
        "body": body,
        "category_ids": category_ids,
        "international_potential": story.international_potential,
        "market_ids": [market_id],
        "direct_region_ids": [region_code],
        "region_visibility_mode": "upward_only",
        "media_ids": [str(row["id"]) for row in media_rows],
        "thumbnail_url": images[0].get("url") if images else None,
        "video_url": videos[0].get("url") if videos else None,
    }
    return await _post_json(
        f"{get_news_storage_api_url()}/articles",
        payload=payload,
        access_token=access_token,
    )


def _absolute_asset_url(url: str) -> str:
    """Ensure Media Desk asset URLs are absolute for News Storage registration.

    Args:
        url: Stored asset URL (absolute or site-relative).

    Returns:
        Absolute http(s) URL.
    """

    if url.startswith("http://") or url.startswith("https://"):
        return url
    base = get_public_base_url() or "http://localhost:5004"
    return f"{base.rstrip('/')}{url if url.startswith('/') else f'/{url}'}"


async def _get_json(
    url: str,
    *,
    access_token: str,
    params: dict[str, str] | None = None,
) -> Any:
    """Perform an authenticated GET and return parsed JSON.

    Args:
        url: Absolute request URL.
        access_token: Bearer token.
        params: Optional query string.

    Returns:
        Parsed JSON body.

    Raises:
        ValueError: When the remote API returns an error.
    """

    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(url, headers=headers, params=params)
    except httpx.HTTPError as exc:
        logger.error("Handoff GET failed for %s: %s", url, exc, exc_info=True)
        raise ValueError(f"Unable to reach NewsCore service at {url}") from exc
    if response.status_code >= 400:
        raise ValueError(_remote_error_message(response))
    return response.json()


async def _post_json(
    url: str,
    *,
    payload: dict[str, Any],
    access_token: str,
) -> dict[str, Any]:
    """Perform an authenticated POST and return parsed JSON object.

    Args:
        url: Absolute request URL.
        payload: JSON body.
        access_token: Bearer token.

    Returns:
        Parsed JSON object.

    Raises:
        ValueError: When the remote API returns an error or non-object body.
    """

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        logger.error("Handoff POST failed for %s: %s", url, exc, exc_info=True)
        raise ValueError(f"Unable to reach NewsCore service at {url}") from exc
    if response.status_code >= 400:
        raise ValueError(_remote_error_message(response))
    data = response.json()
    if not isinstance(data, dict):
        raise ValueError("Unexpected response from NewsCore")
    return data


def _remote_error_message(response: httpx.Response) -> str:
    """Extract a human-readable detail from a failed NewsCore response.

    Args:
        response: Failed HTTP response.

    Returns:
        Error message string.
    """

    try:
        body = response.json()
    except ValueError:
        return f"NewsCore request failed ({response.status_code})"
    detail = body.get("detail") if isinstance(body, dict) else None
    if isinstance(detail, str) and detail.strip():
        return detail
    if isinstance(detail, list):
        parts = []
        for item in detail:
            if isinstance(item, dict) and "msg" in item:
                parts.append(str(item["msg"]))
            else:
                parts.append(str(item))
        if parts:
            return "; ".join(parts)
    return f"NewsCore request failed ({response.status_code})"
