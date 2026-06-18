"""Helpers for resolving live vs draft slot pinned article ids."""

from __future__ import annotations

from typing import Any


def effective_pinned_ids_for_preview(slot: dict[str, Any]) -> list[str]:
    """Return draft pins when staged; otherwise live pins for preview reads.

    Args:
        slot: Slot document or layout-read slot dict.

    Returns:
        Pinned article ids to use when assembling editor preview feeds.
    """

    draft_pinned_ids = slot.get("draft_pinned_ids")
    if draft_pinned_ids is not None:
        return list(draft_pinned_ids)
    return list(slot.get("pinned_ids") or [])


def slot_with_preview_pins(slot: dict[str, Any]) -> dict[str, Any]:
    """Return a slot copy whose pinned_ids reflect staged editor placements.

    Args:
        slot: Slot document or layout-read slot dict.

    Returns:
        Slot dict suitable for preview feed resolution.
    """

    preview_slot = dict(slot)
    preview_slot["pinned_ids"] = effective_pinned_ids_for_preview(slot)
    return preview_slot
