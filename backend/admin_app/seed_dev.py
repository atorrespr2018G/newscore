"""Seed development data for NewsCore.

Creates admin user, categories, per-market articles, layouts, slots, and breaking widgets.

Run inside Docker:
    docker compose exec admin_app python seed_dev.py
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from admin_app.helpers.password_helpers import hash_password
from shared.core.indexes import ensure_indexes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

USERS_COLLECTION = "users"
CATEGORIES_COLLECTION = "categories"
MARKETS_COLLECTION = "markets"
ARTICLES_COLLECTION = "articles"
LAYOUTS_COLLECTION = "layouts"
SLOTS_COLLECTION = "slots"
WIDGETS_COLLECTION = "widgets"

CNN_CATEGORIES: list[dict[str, str]] = [
    {"name": "US", "slug": "us", "description": "United States news and politics."},
    {"name": "World", "slug": "world", "description": "Global headlines and analysis."},
    {"name": "Politics", "slug": "politics", "description": "Policy, elections, and government."},
    {"name": "Business", "slug": "business", "description": "Markets, companies, and the economy."},
    {"name": "Health", "slug": "health", "description": "Wellness, medicine, and public health."},
    {"name": "Entertainment", "slug": "entertainment", "description": "Culture, TV, film, and celebrity."},
    {"name": "Style", "slug": "style", "description": "Fashion, design, and living."},
    {"name": "Travel", "slug": "travel", "description": "Destinations, tips, and aviation."},
    {"name": "Sports", "slug": "sports", "description": "Scores, leagues, and athletes."},
]

US_ARTICLE_TITLES: dict[str, list[str]] = {
    "us": [
        "Congress faces deadline on budget standoff",
        "Major cities roll out new transit safety plans",
        "Supreme Court to hear landmark digital privacy case",
        "Senate prepares overnight vote on stopgap funding bill",
        "Agencies issue shutdown guidance as deadline nears",
        "Budget negotiators trade final offers before cutoff",
    ],
    "world": [
        "Markets rally as inflation cools",
        "New satellite images reveal rapid glacier retreat",
        "Storm system causes major travel disruptions",
    ],
    "politics": [
        "Election season begins with tight early polling",
        "White House outlines new foreign policy framework",
        "Campaign finance filings show record fundraising",
    ],
    "business": [
        "Tech leaders announce open safety framework",
        "Central bank signals cautious rate path ahead",
        "Retail giants report mixed quarterly earnings",
    ],
    "health": [
        "Study links screen time to sleep disruption in teens",
        "FDA panel reviews next-generation vaccine candidates",
        "Hospitals expand mental health access programs",
    ],
    "entertainment": [
        "Streaming platform greenlights high-profile drama series",
        "Award show ratings rebound with live format",
        "Studio merger reshapes summer release calendar",
    ],
    "style": [
        "Design week spotlights sustainable materials",
        "Luxury brands lean into quiet luxury trend",
        "Home editors share small-space makeover ideas",
    ],
    "travel": [
        "Airlines add routes as international demand surges",
        "National parks set new visitor capacity rules",
        "Cruise industry unveils carbon-reduction targets",
    ],
    "sports": [
        "Championship race goes to final lap thriller",
        "Star player signs record-breaking extension",
        "Olympic committee confirms venue shortlist",
    ],
}

CO_ARTICLE_TITLES: dict[str, list[str]] = {
    "us": [
        "Congreso define plazo para debate de presupuesto nacional",
        "Ciudades principales refuerzan seguridad en transporte público",
        "Corte Constitucional revisará caso de privacidad digital",
        "Senado prepara votación nocturna de financiamiento transitorio",
        "Agencias publican guía de cierre ante vencimiento del plazo",
        "Negociadores intercambian últimas ofertas antes del límite",
    ],
    "world": [
        "Mercados suben tras datos de inflación moderada",
        "Imágenes satelitales muestran retroceso acelerado de glaciares",
        "Tormenta tropical afecta vuelos en la región",
    ],
    "politics": [
        "Arranca temporada electoral con encuestas reñidas",
        "Gobierno presenta nuevo marco de política exterior",
        "Financiación de campañas alcanza récord histórico",
    ],
    "business": [
        "Empresas tech anuncian marco abierto de seguridad",
        "Banco central mantiene ruta cautelosa de tasas",
        "Retail reporta resultados trimestrales mixtos",
    ],
    "health": [
        "Estudio vincula pantallas con alteraciones del sueño",
        "Panel regulatorio evalúa nuevas vacunas",
        "Hospitales amplían acceso a salud mental",
    ],
    "entertainment": [
        "Plataforma de streaming aprueba nueva serie dramática",
        "Premios recuperan audiencia con formato en vivo",
        "Fusión de estudios cambia calendario de estrenos",
    ],
    "style": [
        "Semana de diseño destaca materiales sostenibles",
        "Marcas de lujo apuestan por estética sobria",
        "Ideas de decoración para espacios pequeños",
    ],
    "travel": [
        "Aerolíneas suman rutas por demanda internacional",
        "Parques nacionales ajustan cupos de visitantes",
        "Industria de cruceros fija metas de reducción de carbono",
    ],
    "sports": [
        "Final de campeonato se define en última vuelta",
        "Estrella del deporte firma extensión récord",
        "Comité olímpico confirma sedes preseleccionadas",
    ],
}

HOMEPAGE_SLOT_SPECS: list[dict[str, Any]] = [
    {
        "position_key": "hero",
        "order_index": 0,
        "pinned": True,
        "limit": 9,
        "presentation_type": "hero",
        "display_name_us": "Top Stories",
        "display_name_co": "Titulares",
    },
    {
        "position_key": "more-top-stories",
        "order_index": 1,
        "limit": 7,
        "presentation_type": "editorial_lead",
        "display_name_us": "More Top Stories",
        "display_name_co": "Más titulares",
    },
    {
        "position_key": "midterm-elections",
        "order_index": 2,
        "category_slug": "politics",
        "limit": 4,
        "presentation_type": "editorial_spotlight",
        "display_name_us": "Midterm elections",
        "display_name_co": "Elecciones",
    },
    {
        "position_key": "editorial-rail",
        "order_index": 3,
        "limit": 4,
        "presentation_type": "rail_compact",
        "display_name_us": "Featured",
        "display_name_co": "Destacados",
    },
    {
        "position_key": "politics",
        "order_index": 4,
        "category_slug": "politics",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "Politics",
        "display_name_co": "Política",
    },
    {
        "position_key": "world",
        "order_index": 5,
        "category_slug": "world",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "World",
        "display_name_co": "Mundo",
    },
    {
        "position_key": "us",
        "order_index": 6,
        "category_slug": "us",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "US",
        "display_name_co": "Colombia",
    },
    {
        "position_key": "business",
        "order_index": 7,
        "category_slug": "business",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "Business",
        "display_name_co": "Negocios",
    },
    {
        "position_key": "health",
        "order_index": 8,
        "category_slug": "health",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "Health",
        "display_name_co": "Salud",
    },
    {
        "position_key": "entertainment",
        "order_index": 9,
        "category_slug": "entertainment",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "Entertainment",
        "display_name_co": "Entretenimiento",
    },
    {
        "position_key": "style",
        "order_index": 10,
        "category_slug": "style",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "Style",
        "display_name_co": "Estilo",
    },
    {
        "position_key": "travel",
        "order_index": 11,
        "category_slug": "travel",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "Travel",
        "display_name_co": "Viajes",
    },
    {
        "position_key": "sports",
        "order_index": 12,
        "category_slug": "sports",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "Sports",
        "display_name_co": "Deportes",
    },
]

MARKET_DEFS: list[dict[str, Any]] = [
    {
        "code": "us",
        "country": "United States",
        "label": "USA",
        "default_locale": "en-US",
        "article_titles": US_ARTICLE_TITLES,
        "display_name_key": "display_name_us",
        "breaking_items": [
            {"text": "Breaking: Major story developing in Washington", "severity": "high"},
            {"text": "Update: Details emerging from the capital", "severity": "medium"},
            {"text": "Politics: Key vote expected tonight", "severity": "medium"},
        ],
    },
    {
        "code": "co",
        "country": "Colombia",
        "label": "Colombia",
        "default_locale": "es-CO",
        "article_titles": CO_ARTICLE_TITLES,
        "display_name_key": "display_name_co",
        "breaking_items": [
            {"text": "Última hora: Historia principal en desarrollo en Bogotá", "severity": "high"},
            {"text": "Actualización: Nuevos detalles desde la capital", "severity": "medium"},
            {"text": "Política: Votación clave prevista para esta noche", "severity": "medium"},
        ],
    },
]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mongo_uri() -> str:
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        raise RuntimeError("Missing MONGO_URI")
    return mongo_uri


def _mongo_db_name() -> str:
    name = os.getenv("MONGO_DB_NAME")
    if not name:
        raise RuntimeError("Missing MONGO_DB_NAME")
    return name


async def _get_or_create_admin(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    email = os.getenv("SEED_ADMIN_EMAIL", "admin@newscore.local")
    password = os.getenv("SEED_ADMIN_PASSWORD", "admin123!")
    full_name = os.getenv("SEED_ADMIN_FULL_NAME", "NewsCore Admin")

    existing = await db[USERS_COLLECTION].find_one({"email": email})
    if existing is not None:
        logger.info("Admin user already exists: %s", email)
        return existing

    user_id = str(uuid4())
    doc = {
        "_id": user_id,
        "email": email,
        "password_hash": hash_password(password),
        "role": "admin",
        "full_name": full_name,
        "avatar_url": None,
        "bio": None,
        "is_active": True,
        "created_at": _utc_now_iso(),
    }
    await db[USERS_COLLECTION].insert_one(doc)
    logger.info("Created admin user: %s", email)
    return doc


async def _ensure_markets(db: AsyncIOMotorDatabase) -> dict[str, str]:
    """Return market code -> market id."""

    code_to_id: dict[str, str] = {}
    for market in MARKET_DEFS:
        code = str(market["code"])
        existing = await db[MARKETS_COLLECTION].find_one({"code": code})
        if existing is not None:
            code_to_id[code] = str(existing["_id"])
            continue

        market_id = str(uuid4())
        doc = {
            "_id": market_id,
            "code": code,
            "country": market["country"],
            "label": market["label"],
            "default_locale": market["default_locale"],
            "updated_at": _utc_now_iso(),
        }
        await db[MARKETS_COLLECTION].insert_one(doc)
        code_to_id[code] = market_id
        logger.info("Created market: %s", code)

    return code_to_id


async def _ensure_categories(db: AsyncIOMotorDatabase) -> dict[str, str]:
    slug_to_id: dict[str, str] = {}
    for cat in CNN_CATEGORIES:
        existing = await db[CATEGORIES_COLLECTION].find_one({"slug": cat["slug"]})
        if existing is not None:
            slug_to_id[cat["slug"]] = str(existing["_id"])
            continue

        category_id = str(uuid4())
        doc = {
            "_id": category_id,
            "name": cat["name"],
            "slug": cat["slug"],
            "parent_id": None,
            "description": cat["description"],
            "created_at": _utc_now_iso(),
        }
        await db[CATEGORIES_COLLECTION].insert_one(doc)
        slug_to_id[cat["slug"]] = category_id
        logger.info("Created category: %s", cat["slug"])

    return slug_to_id


async def _ensure_market_articles(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    market_id: str,
    market_code: str,
    article_titles: dict[str, list[str]],
    slug_to_category_id: dict[str, str],
) -> list[str]:
    article_ids: list[str] = []

    for category_slug, titles in article_titles.items():
        category_id = slug_to_category_id[category_slug]
        for title in titles:
            existing = await db[ARTICLES_COLLECTION].find_one(
                {"title": title, "market_ids": market_id},
            )
            if existing is not None:
                article_ids.append(str(existing["_id"]))
                continue

            article_id = str(uuid4())
            now = _utc_now_iso()
            slug = f"{market_code}-{category_slug}-{article_id[:8]}"
            doc = {
                "_id": article_id,
                "title": title,
                "slug": slug,
                "body": f"{title}\n\nSeeded demo content for {market_code} / {category_slug}.",
                "status": "published",
                "author_id": author_id,
                "category_id": category_id,
                "market_ids": [market_id],
                "town_id": None,
                "tags": ["seed", "demo", market_code, category_slug],
                "thumbnail_url": None,
                "media_ids": [],
                "view_count": 0,
                "published_at": now,
                "created_at": now,
                "updated_at": now,
            }
            await db[ARTICLES_COLLECTION].insert_one(doc)
            article_ids.append(article_id)

    logger.info("Ensured %d articles for market %s", len(article_ids), market_code)
    return article_ids


async def _upsert_slot(
    db: AsyncIOMotorDatabase,
    *,
    layout_id: str,
    spec: dict[str, Any],
    display_name: str,
    pinned_article_ids: list[str],
    now: str,
) -> str:
    position_key = str(spec["position_key"])
    slot = await db[SLOTS_COLLECTION].find_one({"layout_id": layout_id, "position_key": position_key})

    query_rule: dict[str, Any] | None = None
    pinned_ids: list[str] = []

    if spec.get("pinned"):
        pinned_ids = pinned_article_ids[: int(spec.get("limit") or 6)]
    elif spec.get("category_id"):
        query_rule = {
            "category_id": spec["category_id"],
            "limit": int(spec.get("limit") or 4),
        }
    else:
        query_rule = {"limit": int(spec.get("limit") or 4)}

    fields = {
        "pinned_ids": pinned_ids,
        "query_rule": query_rule,
        "order_index": int(spec["order_index"]),
        "display_name": display_name,
        "presentation_type": str(spec.get("presentation_type") or "grid_4"),
        "updated_at": now,
    }

    if slot is None:
        slot_id = str(uuid4())
        doc = {
            "_id": slot_id,
            "layout_id": layout_id,
            "position_key": position_key,
            "content_type": "articles",
            **fields,
        }
        await db[SLOTS_COLLECTION].insert_one(doc)
        logger.info("Created slot %s for layout %s", position_key, layout_id)
        return slot_id

    await db[SLOTS_COLLECTION].update_one({"_id": slot["_id"]}, {"$set": fields})
    logger.info("Updated slot %s for layout %s", position_key, layout_id)
    return str(slot["_id"])


async def _ensure_market_homepage(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    market_code: str,
    display_name_key: str,
    slug_to_category_id: dict[str, str],
    pinned_article_ids: list[str],
) -> None:
    now = _utc_now_iso()
    layout = await db[LAYOUTS_COLLECTION].find_one(
        {"page_name": "homepage", "market_id": market_id},
    )

    if layout is None:
        layout_id = str(uuid4())
        layout = {
            "_id": layout_id,
            "page_name": "homepage",
            "market_id": market_id,
            "slot_ids": [],
            "is_active": True,
            "updated_at": now,
        }
        await db[LAYOUTS_COLLECTION].insert_one(layout)
        logger.info("Created homepage layout for market %s", market_code)
    else:
        await db[LAYOUTS_COLLECTION].update_one(
            {"_id": layout["_id"]},
            {"$set": {"is_active": True, "updated_at": now}},
        )

    layout_id = str(layout["_id"])
    slot_ids: list[str] = []

    for spec in HOMEPAGE_SLOT_SPECS:
        entry = dict(spec)
        display_name = str(entry.pop(display_name_key))
        category_slug = entry.pop("category_slug", None)
        if category_slug:
            entry["category_id"] = slug_to_category_id[category_slug]
        entry.pop("display_name_us", None)
        entry.pop("display_name_co", None)

        slot_id = await _upsert_slot(
            db,
            layout_id=layout_id,
            spec=entry,
            display_name=display_name,
            pinned_article_ids=pinned_article_ids,
            now=now,
        )
        slot_ids.append(slot_id)

    await db[LAYOUTS_COLLECTION].update_one(
        {"_id": layout_id},
        {"$set": {"slot_ids": slot_ids, "is_active": True, "updated_at": now}},
    )
    logger.info("Market %s homepage has %d slots", market_code, len(slot_ids))


async def _ensure_breaking_widgets(db: AsyncIOMotorDatabase) -> None:
    for market in MARKET_DEFS:
        code = str(market["code"])
        widget_id = f"breaking:{code}"
        doc = {
            "_id": widget_id,
            "payload": {"items": market["breaking_items"]},
            "updated_at": _utc_now_iso(),
        }
        await db[WIDGETS_COLLECTION].update_one({"_id": widget_id}, {"$set": doc}, upsert=True)
        logger.info("Upserted breaking widget %s", widget_id)


async def _invalidate_homepage_feed_cache() -> None:
    from shared.core.events import publish_homepage_feed_invalidation

    try:
        await publish_homepage_feed_invalidation(all_markets=True)
    except Exception:
        logger.warning("Failed to publish homepage feed cache invalidation", exc_info=True)


async def seed_dev() -> None:
    if os.getenv("ALLOW_DEV_SEED", "true").lower() not in {"1", "true", "yes"}:
        raise RuntimeError("Dev seed disabled. Set ALLOW_DEV_SEED=true to run seed_dev.py.")

    client = AsyncIOMotorClient(_mongo_uri())
    try:
        db = client[_mongo_db_name()]
        await ensure_indexes(db)

        admin = await _get_or_create_admin(db)
        market_code_to_id = await _ensure_markets(db)
        slug_to_category_id = await _ensure_categories(db)

        for market in MARKET_DEFS:
            code = str(market["code"])
            market_id = market_code_to_id[code]
            article_ids = await _ensure_market_articles(
                db,
                author_id=str(admin["_id"]),
                market_id=market_id,
                market_code=code,
                article_titles=market["article_titles"],
                slug_to_category_id=slug_to_category_id,
            )
            await _ensure_market_homepage(
                db,
                market_id=market_id,
                market_code=code,
                display_name_key=str(market["display_name_key"]),
                slug_to_category_id=slug_to_category_id,
                pinned_article_ids=article_ids,
            )

        await _ensure_breaking_widgets(db)
        await _invalidate_homepage_feed_cache()
    finally:
        client.close()


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_dev())
