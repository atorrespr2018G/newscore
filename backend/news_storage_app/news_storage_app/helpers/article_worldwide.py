"""Resolve worldwide vs explicit market targeting for articles."""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase

from news_storage_app.helpers.article_validation import _validate_market_ids
from shared.core.exceptions import ValidationError
from shared.core.worldwide import (
    effective_market_ids,
    list_market_ids,
    normalize_excluded_market_ids,
)


async def resolve_article_market_targeting(
    db: AsyncIOMotorDatabase,
    *,
    worldwide: bool,
    market_ids: list[str] | None,
    excluded_market_ids: list[str] | None,
) -> tuple[list[str], bool, list[str]]:
    """Resolve persisted market targeting for create/update.

    Worldwide stories target every market except exclusions. Explicit stories
    keep the provided ``market_ids`` and clear exclusions.

    Args:
        db: Database connection.
        worldwide: Whether the story is worldwide.
        market_ids: Explicit market ids (required when not worldwide).
        excluded_market_ids: Markets to leave out of a worldwide story.

    Returns:
        Tuple of ``(market_ids, worldwide, excluded_market_ids)``.

    Raises:
        ValidationError: If targeting is empty or ids are unknown.
    """

    exclusions = normalize_excluded_market_ids(excluded_market_ids)
    if worldwide:
        if exclusions:
            exclusions = await _validate_market_ids(db, exclusions)
        all_ids = await list_market_ids(db)
        resolved = effective_market_ids(all_ids, excluded_market_ids=exclusions)
        if not resolved:
            raise ValidationError("Worldwide targeting excluded every market")
        return resolved, True, exclusions

    if not market_ids:
        raise ValidationError("At least one market_id is required")
    validated = await _validate_market_ids(db, list(market_ids))
    return validated, False, []
