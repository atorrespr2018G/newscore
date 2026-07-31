"""Helpers for composing article Mongo queries used by feed and placement reads."""

from __future__ import annotations

from typing import Any


def article_query_with_category(
    base_query: dict[str, Any],
    *,
    category_id: str | None,
    excluded_ids: set[str] | None = None,
) -> dict[str, Any]:
    """Merge a published-scope query with category and exclusion filters.

    Category matching uses ``$and`` so it cannot overwrite a scope ``$or`` already
    present on ``base_query`` (region tags / market fallback).

    Args:
        base_query: Published article scope filter (market and/or region).
        category_id: Optional category id to require.
        excluded_ids: Article ids to omit (usually already pinned).

    Returns:
        Mongo filter ready for ``find``.
    """

    query: dict[str, Any] = dict(base_query)
    if excluded_ids:
        query["_id"] = {"$nin": list(excluded_ids)}
    if not category_id:
        return query
    category_match = {
        "$or": [
            {"category_id": category_id},
            {"category_ids": category_id},
        ],
    }
    return {"$and": [query, category_match]}
