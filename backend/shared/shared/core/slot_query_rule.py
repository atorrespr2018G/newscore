"""Query-rule helpers for configuration-synced layout slots."""

from __future__ import annotations

from typing import Any


def query_rule_for_config_slot(
    *,
    limit: int,
    existing: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build a slot query_rule for sports/homepage configuration sync.

    Newly created slots are pin-only (limit only) so Placement starts empty when
    editors add a section. Existing slots keep a prior ``category_id`` so seeded
    boards that already auto-fill continue to work.

    Args:
        limit: Maximum articles for the slot.
        existing: Existing slot document, or None when inserting.

    Returns:
        Query rule payload to persist on the slot.
    """

    query_rule: dict[str, Any] = {"limit": limit}
    if existing is None:
        return query_rule
    previous = (existing.get("query_rule") or {}).get("category_id")
    if previous:
        query_rule["category_id"] = str(previous)
    return query_rule
