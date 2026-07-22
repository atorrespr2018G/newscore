"""Ensure exact region-owned layouts for editorial placement boards."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.geo_catalog import (
    CURATED_LAYOUT_PAGE_NAMES,
    FLORIDA_COUNTY_OPTIONS,
    PUERTO_RICO_TOWN_OPTIONS,
    US_STATE_OPTIONS,
)

REGIONS_COLLECTION = "regions"
MARKETS_COLLECTION = "markets"
LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"


def _utc_now_iso() -> str:
    """Return an ISO-8601 UTC timestamp."""

    return datetime.now(timezone.utc).isoformat()


def _norm(value: str | None) -> str:
    """Normalize a code-like string."""

    return (value or "").strip().lower()


async def ensure_region_document(
    db: AsyncIOMotorDatabase,
    *,
    code: str,
    name: str,
    kind: str,
    parent_code: str | None,
    country_code: str | None,
    default_locale: str,
    labels: dict[str, str],
) -> str:
    """Create an active region when missing and return its document id.

    Args:
        db: Database connection.
        code: Canonical region code such as ``pr-adjuntas``.
        name: Display name.
        kind: Region kind (country, state, county, municipality).
        parent_code: Parent region code, or None for roots.
        country_code: Market/country code for layout ownership.
        default_locale: Default locale for the region.
        labels: Localized display labels.

    Returns:
        Region document id.

    Raises:
        RuntimeError: If a required parent region is missing.
    """

    existing = await db[REGIONS_COLLECTION].find_one({"code": code}, {"_id": 1})
    if existing is not None:
        return str(existing["_id"])

    parent: dict[str, Any] | None = None
    if parent_code:
        parent = await db[REGIONS_COLLECTION].find_one(
            {"code": parent_code},
            {"_id": 1, "ancestor_ids": 1, "path": 1},
        )
        if parent is None:
            raise RuntimeError(f"Missing parent region {parent_code} while creating {code}")

    ancestor_ids = list(parent.get("ancestor_ids") or []) if parent else []
    if parent is not None:
        ancestor_ids.append(str(parent["_id"]))
    path = f"{str(parent['path']).strip('/')}/{code}" if parent else code
    now = _utc_now_iso()
    doc = {
        "_id": str(uuid4()),
        "code": code,
        "name": name,
        "kind": kind,
        "parent_id": str(parent["_id"]) if parent else None,
        "ancestor_ids": ancestor_ids,
        "depth": len(ancestor_ids),
        "path": path,
        "country_code": country_code,
        "is_active": True,
        "default_locale": default_locale,
        "labels": labels,
        "created_at": now,
        "updated_at": now,
    }
    await db[REGIONS_COLLECTION].insert_one(doc)
    return str(doc["_id"])


async def _find_source_layout(
    db: AsyncIOMotorDatabase,
    *,
    target_region_id: str,
    market_id: str,
    page_name: str,
) -> dict[str, Any] | None:
    """Find nearest ancestor or market layout to clone slot structure from."""

    region = await db[REGIONS_COLLECTION].find_one({"_id": target_region_id}, {"ancestor_ids": 1})
    if region is None:
        return None

    for ancestor_id in reversed(list(region.get("ancestor_ids") or [])):
        layout = await db[LAYOUTS_COLLECTION].find_one(
            {
                "page_name": page_name,
                "region_id": str(ancestor_id),
                "is_active": True,
            },
        )
        if layout is not None:
            return layout

    return await db[LAYOUTS_COLLECTION].find_one(
        {
            "page_name": page_name,
            "market_id": market_id,
            "is_active": True,
        },
    )


async def _clone_empty_slots(
    db: AsyncIOMotorDatabase,
    *,
    source_layout_id: str,
    target_layout_id: str,
) -> list[str]:
    """Clone slot structure without copying pins so boards stay independent."""

    cursor = db[SLOTS_COLLECTION].find({"layout_id": source_layout_id})
    slots = [slot async for slot in cursor]
    slots.sort(key=lambda slot: int(slot.get("order_index") or 0))

    now = _utc_now_iso()
    slot_ids: list[str] = []
    for slot in slots:
        slot_id = str(uuid4())
        slot_ids.append(slot_id)
        await db[SLOTS_COLLECTION].insert_one(
            {
                "_id": slot_id,
                "layout_id": target_layout_id,
                "position_key": slot.get("position_key"),
                "content_type": slot.get("content_type"),
                "display_name": slot.get("display_name"),
                "presentation_type": slot.get("presentation_type") or "grid_4",
                "pinned_ids": [],
                "query_rule": slot.get("query_rule"),
                "order_index": int(slot.get("order_index") or 0),
                "updated_at": now,
            },
        )
    return slot_ids


async def find_exact_page_layout(
    db: AsyncIOMotorDatabase,
    *,
    region_id: str,
    page_name: str,
) -> dict[str, Any] | None:
    """Return the active layout owned exactly by ``region_id``, if any."""

    return await db[LAYOUTS_COLLECTION].find_one(
        {
            "page_name": page_name,
            "region_id": region_id,
            "is_active": True,
        },
    )


async def ensure_exact_page_layout(
    db: AsyncIOMotorDatabase,
    *,
    region_id: str,
    page_name: str = "homepage",
) -> str | None:
    """Ensure an exact region-owned layout exists for the page.

    Creates a cloned slot board with empty pins when missing. Does not reuse an
    ancestor layout as the write target.

    Args:
        db: Database connection.
        region_id: Region document id that must own the layout.
        page_name: Layout page such as ``homepage`` or ``world``.

    Returns:
        Layout id when ensured or already present, else None when no source.
    """

    normalized_page = page_name.strip().lower() or "homepage"
    existing = await find_exact_page_layout(db, region_id=region_id, page_name=normalized_page)
    if existing is not None:
        return str(existing["_id"])

    region = await db[REGIONS_COLLECTION].find_one(
        {"_id": region_id, "is_active": True},
        {"_id": 1, "country_code": 1},
    )
    if region is None:
        return None

    market_code = _norm(str(region.get("country_code") or ""))
    market = await db[MARKETS_COLLECTION].find_one({"code": market_code}, {"_id": 1})
    if market is None:
        return None

    source_layout = await _find_source_layout(
        db,
        target_region_id=region_id,
        market_id=str(market["_id"]),
        page_name=normalized_page,
    )
    if source_layout is None:
        return None

    new_layout_id = str(uuid4())
    slot_ids = await _clone_empty_slots(
        db,
        source_layout_id=str(source_layout["_id"]),
        target_layout_id=new_layout_id,
    )
    await db[LAYOUTS_COLLECTION].insert_one(
        {
            "_id": new_layout_id,
            "page_name": normalized_page,
            "market_id": str(market["_id"]),
            "region_id": region_id,
            "scope_mode": "exact",
            "inherit_depth_limit": None,
            "slot_ids": slot_ids,
            "is_active": True,
            "updated_at": _utc_now_iso(),
        },
    )
    return new_layout_id


async def ensure_exact_page_layout_by_code(
    db: AsyncIOMotorDatabase,
    *,
    region_code: str,
    page_name: str = "homepage",
) -> str | None:
    """Ensure an exact layout for a region code."""

    region = await db[REGIONS_COLLECTION].find_one(
        {"code": _norm(region_code), "is_active": True},
        {"_id": 1},
    )
    if region is None:
        return None
    return await ensure_exact_page_layout(
        db,
        region_id=str(region["_id"]),
        page_name=page_name,
    )


async def _ensure_root_regions(db: AsyncIOMotorDatabase) -> None:
    """Ensure world, US, and Puerto Rico country regions exist."""

    await ensure_region_document(
        db,
        code="world",
        name="World",
        kind="world",
        parent_code=None,
        country_code=None,
        default_locale="en-US",
        labels={"en": "World", "es": "Mundo"},
    )
    await ensure_region_document(
        db,
        code="us",
        name="United States",
        kind="country",
        parent_code="world",
        country_code="us",
        default_locale="en-US",
        labels={"en": "United States", "es": "Estados Unidos"},
    )
    await ensure_region_document(
        db,
        code="pr",
        name="Puerto Rico",
        kind="country",
        parent_code="world",
        country_code="pr",
        default_locale="es-PR",
        labels={"en": "Puerto Rico", "es": "Puerto Rico"},
    )


async def _ensure_us_state_regions(db: AsyncIOMotorDatabase) -> list[str]:
    """Ensure all US state regions and return their codes."""

    codes: list[str] = ["us"]
    for state_code, label in US_STATE_OPTIONS:
        code = f"us-{state_code}"
        await ensure_region_document(
            db,
            code=code,
            name=label,
            kind="state",
            parent_code="us",
            country_code="us",
            default_locale="en-US",
            labels={"en": label, "es": label},
        )
        codes.append(code)
    return codes


async def _ensure_florida_county_regions(db: AsyncIOMotorDatabase) -> list[str]:
    """Ensure all Florida county regions and return their codes."""

    codes: list[str] = []
    for county_slug, label in FLORIDA_COUNTY_OPTIONS:
        code = f"us-fl-{county_slug}"
        await ensure_region_document(
            db,
            code=code,
            name=f"{label} County",
            kind="county",
            parent_code="us-fl",
            country_code="us",
            default_locale="en-US",
            labels={"en": f"{label} County", "es": f"Condado de {label}"},
        )
        codes.append(code)
    return codes


async def _ensure_pr_town_regions(db: AsyncIOMotorDatabase) -> list[str]:
    """Ensure all Puerto Rico municipality regions and return their codes."""

    codes: list[str] = ["pr"]
    for town_slug, label in PUERTO_RICO_TOWN_OPTIONS:
        code = f"pr-{town_slug}"
        await ensure_region_document(
            db,
            code=code,
            name=label,
            kind="municipality",
            parent_code="pr",
            country_code="pr",
            default_locale="es-PR",
            labels={"en": label, "es": label},
        )
        codes.append(code)
    return codes


async def ensure_us_pr_geo_layouts(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    """Ensure regions and exact layouts for US/PR countries, states, counties, towns.

    Args:
        db: Database connection.

    Returns:
        Summary of region codes and created/existing layout ids by page.
    """

    await _ensure_root_regions(db)
    region_codes = await _ensure_us_state_regions(db)
    region_codes.extend(await _ensure_florida_county_regions(db))
    region_codes.extend(await _ensure_pr_town_regions(db))
    # Preserve order while dropping duplicates from overlapping lists.
    unique_codes = list(dict.fromkeys(region_codes))

    layouts_by_page: dict[str, dict[str, str | None]] = {}
    for page_name in CURATED_LAYOUT_PAGE_NAMES:
        page_layouts: dict[str, str | None] = {}
        for code in unique_codes:
            page_layouts[code] = await ensure_exact_page_layout_by_code(
                db,
                region_code=code,
                page_name=page_name,
            )
        layouts_by_page[page_name] = page_layouts

    return {
        "status": "ok",
        "region_codes": unique_codes,
        "layout_ids_by_page": layouts_by_page,
    }
