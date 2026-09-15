"""Landing-page enablement with parent-to-child geo inheritance.

A page disabled at a country (USA or Puerto Rico) is hidden for every state,
county, and town under that country. A state disable covers that state and its
counties only. A town or county disable applies to that locality alone.
Children cannot override a parent disable.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.page_ad_placements import (
    PAGE_NAME_BUSINESS,
    PAGE_NAME_ENTERTAINMENT,
    PAGE_NAME_GOVERNMENT,
    PAGE_NAME_HEALTH,
    PAGE_NAME_HOMEPAGE,
    PAGE_NAME_SPORTS,
    PAGE_NAME_TECHNOLOGY,
    PAGE_NAME_WORLD,
)
from shared.core.regions import REGIONS_COLLECTION, get_ancestor_chain

PAGE_VISIBILITY_COLLECTION = "page_visibility"
CUSTOM_TABS_COLLECTION = "custom_tabs"

IS_ENABLED_FIELD = "is_enabled"

BUILTIN_DISABLEABLE_PAGE_NAMES: frozenset[str] = frozenset(
    {
        PAGE_NAME_WORLD,
        PAGE_NAME_SPORTS,
        PAGE_NAME_GOVERNMENT,
        PAGE_NAME_ENTERTAINMENT,
        PAGE_NAME_HEALTH,
        PAGE_NAME_BUSINESS,
        PAGE_NAME_TECHNOLOGY,
    },
)

ScopeKey = Optional[str]


@dataclass(frozen=True)
class PageVisibility:
    """Local flag plus effective enablement after walking ancestors."""

    local_enabled: bool
    effectively_enabled: bool
    disabled_by_region_code: str | None

    @property
    def inherited(self) -> bool:
        """True when a parent geo disabled the page while this scope is on."""

        return (not self.effectively_enabled) and self.local_enabled


def local_enabled_from_doc(doc: dict[str, Any] | None) -> bool:
    """Return the stored enable flag; missing docs default to enabled.

    Args:
        doc: Page-visibility document or None when unset.

    Returns:
        False only when the document explicitly stores ``is_enabled=False``.
    """

    if doc is None:
        return True
    return bool(doc.get(IS_ENABLED_FIELD, True))


def normalize_page_name(page_name: str) -> str:
    """Normalize a layout page name for visibility storage.

    Args:
        page_name: Raw page name such as ``Sports``.

    Returns:
        Lowercased trimmed page name.
    """

    return (page_name or "").strip().lower()


def docs_for_page(
    docs: list[dict[str, Any]],
    page_name: str,
) -> dict[ScopeKey, dict[str, Any]]:
    """Index visibility docs for one page by region id (None = market-level).

    Args:
        docs: Visibility documents for a market scope chain.
        page_name: Normalized layout page name.

    Returns:
        Mapping of region id to the visibility document for ``page_name``.
    """

    indexed: dict[ScopeKey, dict[str, Any]] = {}
    normalized = normalize_page_name(page_name)
    for doc in docs:
        if normalize_page_name(str(doc.get("page_name") or "")) != normalized:
            continue
        region_id = doc.get("region_id")
        key: ScopeKey = None if region_id is None else str(region_id)
        indexed[key] = doc
    return indexed


def visibility_from_chain(
    *,
    docs_by_scope: dict[ScopeKey, dict[str, Any]],
    chain_scopes: list[tuple[ScopeKey, str | None]],
) -> PageVisibility:
    """Compute enablement by walking self, then ancestors, then market-level.

    The first explicit disable in that walk wins. A child cannot re-enable a
    page that a parent geo has turned off.

    Args:
        docs_by_scope: Visibility docs keyed by region id.
        chain_scopes: ``(region_id, region_code)`` pairs, self first.

    Returns:
        Local flag, effective flag, and the geo code that disabled the page.
    """

    local_key = chain_scopes[0][0] if chain_scopes else None
    local_enabled = local_enabled_from_doc(docs_by_scope.get(local_key))
    for region_id, region_code in chain_scopes:
        if local_enabled_from_doc(docs_by_scope.get(region_id)):
            continue
        return PageVisibility(
            local_enabled=local_enabled,
            effectively_enabled=False,
            disabled_by_region_code=region_code,
        )
    return PageVisibility(
        local_enabled=local_enabled,
        effectively_enabled=True,
        disabled_by_region_code=None,
    )


def visibility_docs_query(
    *,
    market_id: str,
    chain_ids: list[ScopeKey],
) -> dict[str, Any]:
    """Mongo filter for visibility docs on a self-to-market scope chain.

    Args:
        market_id: Market document id.
        chain_ids: Region ids in the ancestor walk, including ``None``.

    Returns:
        Query matching this market and any chain region (or market-level null).
    """

    region_ids = [region_id for region_id in chain_ids if region_id is not None]
    clauses: list[dict[str, Any]] = []
    if region_ids:
        clauses.append({"region_id": {"$in": region_ids}})
    if any(region_id is None for region_id in chain_ids):
        clauses.append({"region_id": None})
        clauses.append({"region_id": {"$exists": False}})
    if not clauses:
        return {"market_id": market_id}
    return {"market_id": market_id, "$or": clauses}


async def visibility_chain(
    db: AsyncIOMotorDatabase,
    *,
    region_id: str | None,
    market_code: str,
) -> list[tuple[ScopeKey, str | None]]:
    """Build the disable walk: self → ancestors → market-level null.

    Args:
        db: Database connection.
        region_id: Active region document id, or None for market-level.
        market_code: Market short code used as the market-level label.

    Returns:
        Scope pairs used by ``visibility_from_chain``.
    """

    if not region_id:
        return [(None, market_code)]
    chain = await get_ancestor_chain(db, region_id)
    scopes = [
        (str(doc["_id"]), str(doc.get("code") or "").strip().lower() or None)
        for doc in chain
    ]
    scopes.append((None, market_code))
    return scopes


async def load_visibility_docs(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    chain_ids: list[ScopeKey],
) -> list[dict[str, Any]]:
    """Load visibility documents that could affect the current geo.

    Args:
        db: Database connection.
        market_id: Market document id.
        chain_ids: Region ids from ``visibility_chain``.

    Returns:
        Matching page-visibility documents.
    """

    cursor = db[PAGE_VISIBILITY_COLLECTION].find(
        visibility_docs_query(market_id=market_id, chain_ids=chain_ids),
    )
    return [doc async for doc in cursor]


async def candidate_page_names(
    db: AsyncIOMotorDatabase,
    market_code: str,
) -> list[str]:
    """Built-in landings plus custom tab slugs registered for the market.

    Args:
        db: Database connection.
        market_code: Market short code such as ``us``.

    Returns:
        Page names that Configuration can disable.
    """

    names = list(BUILTIN_DISABLEABLE_PAGE_NAMES)
    cursor = db[CUSTOM_TABS_COLLECTION].find(
        {"market_code": market_code.strip().lower()},
        {"slug": 1},
    )
    async for tab in cursor:
        slug = normalize_page_name(str(tab.get("slug") or ""))
        if slug and slug not in names:
            names.append(slug)
    return names


def disabled_page_names_from_docs(
    *,
    docs: list[dict[str, Any]],
    chain_scopes: list[tuple[ScopeKey, str | None]],
    page_names: list[str],
) -> list[str]:
    """Return page names that are effectively disabled for this geo.

    Args:
        docs: Visibility documents for the scope chain.
        chain_scopes: Self-to-market scope pairs.
        page_names: Candidate landing page names.

    Returns:
        Sorted unique page names that should be hidden.
    """

    disabled: list[str] = []
    for page_name in page_names:
        visibility = visibility_from_chain(
            docs_by_scope=docs_for_page(docs, page_name),
            chain_scopes=chain_scopes,
        )
        if not visibility.effectively_enabled:
            disabled.append(page_name)
    return disabled


async def resolve_page_visibility(
    db: AsyncIOMotorDatabase,
    *,
    page_name: str,
    market_id: str,
    market_code: str,
    region_id: str | None,
) -> PageVisibility:
    """Resolve local and effective enablement for one page at one geo.

    Args:
        db: Database connection.
        page_name: Layout page name such as ``sports``.
        market_id: Market document id.
        market_code: Market short code.
        region_id: Active region id, or None for market-level.

    Returns:
        Visibility flags for the requested page.
    """

    chain = await visibility_chain(db, region_id=region_id, market_code=market_code)
    docs = await load_visibility_docs(
        db,
        market_id=market_id,
        chain_ids=[scope[0] for scope in chain],
    )
    return visibility_from_chain(
        docs_by_scope=docs_for_page(docs, page_name),
        chain_scopes=chain,
    )


async def resolve_feed_visibility(
    db: AsyncIOMotorDatabase,
    *,
    page_name: str,
    market_id: str,
    market_code: str,
    region_id: str | None,
) -> dict[str, Any]:
    """Build GraphQL visibility fields for a public page feed.

    Args:
        db: Database connection.
        page_name: Feed page name (homepage is always enabled).
        market_id: Market document id.
        market_code: Market short code.
        region_id: Active region id, or None for market-level.

    Returns:
        Dict with ``is_enabled`` and ``disabled_page_names``.
    """

    chain = await visibility_chain(db, region_id=region_id, market_code=market_code)
    docs = await load_visibility_docs(
        db,
        market_id=market_id,
        chain_ids=[scope[0] for scope in chain],
    )
    names = await candidate_page_names(db, market_code)
    disabled = disabled_page_names_from_docs(
        docs=docs,
        chain_scopes=chain,
        page_names=names,
    )
    normalized = normalize_page_name(page_name)
    if normalized == PAGE_NAME_HOMEPAGE:
        return {"is_enabled": True, "disabled_page_names": disabled}
    return {
        "is_enabled": normalized not in disabled,
        "disabled_page_names": disabled,
    }


async def descendant_region_codes(
    db: AsyncIOMotorDatabase,
    region_id: str,
) -> list[str]:
    """Region codes for a node and every active descendant.

    Args:
        db: Database connection.
        region_id: Region document id that roots the subtree.

    Returns:
        Normalized region codes to invalidate after a visibility change.
    """

    cursor = db[REGIONS_COLLECTION].find(
        {
            "is_active": True,
            "$or": [{"_id": region_id}, {"ancestor_ids": region_id}],
        },
        {"code": 1},
    )
    codes: list[str] = []
    async for doc in cursor:
        code = str(doc.get("code") or "").strip().lower()
        if code:
            codes.append(code)
    return codes
