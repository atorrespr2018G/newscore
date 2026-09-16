"""Fan-out article pins across markets for worldwide placement."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from layout_admin_app.services import layout_service, slot_service
from layout_admin_app.services.slot_service import (
    _resolve_slot_pinned_limit,
)
from shared.core.exceptions import NotFoundError, ValidationError
from shared.core.layout_ensure import ensure_exact_page_layout
from shared.core.regions import REGIONS_COLLECTION, get_region_by_code
from shared.core.worldwide import effective_market_ids, list_markets, normalize_excluded_market_ids
from shared.read.collections import ARTICLES_COLLECTION, LAYOUTS_COLLECTION, SLOTS_COLLECTION
from shared.schemas.layout_schemas import (
    SlotUpdate,
    WorldwidePlacementMarketResult,
    WorldwidePlacementOut,
    WorldwidePlacementRequest,
)


def _normalize_pin(value: Any) -> str:
    """Return a stripped pin id or empty string."""

    if value is None:
        return ""
    return str(value).strip()


def clamp_pins_preserving_globals(
    pinned_ids: list[str],
    *,
    limit: int | None,
    worldwide_ids: set[str],
    protected_id: str,
) -> list[str]:
    """Trim a pin list to ``limit`` without dropping the protected global.

    Drops trailing empties and non-worldwide pins first. Only drops other
    worldwide pins when the slot still exceeds capacity.

    Args:
        pinned_ids: Ordered pin list.
        limit: Optional max length.
        worldwide_ids: Article ids marked worldwide.
        protected_id: Newly placed worldwide article that must remain.

    Returns:
        Clamped pin list.
    """

    if limit is None or limit <= 0:
        return list(pinned_ids)

    result = [_normalize_pin(value) for value in pinned_ids]
    protected = _normalize_pin(protected_id)
    worldwide = {
        _normalize_pin(item) for item in worldwide_ids if _normalize_pin(item)
    }
    if protected:
        worldwide.add(protected)

    while len(result) > limit:
        removed = False
        for index in range(len(result) - 1, -1, -1):
            pin = result[index]
            if not pin:
                result.pop(index)
                removed = True
                break
            if pin == protected:
                continue
            if pin not in worldwide:
                result.pop(index)
                removed = True
                break
        if removed:
            continue
        for index in range(len(result) - 1, -1, -1):
            if result[index] != protected:
                result.pop(index)
                removed = True
                break
        if not removed:
            break
    return result


def place_global_article_in_pins(
    pinned_ids: list[str],
    *,
    article_id: str,
    requested_position: int,
    limit: int | None,
    worldwide_ids: set[str] | None = None,
) -> tuple[list[str], int]:
    """Always allocate a worldwide story at the requested index.

    Inserts at ``requested_position`` and shifts existing pins down one. When
    another worldwide story already occupies that cell, it shifts with the rest.
    Capacity overflow drops locals before other globals; the new story stays.

    Args:
        pinned_ids: Current pin list (may include empty placeholders).
        article_id: Worldwide article being placed.
        requested_position: Preferred zero-based index.
        limit: Optional slot capacity.
        worldwide_ids: Known worldwide article ids already in the slot.

    Returns:
        Updated pins and the index used (always the requested index).
    """

    article = _normalize_pin(article_id)
    pins = [_normalize_pin(value) for value in pinned_ids]
    pins = ["" if pin == article else pin for pin in pins]
    target = max(0, requested_position)
    while len(pins) < target:
        pins.append("")
    pins.insert(target, article)
    known_globals = set(worldwide_ids or set())
    known_globals.add(article)
    clamped = clamp_pins_preserving_globals(
        pins,
        limit=limit,
        worldwide_ids=known_globals,
        protected_id=article,
    )
    used_index = clamped.index(article) if article in clamped else target
    return clamped, used_index


def place_local_article_in_pins(
    pinned_ids: list[str],
    *,
    article_id: str,
    requested_position: int,
    limit: int | None,
    worldwide_ids: set[str],
) -> tuple[list[str], int]:
    """Place a non-worldwide story without displacing worldwide pins.

    If the requested cell holds a worldwide story, the local story moves to the
    next index that does not contain a worldwide story (empty or local).

    Args:
        pinned_ids: Current pin list.
        article_id: Local article being placed.
        requested_position: Preferred zero-based index.
        limit: Optional slot capacity.
        worldwide_ids: Article ids marked worldwide.

    Returns:
        Updated pins and the index used.
    """

    article = _normalize_pin(article_id)
    pins = [_normalize_pin(value) for value in pinned_ids]
    pins = ["" if pin == article else pin for pin in pins]
    globals_set = {_normalize_pin(item) for item in worldwide_ids if _normalize_pin(item)}
    target = max(0, requested_position)
    while True:
        while len(pins) <= target:
            pins.append("")
        occupant = pins[target]
        if not occupant or occupant not in globals_set:
            break
        target += 1

    occupant = pins[target]
    if occupant and occupant not in globals_set:
        pins.insert(target, article)
    else:
        pins[target] = article

    if limit is not None and limit > 0:
        pins = clamp_pins_preserving_globals(
            pins,
            limit=limit,
            worldwide_ids=globals_set,
            protected_id="",
        )

    if article not in pins:
        # Slot is filled with worldwide stories; locals cannot displace them.
        return pins, target

    return pins, pins.index(article)


def _effective_draft_pins(slot: dict[str, Any]) -> list[str]:
    """Return draft pins when staged, otherwise live pins."""

    if slot.get("draft_pinned_ids") is not None:
        return list(slot.get("draft_pinned_ids") or [])
    return list(slot.get("pinned_ids") or [])


async def _worldwide_ids_among(
    db: AsyncIOMotorDatabase,
    article_ids: list[str],
) -> set[str]:
    """Return the subset of ids that belong to worldwide articles.

    Args:
        db: Database connection.
        article_ids: Candidate article ids.

    Returns:
        Ids whose articles have ``worldwide=True``.
    """

    normalized = [_normalize_pin(article_id) for article_id in article_ids if _normalize_pin(article_id)]
    if not normalized:
        return set()
    cursor = db[ARTICLES_COLLECTION].find(
        {"_id": {"$in": normalized}, "worldwide": True},
        {"_id": 1},
    )
    return {str(doc["_id"]) async for doc in cursor}


async def _load_article_targeting(
    db: AsyncIOMotorDatabase,
    article_id: str,
) -> list[str]:
    """Load a worldwide article and resolve markets to fan out to.

    Args:
        db: Database connection.
        article_id: Article id.

    Returns:
        Effective market ids.

    Raises:
        NotFoundError: If the article does not exist.
        ValidationError: If the article is not worldwide or no markets remain.
    """

    article = await db[ARTICLES_COLLECTION].find_one({"_id": article_id})
    if article is None:
        raise NotFoundError("Article not found")
    if not bool(article.get("worldwide")):
        raise ValidationError("Article must be marked worldwide before cross-market placement")

    markets = await list_markets(db)
    all_ids = [str(doc["_id"]) for doc in markets]
    excluded = normalize_excluded_market_ids(
        [str(mid) for mid in (article.get("excluded_market_ids") or [])]
    )
    effective = effective_market_ids(all_ids, excluded_market_ids=excluded)
    if not effective:
        raise ValidationError("No markets available for worldwide placement")
    return effective


async def _descendant_region_docs(
    db: AsyncIOMotorDatabase,
    country_id: str,
) -> list[dict[str, Any]]:
    """Return active region docs for a country and all descendants.

    Args:
        db: Database connection.
        country_id: Country region document id.

    Returns:
        Region documents with ``_id`` and ``code``.
    """

    cursor = db[REGIONS_COLLECTION].find(
        {
            "is_active": True,
            "$or": [{"_id": country_id}, {"ancestor_ids": country_id}],
        },
        {"_id": 1, "code": 1},
    )
    return [doc async for doc in cursor]


async def _region_board_targets(
    db: AsyncIOMotorDatabase,
    *,
    market_code: str,
    page_name: str,
) -> list[tuple[str | None, str]]:
    """Resolve country + existing child boards that should receive a global pin.

    Always includes the country board (created when missing). Also includes every
    descendant region that already has an exact layout for ``page_name`` so
    boards like USA→Florida or PR→Adjuntas pick up the same worldwide pin.

    Args:
        db: Database connection.
        market_code: Market short code used as country region code.
        page_name: Layout page name.

    Returns:
        Ordered ``(region_id, region_code)`` targets. ``region_id`` is None for
        market-level boards when no country region exists.
    """

    country = await get_region_by_code(db, market_code)
    if country is None:
        return [(None, market_code)]

    country_id = str(country["_id"])
    country_code = str(country.get("code") or market_code)
    await ensure_exact_page_layout(db, region_id=country_id, page_name=page_name)

    region_docs = await _descendant_region_docs(db, country_id)
    region_ids = [str(doc["_id"]) for doc in region_docs]
    code_by_id = {
        str(doc["_id"]): str(doc.get("code") or "").strip().lower() or market_code
        for doc in region_docs
    }

    layout_cursor = db[LAYOUTS_COLLECTION].find(
        {
            "page_name": page_name,
            "is_active": True,
            "region_id": {"$in": region_ids},
        },
        {"region_id": 1},
    )
    target_ids = {str(doc["region_id"]) async for doc in layout_cursor if doc.get("region_id")}
    target_ids.add(country_id)

    targets = [(region_id, code_by_id.get(region_id, country_code)) for region_id in target_ids]
    targets.sort(key=lambda item: (0 if item[0] == country_id else 1, item[1]))
    return targets


async def _slot_for_region_board(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    region_id: str | None,
    page_name: str,
    position_key: str,
) -> dict[str, Any] | None:
    """Resolve the articles slot for one exact region (or market-level) board.

    Args:
        db: Database connection.
        market_id: Market document id.
        region_id: Exact region board id, or None for market-level.
        page_name: Layout page name.
        position_key: Slot position key.

    Returns:
        Slot document, or None when missing.
    """

    try:
        layout = await layout_service.get_by_page_name(
            db,
            page_name,
            market_id=market_id,
            region_id=region_id,
        )
    except NotFoundError:
        return None

    return await db[SLOTS_COLLECTION].find_one(
        {
            "layout_id": layout.id,
            "position_key": position_key,
            "content_type": "articles",
        }
    )


async def _place_on_slot(
    db: AsyncIOMotorDatabase,
    *,
    slot: dict[str, Any],
    article_id: str,
    position: int,
    publish: bool,
    actor_id: str | None,
) -> tuple[str, int]:
    """Write a worldwide pin onto one slot and return slot id + index used.

    Args:
        db: Database connection.
        slot: Slot document.
        article_id: Worldwide article id.
        position: Requested zero-based index.
        publish: When True, write live pins; otherwise draft pins.
        actor_id: Optional auditing actor id.

    Returns:
        Updated slot id and the index used.
    """

    current_pins = _effective_draft_pins(slot)
    limit = _resolve_slot_pinned_limit(slot)
    worldwide_ids = await _worldwide_ids_among(db, current_pins)
    worldwide_ids.add(article_id)
    next_pins, used_index = place_global_article_in_pins(
        current_pins,
        article_id=article_id,
        requested_position=position,
        limit=limit,
        worldwide_ids=worldwide_ids,
    )
    update_body = (
        SlotUpdate(pinned_ids=next_pins) if publish else SlotUpdate(draft_pinned_ids=next_pins)
    )
    updated = await slot_service.update(
        db,
        slot_id=str(slot["_id"]),
        body=update_body,
        actor_id=actor_id,
    )
    return updated.id, used_index


async def place_across_markets(
    db: AsyncIOMotorDatabase,
    body: WorldwidePlacementRequest,
    *,
    actor_id: str | None = None,
) -> WorldwidePlacementOut:
    """Pin a worldwide article across every effective market board subtree.

    For each market, places on the country board and on every existing child
    region board under that country (states, counties, towns). Globals always
    take the requested index; locals may be trimmed when over capacity.

    Args:
        db: Database connection.
        body: Placement request.
        actor_id: Optional auditing actor id.

    Returns:
        Per-board placement results.

    Raises:
        NotFoundError: If the article does not exist.
        ValidationError: If targeting or placement input is invalid.
    """

    effective_ids = await _load_article_targeting(db, body.article_id)
    markets = await list_markets(db)
    markets_by_id = {str(doc["_id"]): doc for doc in markets}
    results: list[WorldwidePlacementMarketResult] = []
    page_name = body.page_name.strip().lower() or "homepage"
    position_key = body.position_key.strip()

    for market_id in effective_ids:
        market = markets_by_id.get(market_id)
        market_code = str((market or {}).get("code") or market_id)
        targets = await _region_board_targets(
            db,
            market_code=market_code,
            page_name=page_name,
        )
        if not targets:
            results.append(
                WorldwidePlacementMarketResult(
                    market_id=market_id,
                    market_code=market_code,
                    status="skipped",
                    reason="slot_not_found",
                )
            )
            continue

        for region_id, region_code in targets:
            slot = await _slot_for_region_board(
                db,
                market_id=market_id,
                region_id=region_id,
                page_name=page_name,
                position_key=position_key,
            )
            if slot is None:
                results.append(
                    WorldwidePlacementMarketResult(
                        market_id=market_id,
                        market_code=market_code,
                        region_id=region_id,
                        region_code=region_code,
                        status="skipped",
                        reason="slot_not_found",
                    )
                )
                continue

            slot_id, used_index = await _place_on_slot(
                db,
                slot=slot,
                article_id=body.article_id,
                position=body.position,
                publish=body.publish,
                actor_id=actor_id,
            )
            results.append(
                WorldwidePlacementMarketResult(
                    market_id=market_id,
                    market_code=market_code,
                    region_id=region_id,
                    region_code=region_code,
                    slot_id=slot_id,
                    position=used_index,
                    status="placed",
                )
            )

    return WorldwidePlacementOut(
        article_id=body.article_id,
        page_name=page_name,
        position_key=position_key,
        requested_position=body.position,
        results=results,
    )
