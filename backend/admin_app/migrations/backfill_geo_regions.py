"""Backfill regions and region-targeting fields.

Scope for initial rollout:
- world -> us -> us-fl -> florida counties
- world -> pr -> pr municipalities
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from shared.core.regions import effective_region_ids

REGIONS_COLLECTION = "regions"
MARKETS_COLLECTION = "markets"
ARTICLES_COLLECTION = "articles"
LAYOUTS_COLLECTION = "layouts"

FLORIDA_COUNTIES: tuple[tuple[str, str], ...] = (
    ("miami-dade", "Miami-Dade"),
    ("broward", "Broward"),
    ("palm-beach", "Palm Beach"),
    ("orange", "Orange"),
    ("hillsborough", "Hillsborough"),
)


@dataclass
class BackfillStats:
    regions_created: int = 0
    region_nodes_total: int = 0
    articles_scanned: int = 0
    articles_updated: int = 0
    layouts_scanned: int = 0
    layouts_updated: int = 0
    unresolved_market_ids: int = 0
    unresolved_town_ids: int = 0


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def _mongo_uri() -> str:
    value = os.getenv("MONGO_URI")
    if not value:
        raise RuntimeError("Missing MONGO_URI")
    return value


def _mongo_db_name() -> str:
    value = os.getenv("MONGO_DB_NAME")
    if not value:
        raise RuntimeError("Missing MONGO_DB_NAME")
    return value


async def _ensure_region(
    db: AsyncIOMotorDatabase,
    *,
    code: str,
    name: str,
    kind: str,
    parent_id: str | None,
    country_code: str | None,
    default_locale: str,
    labels: dict[str, str],
    stats: BackfillStats,
    dry_run: bool,
) -> str:
    existing = await db[REGIONS_COLLECTION].find_one({"code": code}, {"_id": 1})
    if existing is not None:
        return str(existing["_id"])

    parent: dict[str, Any] | None = None
    if parent_id:
        parent = await db[REGIONS_COLLECTION].find_one({"_id": parent_id})
        if parent is None:
            raise RuntimeError(f"Missing parent region id {parent_id} for code {code}")

    ancestor_ids = list(parent.get("ancestor_ids") or []) if parent else []
    if parent:
        ancestor_ids.append(str(parent["_id"]))
    path = f"{str(parent['path']).strip('/')}/{code}" if parent else code
    now = _utc_now_iso()
    doc = {
        "_id": str(uuid4()),
        "code": code,
        "name": name,
        "kind": kind,
        "parent_id": parent_id,
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
    if not dry_run:
        await db[REGIONS_COLLECTION].insert_one(doc)
    stats.regions_created += 1
    return str(doc["_id"])


async def _ensure_initial_region_tree(
    db: AsyncIOMotorDatabase,
    *,
    dry_run: bool,
    stats: BackfillStats,
) -> dict[str, str]:
    ids: dict[str, str] = {}

    ids["world"] = await _ensure_region(
        db,
        code="world",
        name="World",
        kind="world",
        parent_id=None,
        country_code=None,
        default_locale="en-US",
        labels={"en": "World", "es": "Mundo"},
        stats=stats,
        dry_run=dry_run,
    )

    ids["us"] = await _ensure_region(
        db,
        code="us",
        name="United States",
        kind="country",
        parent_id=ids["world"],
        country_code="us",
        default_locale="en-US",
        labels={"en": "United States", "es": "Estados Unidos"},
        stats=stats,
        dry_run=dry_run,
    )

    ids["pr"] = await _ensure_region(
        db,
        code="pr",
        name="Puerto Rico",
        kind="country",
        parent_id=ids["world"],
        country_code="pr",
        default_locale="es-PR",
        labels={"en": "Puerto Rico", "es": "Puerto Rico"},
        stats=stats,
        dry_run=dry_run,
    )

    ids["us-fl"] = await _ensure_region(
        db,
        code="us-fl",
        name="Florida",
        kind="state",
        parent_id=ids["us"],
        country_code="us",
        default_locale="en-US",
        labels={"en": "Florida", "es": "Florida"},
        stats=stats,
        dry_run=dry_run,
    )

    for slug, label in FLORIDA_COUNTIES:
        code = f"us-fl-{slug}"
        ids[code] = await _ensure_region(
            db,
            code=code,
            name=f"{label} County",
            kind="county",
            parent_id=ids["us-fl"],
            country_code="us",
            default_locale="en-US",
            labels={"en": f"{label} County", "es": f"Condado de {label}"},
            stats=stats,
            dry_run=dry_run,
        )

    return ids


async def _ensure_pr_municipality_regions(
    db: AsyncIOMotorDatabase,
    *,
    parent_id: str,
    dry_run: bool,
    stats: BackfillStats,
) -> dict[str, str]:
    mapping: dict[str, str] = {}
    town_ids = await db[ARTICLES_COLLECTION].distinct("town_id", {"town_id": {"$ne": None}})
    for raw_town in town_ids:
        town = _norm(str(raw_town))
        if not town:
            continue
        code = f"pr-{town}"
        label = town.replace("-", " ").title()
        mapping[town] = await _ensure_region(
            db,
            code=code,
            name=label,
            kind="municipality",
            parent_id=parent_id,
            country_code="pr",
            default_locale="es-PR",
            labels={"en": label, "es": label},
            stats=stats,
            dry_run=dry_run,
        )
    return mapping


async def _market_code_to_region_id(db: AsyncIOMotorDatabase) -> dict[str, str]:
    market_docs = db[MARKETS_COLLECTION].find({}, {"_id": 1, "code": 1})
    region_docs = db[REGIONS_COLLECTION].find({}, {"_id": 1, "code": 1})
    region_by_code = {_norm(str(doc.get("code") or "")): str(doc["_id"]) async for doc in region_docs}
    mapping: dict[str, str] = {}
    async for market in market_docs:
        code = _norm(str(market.get("code") or ""))
        if code and code in region_by_code:
            mapping[str(market["_id"])] = region_by_code[code]
    return mapping


async def _town_to_region_id(db: AsyncIOMotorDatabase) -> dict[str, str]:
    region_docs = db[REGIONS_COLLECTION].find({"kind": "municipality"}, {"_id": 1, "code": 1})
    mapping: dict[str, str] = {}
    async for doc in region_docs:
        code = _norm(str(doc.get("code") or ""))
        if code.startswith("pr-"):
            mapping[code[3:]] = str(doc["_id"])
    return mapping


async def _backfill_articles(
    db: AsyncIOMotorDatabase,
    *,
    dry_run: bool,
    stats: BackfillStats,
) -> None:
    market_to_region = await _market_code_to_region_id(db)
    town_to_region = await _town_to_region_id(db)

    cursor = db[ARTICLES_COLLECTION].find({})
    async for doc in cursor:
        stats.articles_scanned += 1
        direct_region_ids: list[str] = []

        for market_id in [str(mid) for mid in (doc.get("market_ids") or []) if str(mid).strip()]:
            region_id = market_to_region.get(market_id)
            if region_id:
                direct_region_ids.append(region_id)
            else:
                stats.unresolved_market_ids += 1

        town_id = _norm(str(doc.get("town_id") or ""))
        if town_id:
            town_region_id = town_to_region.get(town_id)
            if town_region_id:
                direct_region_ids.append(town_region_id)
            else:
                stats.unresolved_town_ids += 1

        deduped_direct: list[str] = []
        seen: set[str] = set()
        for region_id in direct_region_ids:
            if region_id not in seen:
                seen.add(region_id)
                deduped_direct.append(region_id)

        effective_ids = await effective_region_ids(
            db,
            direct_region_ids=deduped_direct,
            visibility_mode="upward_only",
        )
        primary_region_id = deduped_direct[0] if deduped_direct else None

        update_doc = {
            "direct_region_ids": deduped_direct,
            "effective_region_ids": effective_ids,
            "region_visibility_mode": "upward_only",
            "primary_region_id": primary_region_id,
            "updated_at": _utc_now_iso(),
        }

        if not dry_run:
            await db[ARTICLES_COLLECTION].update_one({"_id": doc["_id"]}, {"$set": update_doc})
        stats.articles_updated += 1


async def _backfill_layouts(
    db: AsyncIOMotorDatabase,
    *,
    dry_run: bool,
    stats: BackfillStats,
) -> None:
    market_to_region = await _market_code_to_region_id(db)
    cursor = db[LAYOUTS_COLLECTION].find({})
    async for doc in cursor:
        stats.layouts_scanned += 1
        market_id = str(doc.get("market_id") or "")
        region_id = market_to_region.get(market_id)
        if not region_id:
            continue
        if not dry_run:
            await db[LAYOUTS_COLLECTION].update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "region_id": region_id,
                        "scope_mode": str(doc.get("scope_mode") or "exact"),
                        "updated_at": _utc_now_iso(),
                    }
                },
            )
        stats.layouts_updated += 1


async def _collect_reconciliation(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    active_articles = await db[ARTICLES_COLLECTION].count_documents({"status": "published"})
    articles_with_effective = await db[ARTICLES_COLLECTION].count_documents(
        {"status": "published", "effective_region_ids.0": {"$exists": True}}
    )
    active_layouts = await db[LAYOUTS_COLLECTION].count_documents({"is_active": True})
    layouts_with_region = await db[LAYOUTS_COLLECTION].count_documents(
        {"is_active": True, "region_id": {"$exists": True, "$ne": None}}
    )
    region_total = await db[REGIONS_COLLECTION].count_documents({})

    return {
        "active_articles": active_articles,
        "articles_with_effective_region_ids": articles_with_effective,
        "active_layouts": active_layouts,
        "layouts_with_region_id": layouts_with_region,
        "regions_total": region_total,
    }


async def run_backfill(*, dry_run: bool, report_path: Path) -> dict[str, Any]:
    client = AsyncIOMotorClient(_mongo_uri())
    stats = BackfillStats()
    try:
        db = client[_mongo_db_name()]
        region_ids = await _ensure_initial_region_tree(db, dry_run=dry_run, stats=stats)
        await _ensure_pr_municipality_regions(
            db,
            parent_id=region_ids["pr"],
            dry_run=dry_run,
            stats=stats,
        )

        stats.region_nodes_total = await db[REGIONS_COLLECTION].count_documents({}) + (
            stats.regions_created if dry_run else 0
        )

        await _backfill_articles(db, dry_run=dry_run, stats=stats)
        await _backfill_layouts(db, dry_run=dry_run, stats=stats)

        reconciliation = await _collect_reconciliation(db)
    finally:
        client.close()

    report = {
        "generated_at": _utc_now_iso(),
        "dry_run": dry_run,
        "scope": {
            "top_level": ["us", "pr"],
            "us_state": "fl",
            "pr_children_kind": "municipality",
        },
        "stats": {
            "regions_created": stats.regions_created,
            "region_nodes_total": stats.region_nodes_total,
            "articles_scanned": stats.articles_scanned,
            "articles_updated": stats.articles_updated,
            "layouts_scanned": stats.layouts_scanned,
            "layouts_updated": stats.layouts_updated,
            "unresolved_market_ids": stats.unresolved_market_ids,
            "unresolved_town_ids": stats.unresolved_town_ids,
        },
        "reconciliation": reconciliation,
    }

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill geo regions and region targeting fields.")
    parser.add_argument("--dry-run", action="store_true", help="Compute changes without writing to MongoDB.")
    parser.add_argument(
        "--report",
        default="backend/admin_app/migrations/reports/geo_reconciliation.json",
        help="Path for JSON reconciliation report.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    import asyncio

    args = _parse_args()
    result = asyncio.run(run_backfill(dry_run=bool(args.dry_run), report_path=Path(args.report)))
    print(json.dumps(result, indent=2))
