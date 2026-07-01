"""Slot service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.audit import write_event
from shared.core.cache_invalidation import invalidate_homepage_for_layout
from shared.core.exceptions import NotFoundError, ValidationError
from shared.core.placement_events import (
    clear_placement_events,
    compute_added_ids,
    record_placements,
)
from shared.repositories.slot_repository import SlotRepository
from shared.schemas.layout_schemas import SlotCreate, SlotOut, SlotUpdate

HOMEPAGE_HERO_PINNED_LIMIT = 12
HOMEPAGE_US_FEATURED_PINNED_LIMIT = 12
HOMEPAGE_MORE_TOP_STORIES_PINNED_LIMIT = 7
HERO_POSITION_KEY = "hero"
US_FEATURED_POSITION_KEY = "us-featured"
MORE_TOP_STORIES_POSITION_KEYS = frozenset({"more-top-stories", "more-top-stories-2"})


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_positive_limit(value: Any) -> int | None:
    """Parse a positive slot limit from query-rule metadata."""

    if value is None:
        return None
    try:
        limit = int(value)
    except (TypeError, ValueError):
        return None
    return limit if limit > 0 else None


def _resolve_slot_pinned_limit(slot: dict[str, Any]) -> int | None:
    """Resolve the maximum pinned article count for a slot."""

    query_rule = slot.get("query_rule")
    if isinstance(query_rule, dict):
        limit = _parse_positive_limit(query_rule.get("limit"))
        if limit is not None:
            return limit

    if slot.get("position_key") == HERO_POSITION_KEY:
        return HOMEPAGE_HERO_PINNED_LIMIT

    if slot.get("position_key") == US_FEATURED_POSITION_KEY:
        return HOMEPAGE_US_FEATURED_PINNED_LIMIT

    if slot.get("position_key") in MORE_TOP_STORIES_POSITION_KEYS:
        return HOMEPAGE_MORE_TOP_STORIES_PINNED_LIMIT

    return None


def _clamp_pinned_ids(pinned_ids: list[str], limit: int | None) -> list[str]:
    """Trim pinned ids to a slot capacity when configured."""

    if limit is None or len(pinned_ids) <= limit:
        return list(pinned_ids)
    return list(pinned_ids[:limit])


def _to_out(doc: dict[str, Any]) -> SlotOut:
    draft_pinned_ids = doc.get("draft_pinned_ids")
    return SlotOut(
        id=str(doc["_id"]),
        layout_id=str(doc["layout_id"]),
        position_key=doc["position_key"],
        content_type=doc["content_type"],
        display_name=doc.get("display_name"),
        presentation_type=str(doc.get("presentation_type") or "grid_4"),
        pinned_ids=list(doc.get("pinned_ids") or []),
        draft_pinned_ids=list(draft_pinned_ids) if draft_pinned_ids is not None else None,
        query_rule=doc.get("query_rule"),
        order_index=int(doc.get("order_index") or 0),
        updated_at=doc.get("updated_at", ""),
    )


async def _record_slot_placements(
    db: AsyncIOMotorDatabase,
    repo: SlotRepository,
    *,
    slot_id: str,
    layout_id: str,
    existing: dict[str, Any],
    update_doc: dict[str, Any],
) -> None:
    """Log placement events for article ids newly pinned into a slot.

    Diffs the live and staged pin arrays so each freshly added story records a
    ``placed_at`` used by the Placement tab badge.

    Args:
        db: Database connection.
        repo: Slot repository for resolving the layout's market.
        slot_id: Slot receiving the pins.
        layout_id: Layout the slot belongs to.
        existing: Slot document prior to the update.
        update_doc: Clamped update payload that was applied.
    """

    added: list[str] = []
    if "pinned_ids" in update_doc:
        added += compute_added_ids(existing.get("pinned_ids"), update_doc["pinned_ids"])
    if "draft_pinned_ids" in update_doc:
        added += compute_added_ids(existing.get("draft_pinned_ids"), update_doc["draft_pinned_ids"])
    if not added:
        return

    market_id = await repo.get_layout_market_id(layout_id)
    await record_placements(db, article_ids=added, slot_id=slot_id, market_id=market_id)


async def create(
    db: AsyncIOMotorDatabase,
    body: SlotCreate,
    *,
    actor_id: str | None = None,
) -> SlotOut:
    """Create a slot and attach it to a layout.

    Args:
        db: Database connection.
        body: New slot payload.
        actor_id: Optional auditing actor id.

    Returns:
        Created slot payload.

    Raises:
        NotFoundError: If the target layout does not exist.
    """

    repo = SlotRepository(db)
    if not await repo.layout_exists(body.layout_id):
        raise NotFoundError("Layout not found")

    slot_id = str(uuid4())
    now = _utc_now_iso()
    doc: dict[str, Any] = {
        "_id": slot_id,
        "layout_id": body.layout_id,
        "position_key": body.position_key,
        "content_type": body.content_type,
        "display_name": body.display_name,
        "presentation_type": body.presentation_type,
        "pinned_ids": [],
        "query_rule": None,
        "order_index": body.order_index,
        "updated_at": now,
    }
    await repo.insert(doc)
    await repo.attach_to_layout(layout_id=body.layout_id, slot_id=slot_id, updated_at=now)
    await invalidate_homepage_for_layout(db, body.layout_id)
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="slot.create",
            resource_type="slot",
            resource_id=slot_id,
        )
    return _to_out(doc)


async def list_for_layout(db: AsyncIOMotorDatabase, layout_id: str) -> list[SlotOut]:
    """List slots for a layout in display order.

    Args:
        db: Database connection.
        layout_id: Layout id to query.

    Returns:
        Slot payloads for the layout.
    """

    repo = SlotRepository(db)
    docs = await repo.list_for_layout(layout_id)
    return [_to_out(doc) for doc in docs]


async def publish_draft_pins_for_layout(
    db: AsyncIOMotorDatabase,
    layout_id: str,
    *,
    actor_id: str | None = None,
) -> int:
    """Promote staged draft pins to live pins for all slots in a layout.

    Args:
        db: Database connection.
        layout_id: Layout id whose slots should be published.
        actor_id: Optional auditing actor id.

    Returns:
        Number of slots whose draft pins were published.
    """

    repo = SlotRepository(db)
    docs = await repo.list_for_layout(layout_id)
    now = _utc_now_iso()
    published_count = 0

    for doc in docs:
        if doc.get("draft_pinned_ids") is None:
            continue
        slot_id = str(doc["_id"])
        staged_article_ids = [
            article_id
            for article_id in (doc.get("draft_pinned_ids") or [])
            if article_id and str(article_id).strip()
        ]
        pinned_limit = _resolve_slot_pinned_limit(doc)
        live_pins = _clamp_pinned_ids(list(doc.get("draft_pinned_ids") or []), pinned_limit)
        updated = await repo.promote_draft_pins(
            slot_id,
            pinned_ids=live_pins,
            updated_at=now,
        )
        if updated is not None:
            published_count += 1
            await clear_placement_events(db, slot_id=slot_id, article_ids=staged_article_ids)

    if published_count > 0:
        await repo.touch_layout(layout_id, now)
        await invalidate_homepage_for_layout(db, layout_id)
        if actor_id:
            await write_event(
                db,
                user_id=actor_id,
                action="layout.publish_placements",
                resource_type="layout",
                resource_id=layout_id,
            )

    return published_count


async def update(
    db: AsyncIOMotorDatabase,
    *,
    slot_id: str,
    body: SlotUpdate,
    actor_id: str | None = None,
) -> SlotOut:
    """Update mutable slot fields.

    Args:
        db: Database connection.
        slot_id: Slot id to update.
        body: Partial update payload.
        actor_id: Optional auditing actor id.

    Returns:
        Updated slot payload.

    Raises:
        ValidationError: If no update fields are provided.
        NotFoundError: If the slot does not exist.
    """

    repo = SlotRepository(db)
    existing = await repo.find_by_id(slot_id)
    if existing is None:
        raise NotFoundError("Slot not found")

    update_doc = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_doc:
        raise ValidationError("No fields to update")

    if "pinned_ids" in update_doc:
        merged_slot = {**existing, **update_doc}
        pinned_limit = _resolve_slot_pinned_limit(merged_slot)
        update_doc["pinned_ids"] = _clamp_pinned_ids(
            list(update_doc["pinned_ids"] or []),
            pinned_limit,
        )

    if "draft_pinned_ids" in update_doc:
        merged_slot = {**existing, **update_doc}
        pinned_limit = _resolve_slot_pinned_limit(merged_slot)
        update_doc["draft_pinned_ids"] = _clamp_pinned_ids(
            list(update_doc["draft_pinned_ids"] or []),
            pinned_limit,
        )

    update_doc["updated_at"] = _utc_now_iso()

    doc = await repo.find_one_and_update(slot_id, update_doc)
    if doc is None:
        raise NotFoundError("Slot not found")
    await repo.touch_layout(str(doc["layout_id"]), update_doc["updated_at"])
    await _record_slot_placements(
        db,
        repo,
        slot_id=slot_id,
        layout_id=str(doc["layout_id"]),
        existing=existing,
        update_doc=update_doc,
    )
    if "pinned_ids" in update_doc:
        await invalidate_homepage_for_layout(db, str(doc["layout_id"]))
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="slot.update",
            resource_type="slot",
            resource_id=slot_id,
        )
    return _to_out(doc)


async def delete(
    db: AsyncIOMotorDatabase,
    *,
    slot_id: str,
    actor_id: str | None = None,
) -> None:
    """Delete a slot and detach it from its layout.

    Args:
        db: Database connection.
        slot_id: Slot id to delete.
        actor_id: Optional auditing actor id.

    Raises:
        NotFoundError: If the slot does not exist.
    """

    repo = SlotRepository(db)
    slot = await repo.find_by_id(slot_id)
    if slot is None:
        raise NotFoundError("Slot not found")

    layout_id = str(slot["layout_id"])
    now = _utc_now_iso()
    await repo.delete(slot_id)
    await repo.detach_from_layout(layout_id=layout_id, slot_id=slot_id, updated_at=now)
    await invalidate_homepage_for_layout(db, layout_id)
    if actor_id:
        await write_event(
            db,
            user_id=actor_id,
            action="slot.delete",
            resource_type="slot",
            resource_id=slot_id,
        )
