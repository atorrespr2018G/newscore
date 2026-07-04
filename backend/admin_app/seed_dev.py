"""Seed development data for NewsCore.

Creates admin user, categories, per-market articles, layouts, slots, and breaking widgets.

Run inside Docker:
    docker compose exec admin_app python seed_dev.py
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, TypeAlias, TypedDict
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from admin_app.helpers.password_helpers import hash_password
from shared.core.indexes import ensure_indexes
from shared.read.collections import (
    ARTICLES_COLLECTION,
    CATEGORIES_COLLECTION,
    LAYOUTS_COLLECTION,
    MARKETS_COLLECTION,
    SLOTS_COLLECTION,
    USERS_COLLECTION,
    WIDGETS_COLLECTION,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

CNN_CATEGORIES: list[dict[str, str]] = [
    {"name": "US", "slug": "us", "description": "United States news and politics."},
    {"name": "World", "slug": "world", "description": "Global headlines and analysis."},
    {"name": "Politics", "slug": "politics", "description": "Policy, elections, and government."},
    {"name": "Health", "slug": "finance", "description": "Wellness, medicine, and public health."},
    {"name": "Technology", "slug": "technology", "description": "Tech industry, products, and innovation."},
    {"name": "Business", "slug": "business", "description": "Markets, companies, and the economy."},
    {"name": "Health", "slug": "health", "description": "Wellness, medicine, and public health."},
    {"name": "Entertainment", "slug": "entertainment", "description": "Culture, TV, film, and celebrity."},
    {"name": "Style", "slug": "style", "description": "Fashion, design, and living."},
    {"name": "Travel", "slug": "travel", "description": "Destinations, tips, and aviation."},
    {"name": "Sports", "slug": "sports", "description": "Scores, leagues, and athletes."},
]


class SeedStorySpec(TypedDict, total=False):
    title: str
    body: str
    thumbnail_url: str | None
    video_url: str | None
    legacy_titles: list[str]
    tags: list[str]
    story_id: str | None


# Distinct demo clips (with audio) — one per health carousel item by story index.
HEALTH_DEMO_VIDEOS: tuple[str, ...] = (
    "https://www.w3schools.com/html/mov_bbb.mp4",
    "https://www.w3schools.com/html/movie.mp4",
    "https://download.samplelib.com/mp4/sample-5s.mp4",
    "https://download.samplelib.com/mp4/sample-10s.mp4",
    "https://download.samplelib.com/mp4/sample-15s.mp4",
    "https://download.samplelib.com/mp4/sample-20s.mp4",
    "https://download.samplelib.com/mp4/sample-30s.mp4",
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
)


SeedStory: TypeAlias = str | SeedStorySpec


US_ARTICLE_STORIES: dict[str, list[SeedStory]] = {
    "us": [
        {
            "title": "Baltimore bridge collapse snarls shipping and commuter traffic",
            "body": (
                "The Francis Scott Key Bridge collapsed after the container ship Dali struck "
                "a support in Baltimore, killing six construction workers and shutting a key "
                "shipping lane. Federal investigators are examining the ship's power systems "
                "while crews race to clear the channel and rebuild a major East Coast freight route."
            ),
            "thumbnail_url": "/images/homepage/baltimore-bridge.webp",
            "video_url": HEALTH_DEMO_VIDEOS[6],
            "legacy_titles": ["Congress faces deadline on budget standoff"],
            "tags": ["seed", "us", "us", "baltimore", "bridge-collapse"],
        },
        {
            "title": "Millions gather as total solar eclipse sweeps across North America",
            "body": (
                "Crowds from Texas to Maine paused on April 8 as the moon's shadow turned "
                "daylight into dusk along the path of totality. Scientists used the rare eclipse "
                "to study the sun's corona while local officials managed packed viewing events and heavy traffic."
            ),
            "thumbnail_url": "/images/homepage/solar-eclipse-totality.jpg",
            "legacy_titles": ["Major cities roll out new transit safety plans"],
            "tags": ["seed", "us", "us", "solar-eclipse", "space"],
        },
        {
            "title": "Boeing faces renewed scrutiny after Alaska Airlines blowout",
            "body": (
                "Investigators focused on manufacturing and oversight failures after a door plug "
                "blew off an Alaska Airlines 737 Max 9 shortly after takeoff from Portland, forcing "
                "an emergency landing. The incident triggered fresh inspections, delivery slowdowns, and new questions about FAA supervision."
            ),
            "thumbnail_url": "/images/homepage/alaska-737-max.jpg",
            "legacy_titles": ["Supreme Court to hear landmark digital privacy case"],
            "tags": ["seed", "us", "us", "boeing", "aviation"],
        },
        {
            "title": "Senate prepares overnight vote on stopgap funding bill",
            "body": (
                "Senate leaders scheduled an overnight session to vote on a stopgap spending "
                "measure that would keep federal agencies open past the midnight deadline. "
                "Negotiators said a handful of disputed provisions still threatened to delay "
                "final passage."
            ),
            "tags": ["seed", "us", "us", "budget", "shutdown"],
            "story_id": "us-budget-standoff",
        },
        {
            "title": "Agencies issue shutdown guidance as deadline nears",
            "body": (
                "Federal agencies circulated contingency plans instructing managers on which "
                "employees would be furloughed if Congress failed to pass funding in time. The "
                "guidance underscored how close lawmakers were to a lapse in appropriations."
            ),
            "tags": ["seed", "us", "us", "budget", "shutdown"],
            "story_id": "us-budget-standoff",
        },
        {
            "title": "Budget negotiators trade final offers before cutoff",
            "body": (
                "House and Senate negotiators exchanged last-minute offers in a bid to break the "
                "budget standoff, with both sides signaling room for a short-term deal while "
                "leaving larger spending fights for later in the year."
            ),
            "tags": ["seed", "us", "us", "budget", "shutdown"],
            "story_id": "us-budget-standoff",
        },
        # Top Stories band (us-featured) needs 12 US articles: hero + flanks + 3 text links per column.
        "FEMA mobilizes teams as spring flooding threatens Midwest towns",
        "Port workers reach tentative deal to avert East Coast strike",
        "CDC expands bird flu monitoring after poultry farm outbreaks",
        "Texas grid operator warns of tight summer power reserves",
        "Immigration courts face backlog as new asylum rules take effect",
        "NASA sets date for crewed Artemis lunar flyby rehearsal",
        "Major retailers warn shoppers to expect higher produce prices",
    ],
    "world": [
        {
            "title": "Notre-Dame reopens after years of restoration in Paris",
            "body": (
                "Notre-Dame Cathedral reopened to worshippers and visitors after a years-long restoration "
                "campaign following the 2019 fire that destroyed its spire and ravaged the roof. The return "
                "marked a symbolic milestone for Paris and for the craftspeople who rebuilt one of the world's best-known landmarks."
            ),
            "thumbnail_url": "/images/homepage/notre-dame.jpg",
            "legacy_titles": ["Markets rally as inflation cools"],
            "tags": ["seed", "us", "world", "notre-dame", "paris"],
        },
        "New satellite images reveal rapid glacier retreat",
        "Storm system causes major travel disruptions",
        "UN envoys resume talks on Gaza ceasefire framework",
        "European leaders convene emergency energy security summit",
        "Japan raises tsunami alert after offshore magnitude 7 quake",
        "India surpasses China as world's most populous nation",
        "Brazil rainforest deforestation hits lowest level in years",
        "UK and France announce joint Channel migration patrols",
        "African Union pushes debt relief plan at finance ministers meeting",
        "South Korea warns of retaliation after drone incursion",
        "Middle East carriers reroute flights amid regional tensions",
        "WHO declares end to mpox public health emergency",
        "Canada and Mexico expand cross-border rail freight corridor",
        "Australia commits $2B to Pacific climate resilience fund",
        "NATO allies increase defense spending targets amid security review",
        "China exports grow despite renewed trade friction with partners",
        "Russia and Ukraine exchange prisoners in latest mediated swap",
        "Global shipping lanes face delays after Red Sea rerouting costs rise",
        "World Bank warns developing nations face rising debt burdens",
        "EU finalizes landmark AI regulation framework for member states",
        "Indonesia elects new president on platform of economic reform",
        "Turkey earthquake survivors mark one year since disaster",
        "Argentina secures IMF deal after months of tense negotiations",
        "Philippines and China trade accusations over South China Sea incident",
        "Germany launches largest offshore wind auction in Baltic Sea",
        "Saudi Arabia hosts global energy summit amid OPEC output debate",
        "Mexico City expands metro line to ease commuter congestion",
        "Vietnam opens new semiconductor plant with foreign investment",
    ],
    "politics": [
        {
            "title": "Senate passes $70 billion Secure America Act to fund immigration enforcement",
            "body": (
                "The Senate approved the Secure America Act on June 5, sending roughly $70 billion "
                "to Customs and Border Protection and Immigration and Customs Enforcement through "
                "2029. The package includes $38.5 billion for ICE hiring, detention expansion, and "
                "removal operations, aligning with the administration's push toward one million "
                "deportations per year. The bill now heads to the House for a vote expected next week."
            ),
            "thumbnail_url": "/images/homepage/us-capitol.jpg",
            "legacy_titles": ["Election season begins with tight early polling"],
            "tags": ["seed", "us", "politics", "senate", "immigration", "secure-america-act"],
        },
        {
            "title": "Senate blocks Trump's SAVE America Act voting restrictions",
            "body": (
                "The Senate voted 48-50 against advancing President Trump's SAVE America Act as an "
                "amendment to an immigration spending bill, dealing a setback to his push for "
                "stricter national voting rules ahead of the November midterms. Several Republican "
                "senators joined Democrats in rejecting the measure despite intense White House "
                "pressure. Critics warned the bill would create chaos in state election systems "
                "months before voters go to the polls."
            ),
            "thumbnail_url": "/images/homepage/us-senate-chamber.jpg",
            "legacy_titles": ["White House outlines new foreign policy framework"],
            "tags": ["seed", "us", "politics", "senate", "voting", "save-america-act"],
        },
        {
            "title": "Judge says Trump admin illegally paused immigration benefits",
            "body": (
                "A federal judge in Rhode Island vacated four Trump administration policies that "
                "paused asylum requests globally and halted benefits for migrants from 39 countries "
                "after the fatal shooting of two National Guard members in Washington. Judge John "
                "McConnell ruled the government acted with 'strong evidence of anti-immigrant animus,' "
                "leaving countless people in legal limbo 'solely by the happenstance of their birth.'"
            ),
            "thumbnail_url": "/images/homepage/federal-courthouse.jpg",
            "legacy_titles": ["Campaign finance filings show record fundraising"],
            "tags": ["seed", "us", "politics", "immigration", "courts", "asylum"],
        },
        {
            "title": "House prepares vote on Senate immigration funding package",
            "body": (
                "House leaders signaled they will take up the Senate's nearly $70 billion "
                "reconciliation package next week after parliamentarians stripped provisions "
                "that violated the Byrd Rule, including extra funding for the Justice Department "
                "and the Secret Service. The Congressional Budget Office estimates the bill would "
                "add $69 billion to primary deficits over the next decade."
            ),
            "thumbnail_url": "/images/homepage/us-house-chamber.jpg",
            "legacy_titles": ["Governors press for compromises ahead of budget week"],
            "tags": ["seed", "us", "politics", "house", "budget", "immigration"],
        },
        {
            "title": "DHS plans 100,000 detention beds under new enforcement funding",
            "body": (
                "Department of Homeland Security officials outlined plans to expand detention "
                "capacity to 100,000 beds and convert warehouses into temporary holding facilities "
                "using money from the Secure America Act. ICE also aims to increase 287(g) "
                "partnerships with local law enforcement by 15 percent, widening interior "
                "enforcement beyond the border."
            ),
            "thumbnail_url": "/images/homepage/border-patrol.jpg",
            "legacy_titles": ["Senate leaders schedule vote on bipartisan border package"],
            "tags": ["seed", "us", "politics", "ice", "dhs", "detention"],
        },
        {
            "title": "Republicans introduce election security bills after SAVE Act defeat",
            "body": (
                "After the SAVE America Act stalled in the Senate, Republicans rolled out narrower "
                "proposals including the Election Security Partnership Act, which would pay states "
                "$20 million to cross-check voter rolls against a Homeland Security database. "
                "Representatives Julie Fedorchak and Laurel Lee also introduced a REAL ID grant "
                "program aimed at low-income voters."
            ),
            "thumbnail_url": "/images/homepage/voting-booth.jpg",
            "legacy_titles": ["State attorneys general probe election misinformation networks"],
            "tags": ["seed", "us", "politics", "elections", "midterms", "voting"],
        },
        "Supreme Court agrees to hear challenge to federal agency powers",
        "Governors push back on new federal education mandates",
        "White House unveils executive order on AI in government",
        "Bipartisan group proposes Social Security reform framework",
        "Pentagon budget faces scrutiny in Armed Services hearings",
        "State legislatures advance new voting access measures",
        "Justice Department opens antitrust review of tech mergers",
        "Congressional Budget Office projects rising deficit through 2030",
        "EPA finalizes stricter tailpipe emission standards for 2028",
        "FTC moves to ban noncompete clauses in employment contracts",
        "Census data sparks new redistricting battles in swing states",
        "Veterans Affairs expands mental health coverage for recent vets",
        "Infrastructure law delivers first wave of broadband grants",
        "Senate confirms new ambassador to NATO amid alliance tensions",
        "Campaign finance watchdog flags record dark-money spending",
        "Attorney general testifies on fentanyl enforcement strategy",
        "Labor board rules on gig worker classification dispute",
        "Homeland Security committee debates border technology upgrades",
        "Lawmakers introduce bipartisan bill to lower prescription drug costs",
        "Federal court blocks portions of new social media age law",
        "Trade representative announces tariff review on allied imports",
        "House ethics panel opens inquiry into member stock trades",
    ],
    "finance": [
        "Study links screen time to sleep disruption in teens",
        "FDA panel reviews next-generation vaccine candidates",
        "Hospitals expand mental health access programs",
        "CDC updates guidance on respiratory virus season",
        "Weight-loss drugs reshape obesity treatment landscape",
        "Rural clinics gain telehealth funding in federal package",
    ],
    "technology": [
        "Chipmakers race to ship next-generation AI accelerators",
        "Apple unveils privacy-focused OS update at developer event",
        "Open-source foundation launches model safety benchmark suite",
        "Cloud providers cut egress fees after regulatory scrutiny",
        "Startup unveils solid-state battery breakthrough for EVs",
        "EU finalizes rules for high-risk AI system deployments",
    ],
    "business": [
        "Federal Reserve holds rates steady as inflation cools further",
        "Major retailer posts record quarterly earnings on strong demand",
        "Oil prices slip as global supply outlook improves",
        "Tech giant announces $50 billion stock buyback program",
        "Startups draw renewed venture funding after lean year",
        "Housing market shows signs of cooling as mortgage rates ease",
    ],
    "health": [
        "Study links screen time to sleep disruption in teens",
        "FDA panel reviews next-generation vaccine candidates",
        "Hospitals expand mental health access programs",
        "CDC updates guidance on respiratory virus season",
        "Weight-loss drugs reshape obesity treatment landscape",
        "Rural clinics gain telehealth funding in federal package",
        "Researchers report progress on universal flu vaccine trial",
        "States debate expanded Medicaid coverage for new mothers",
        "Sleep specialists warn of rising insomnia among workers",
        "WHO calls for stronger antibiotic stewardship programs",
    ],
    "entertainment": [
        "Streaming platform greenlights high-profile drama series",
        "Award show ratings rebound with live format",
        "Studio merger reshapes summer release calendar",
        "Broadway revival breaks opening-week ticket records",
        "Celebrity podcast network signs exclusive talent roster",
        "Film festival lineup spotlights emerging directors",
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
        "Underdog club advances after penalty shootout classic",
        "League expands replay review after controversial finish",
        "National team coach names roster for summer tournament",
    ],
}

CO_ARTICLE_STORIES: dict[str, list[SeedStory]] = {
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
        {
            "title": "Senado aprueba ley Secure America con $70.000 millones para inmigración",
            "body": (
                "El Senado aprobó el 5 de junio la Secure America Act, que destina unos "
                "70.000 millones de dólares a Aduanas y Protección Fronteriza y al Servicio "
                "de Inmigración y Control de Aduanas hasta 2029. El paquete incluye 38.500 "
                "millones para contrataciones, expansión de detenciones y deportaciones de ICE."
            ),
            "thumbnail_url": "/images/homepage/us-capitol.jpg",
            "legacy_titles": ["Arranca temporada electoral con encuestas reñidas"],
            "tags": ["seed", "co", "politics", "senado", "inmigracion"],
        },
        {
            "title": "Senado bloquea restricciones de voto de la ley SAVE America de Trump",
            "body": (
                "El Senado rechazó por 48-50 la ley SAVE America de Donald Trump como enmienda "
                "a un proyecto de gasto en inmigración, un revés a su impulso por reglas electorales "
                "más estrictas antes de las elecciones intermedias de noviembre."
            ),
            "thumbnail_url": "/images/homepage/us-senate-chamber.jpg",
            "legacy_titles": ["Gobierno presenta nuevo marco de política exterior"],
            "tags": ["seed", "co", "politics", "senado", "voto"],
        },
        {
            "title": "Juez federal anula pausa de beneficios migratorios de la administración Trump",
            "body": (
                "Un juez federal de Rhode Island anuló políticas que suspendieron asilo y "
                "beneficios para migrantes de 39 países tras el tiroteo contra miembros de la "
                "Guardia Nacional en Washington, al concluir que el gobierno actuó con animus "
                "antiinmigrante."
            ),
            "thumbnail_url": "/images/homepage/federal-courthouse.jpg",
            "legacy_titles": ["Financiación de campañas alcanza récord histórico"],
            "tags": ["seed", "co", "politics", "inmigracion", "cortes"],
        },
        {
            "title": "Cámara prepara votación del paquete de inmigración del Senado",
            "body": (
                "Líderes de la Cámara de Representantes indicaron que votarán la próxima semana "
                "el paquete de reconciliación de casi 70.000 millones aprobado en el Senado, "
                "tras eliminar disposiciones que violaban la regla Byrd."
            ),
            "thumbnail_url": "/images/homepage/us-house-chamber.jpg",
            "legacy_titles": ["Gobernadores presionan por acuerdos antes de la semana presupuestal"],
            "tags": ["seed", "co", "politics", "camara", "presupuesto"],
        },
        {
            "title": "DHS planea 100.000 camas de detención con nuevo financiamiento",
            "body": (
                "Funcionarios del Departamento de Seguridad Nacional describieron planes para "
                "ampliar la capacidad de detención a 100.000 camas y convertir almacenes en "
                "instalaciones temporales con fondos de la Secure America Act."
            ),
            "thumbnail_url": "/images/homepage/border-patrol.jpg",
            "legacy_titles": ["Líderes del Senado calendarizan votación de paquete fronterizo"],
            "tags": ["seed", "co", "politics", "ice", "dhs"],
        },
        {
            "title": "Republicanos presentan nuevas leyes de seguridad electoral tras derrota del SAVE Act",
            "body": (
                "Tras el fracaso del SAVE America Act, republicanos presentaron propuestas más "
                "acotadas, como la Election Security Partnership Act, que pagaría a los estados "
                "20 millones de dólares para verificar padrones electorales."
            ),
            "thumbnail_url": "/images/homepage/voting-booth.jpg",
            "legacy_titles": ["Fiscales estatales investigan redes de desinformación electoral"],
            "tags": ["seed", "co", "politics", "elecciones", "voto"],
        },
        "Corte Suprema acepta caso sobre poderes de agencias federales",
        "Gobernadores rechazan nuevos mandatos federales de educación",
        "Casa Blanca firma orden ejecutiva sobre IA en el gobierno",
        "Grupo bipartidista propone reforma al Seguro Social",
        "Presupuesto del Pentágono enfrenta escrutinio en audiencias",
        "Legislaturas estatales avanzan medidas de acceso al voto",
        "Departamento de Justicia abre revisión antimonopolio de fusiones tech",
        "Oficina de Presupuesto proyecta déficit creciente hasta 2030",
        "EPA finaliza estándares más estrictos de emisiones para 2028",
        "FTC busca prohibir cláusulas de no competencia en contratos laborales",
        "Datos del censo desatan batallas de redistribución en estados clave",
        "Asuntos de Veteranos amplía cobertura de salud mental",
        "Ley de infraestructura entrega primera ronda de fondos para banda ancha",
        "Senado confirma nuevo embajador ante la OTAN tras tensiones",
        "Vigilante de finanzas electorales alerta sobre gasto récord de dinero oscuro",
        "Fiscal general testifica sobre estrategia contra el fentanilo",
        "Junta laboral emite fallo sobre clasificación de trabajadores gig",
        "Comité de seguridad debate mejoras tecnológicas en la frontera",
        "Legisladores presentan proyecto bipartidista para abaratar medicamentos",
        "Tribunal federal bloquea partes de nueva ley de edad en redes sociales",
        "Representante comercial anuncia revisión de aranceles a aliados",
        "Panel de ética de la Cámara abre investigación sobre compra de acciones",
    ],
    "finance": [
        "Estudio vincula pantallas con alteraciones del sueño",
        "Panel regulatorio evalúa nuevas vacunas",
        "Hospitales amplían acceso a salud mental",
        "Autoridades actualizan guía para temporada respiratoria",
        "Fármacos para pérdida de peso transforman tratamiento",
        "Clínicas rurales reciben fondos para telemedicina",
    ],
    "technology": [
        "Fabricantes de chips aceleran envío de aceleradores de IA",
        "Apple presenta actualización de privacidad en evento para desarrolladores",
        "Fundación open source lanza benchmarks de seguridad para modelos",
        "Proveedores cloud reducen tarifas de transferencia tras escrutinio regulatorio",
        "Startup anuncia avance en baterías de estado sólido para vehículos eléctricos",
        "UE finaliza reglas para sistemas de IA de alto riesgo",
    ],
    "business": [
        "La Reserva Federal mantiene las tasas mientras la inflación cede",
        "Gran minorista reporta ganancias récord por fuerte demanda",
        "Precios del petróleo bajan ante mejor panorama de oferta global",
        "Gigante tecnológico anuncia recompra de acciones por $50.000 millones",
        "Startups vuelven a captar inversión de capital de riesgo",
        "El mercado de vivienda se enfría a medida que ceden las hipotecas",
    ],
    "health": [
        "Estudio vincula pantallas con alteraciones del sueño",
        "Panel regulatorio evalúa nuevas vacunas",
        "Hospitales amplían acceso a salud mental",
        "Autoridades actualizan guía para temporada respiratoria",
        "Fármacos para pérdida de peso transforman tratamiento",
        "Clínicas rurales reciben fondos para telemedicina",
        "Avances en ensayo de vacuna universal contra la gripe",
        "Estados debaten ampliar cobertura de salud materna",
        "Especialistas alertan por insomnio entre trabajadores",
        "OMS pide mayor control del uso de antibióticos",
    ],
    "entertainment": [
        "Plataforma de streaming aprueba nueva serie dramática",
        "Premios recuperan audiencia con formato en vivo",
        "Fusión de estudios cambia calendario de estrenos",
        "Revival de Broadway bate récord de ventas en estreno",
        "Red de podcasts firma roster exclusivo de talentos",
        "Festival de cine destaca a nuevos directores",
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
        "Club sorpresa avanza tras tanda de penales histórica",
        "Liga amplía revisión por video tras polémico final",
        "Selección nacional anuncia convocatoria para torneo de verano",
    ],
}

HOMEPAGE_SLOT_SPECS: list[dict[str, Any]] = [
    {
        "position_key": "hero",
        "order_index": 0,
        "pinned": True,
        "limit": 12,
        "presentation_type": "hero",
        "display_name_us": "Hero",
        "display_name_co": "Titular",
    },
    {
        "position_key": "more-top-stories",
        "order_index": 1,
        "pinned": True,
        "pin_offset": 24,
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
        "display_name_us": "Government",
        "display_name_co": "Elecciones",
    },
    {
        "position_key": "editorial-rail",
        "order_index": 3,
        "limit": 5,
        "presentation_type": "rail_compact",
        "display_name_us": "Sports",
        "display_name_co": "Hoy",
    },
    {
        "position_key": "more-top-stories-2",
        "order_index": 4,
        "pinned": True,
        "pin_offset": 31,
        "limit": 7,
        "presentation_type": "editorial_lead",
        "display_name_us": "Extra Stories",
        "display_name_co": "Historias extra",
    },
    {
        "position_key": "midterm-elections-2",
        "order_index": 5,
        "category_slug": "world",
        "limit": 4,
        "presentation_type": "editorial_spotlight",
        "display_name_us": "World watch",
        "display_name_co": "Panorama mundial",
    },
    {
        "position_key": "editorial-rail-2",
        "order_index": 6,
        "limit": 4,
        "presentation_type": "rail_compact",
        "display_name_us": "Featured",
        "display_name_co": "Destacados",
    },
    {
        "position_key": "us-featured",
        "order_index": 7,
        "pinned": True,
        "pin_offset": 12,
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Top Stories",
        "display_name_co": "Colombia",
    },
    {
        "position_key": "health",
        "order_index": 8,
        "category_slug": "health",
        "limit": 10,
        "presentation_type": "grid_4",
        "display_name_us": "Live",
        "display_name_co": "En Vivo",
    },
    {
        "position_key": "politics",
        "order_index": 9,
        "category_slug": "politics",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Politics",
        "display_name_co": "Política",
    },
    {
        "position_key": "sports",
        "order_index": 10,
        "category_slug": "sports",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Sports",
        "display_name_co": "Deportes",
    },
    {
        "position_key": "finance",
        "order_index": 11,
        "category_slug": "finance",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Health",
        "display_name_co": "Salud",
    },
    {
        "position_key": "entertainment",
        "order_index": 12,
        "category_slug": "entertainment",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Entertainment",
        "display_name_co": "Entretenimiento",
    },
    {
        "position_key": "world",
        "order_index": 13,
        "category_slug": "world",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "World",
        "display_name_co": "Mundo",
    },
    {
        "position_key": "technology",
        "order_index": 14,
        "category_slug": "technology",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Technology",
        "display_name_co": "Tecnología",
    },
    {
        "position_key": "business",
        "order_index": 15,
        "category_slug": "business",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Business",
        "display_name_co": "Negocios",
    },
    {
        "position_key": "us",
        "order_index": 16,
        "category_slug": "us",
        "limit": 7,
        "presentation_type": "grid_4",
        "display_name_us": "US",
        "display_name_co": "Colombia",
    },
    {
        "position_key": "style",
        "order_index": 17,
        "category_slug": "style",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "Style",
        "display_name_co": "Estilo",
    },
    {
        "position_key": "travel",
        "order_index": 18,
        "category_slug": "travel",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "Travel",
        "display_name_co": "Viajes",
    },
]

WORLD_PAGE_SLOT_SPECS: list[dict[str, Any]] = [
    {
        "position_key": "hero",
        "order_index": 0,
        "category_slug": "world",
        "limit": 30,
        "presentation_type": "hero",
        "display_name_us": "World",
        "display_name_co": "Mundo",
    },
    {
        "position_key": "more-top-stories",
        "order_index": 1,
        "category_slug": "world",
        "limit": 7,
        "presentation_type": "editorial_lead",
        "display_name_us": "USA/Canada",
        "display_name_co": "EE. UU./Canadá",
    },
    {
        "position_key": "world-spotlight",
        "order_index": 2,
        "category_slug": "world",
        "limit": 5,
        "presentation_type": "editorial_spotlight",
        "display_name_us": "Europe",
        "display_name_co": "Europa",
    },
    {
        "position_key": "editorial-rail",
        "order_index": 3,
        "category_slug": "world",
        "limit": 6,
        "presentation_type": "rail_compact",
        "display_name_us": "Latin America",
        "display_name_co": "América Latina",
    },
    {
        "position_key": "world-latest",
        "order_index": 4,
        "category_slug": "world",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Asia",
        "display_name_co": "Asia",
    },
    {
        "position_key": "world-regions",
        "order_index": 5,
        "category_slug": "world",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Oceania",
        "display_name_co": "Oceania",
    },
    {
        "position_key": "world-middle-east",
        "order_index": 6,
        "category_slug": "world",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Middle East",
        "display_name_co": "Medio Oriente",
    },
    {
        "position_key": "world-africa",
        "order_index": 7,
        "category_slug": "world",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Africa",
        "display_name_co": "África",
    },
]

POLITICS_PAGE_SLOT_SPECS: list[dict[str, Any]] = [
    {
        "position_key": "hero",
        "order_index": 0,
        "category_slug": "politics",
        "limit": 30,
        "presentation_type": "hero",
        "display_name_us": "Politics",
        "display_name_co": "Política",
    },
    {
        "position_key": "more-top-stories",
        "order_index": 1,
        "category_slug": "politics",
        "limit": 7,
        "presentation_type": "editorial_lead",
        "display_name_us": "Congress",
        "display_name_co": "Congreso",
    },
    {
        "position_key": "politics-spotlight",
        "order_index": 2,
        "category_slug": "politics",
        "limit": 5,
        "presentation_type": "editorial_spotlight",
        "display_name_us": "Elections",
        "display_name_co": "Elecciones",
    },
    {
        "position_key": "editorial-rail",
        "order_index": 3,
        "category_slug": "politics",
        "limit": 6,
        "presentation_type": "rail_compact",
        "display_name_us": "White House",
        "display_name_co": "Casa Blanca",
    },
    {
        "position_key": "politics-latest",
        "order_index": 4,
        "category_slug": "politics",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Policy",
        "display_name_co": "Política Pública",
    },
    {
        "position_key": "politics-courts",
        "order_index": 5,
        "category_slug": "politics",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Courts & Law",
        "display_name_co": "Tribunales y Leyes",
    },
    {
        "position_key": "politics-state",
        "order_index": 6,
        "category_slug": "politics",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "State Politics",
        "display_name_co": "Política Estatal",
    },
    {
        "position_key": "politics-opinion",
        "order_index": 7,
        "category_slug": "politics",
        "limit": 6,
        "presentation_type": "grid_4",
        "display_name_us": "Opinion",
        "display_name_co": "Opinión",
    },
]

MARKET_DEFS: list[dict[str, Any]] = [
    {
        "code": "us",
        "country": "United States",
        "label": "USA",
        "default_locale": "en-US",
        "article_stories": US_ARTICLE_STORIES,
        "display_name_key": "display_name_us",
        "breaking_items": [
            {"text": "Breaking: Major story developing in Washington", "severity": "high"},
            {"text": "Update: Details emerging from the capital", "severity": "medium"},
            {"text": "Politics: Senate passes $70B Secure America Act", "severity": "medium"},
        ],
    },
    {
        "code": "co",
        "country": "Colombia",
        "label": "Colombia",
        "default_locale": "es-CO",
        "article_stories": CO_ARTICLE_STORIES,
        "display_name_key": "display_name_co",
        "breaking_items": [
            {"text": "Última hora: Historia principal en desarrollo en Bogotá", "severity": "high"},
            {"text": "Actualización: Nuevos detalles desde la capital", "severity": "medium"},
            {"text": "Política: Senado aprueba ley Secure America de $70.000 millones", "severity": "medium"},
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


def _story_title(story: SeedStory) -> str:
    return story if isinstance(story, str) else story["title"]


def _story_body(story: SeedStory, *, title: str, market_code: str, category_slug: str) -> str:
    if isinstance(story, dict) and story.get("body"):
        return str(story["body"])
    return ""


def _story_thumbnail_url(story: SeedStory) -> str | None:
    if isinstance(story, dict):
        return story.get("thumbnail_url")
    return None


def _story_video_url(
    story: SeedStory,
    *,
    category_slug: str,
    story_index: int,
) -> str | None:
    if isinstance(story, dict) and story.get("video_url"):
        return str(story["video_url"])
    if category_slug != "health":
        return None
    if not HEALTH_DEMO_VIDEOS:
        return None
    return HEALTH_DEMO_VIDEOS[story_index % len(HEALTH_DEMO_VIDEOS)]


def _story_tags(story: SeedStory, *, market_code: str, category_slug: str) -> list[str]:
    if isinstance(story, dict) and story.get("tags"):
        return list(story["tags"])
    return ["seed", "demo", market_code, category_slug]


def _story_story_id(story: SeedStory) -> str | None:
    """Return the editor-assigned story grouping id for a seeded story."""

    if isinstance(story, dict):
        return story.get("story_id")
    return None


def _story_lookup_titles(story: SeedStory) -> list[str]:
    if isinstance(story, str):
        return [story]
    return [story["title"], *list(story.get("legacy_titles") or [])]


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


async def _get_or_create_role_user(
    db: AsyncIOMotorDatabase,
    *,
    email: str,
    password: str,
    full_name: str,
    role: str,
) -> dict[str, Any]:
    """Create or return a seeded user for the given editorial role."""

    existing = await db[USERS_COLLECTION].find_one({"email": email})
    if existing is not None:
        logger.info("%s user already exists: %s", role, email)
        return existing

    user_id = str(uuid4())
    doc = {
        "_id": user_id,
        "email": email,
        "password_hash": hash_password(password),
        "role": role,
        "full_name": full_name,
        "avatar_url": None,
        "bio": None,
        "is_active": True,
        "created_at": _utc_now_iso(),
    }
    await db[USERS_COLLECTION].insert_one(doc)
    logger.info("Created %s user: %s", role, email)
    return doc


async def _ensure_editorial_users(db: AsyncIOMotorDatabase) -> None:
    """Seed reporter and editor accounts for phase-1 workflow testing."""

    await _get_or_create_role_user(
        db,
        email=os.getenv("SEED_REPORTER_EMAIL", "reporter@newscore.local"),
        password=os.getenv("SEED_REPORTER_PASSWORD", "reporter123!"),
        full_name=os.getenv("SEED_REPORTER_FULL_NAME", "NewsCore Reporter"),
        role="reporter",
    )
    await _get_or_create_role_user(
        db,
        email=os.getenv("SEED_EDITOR_EMAIL", "editor@newscore.local"),
        password=os.getenv("SEED_EDITOR_PASSWORD", "editor123!"),
        full_name=os.getenv("SEED_EDITOR_FULL_NAME", "NewsCore Editor"),
        role="editor",
    )


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
            # Refresh metadata so seed corrections (renames, descriptions) apply
            # to categories created by earlier seed runs.
            await db[CATEGORIES_COLLECTION].update_one(
                {"_id": existing["_id"]},
                {"$set": {"name": cat["name"], "description": cat["description"]}},
            )
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


def _market_article_fields(
    story: SeedStory,
    *,
    title: str,
    market_code: str,
    category_slug: str,
    video_url: str | None,
    now: str,
) -> dict[str, Any]:
    """Build mutable fields for seeded market article records."""

    return {
        "title": title,
        "body": _story_body(
            story,
            title=title,
            market_code=market_code,
            category_slug=category_slug,
        ),
        "tags": _story_tags(
            story,
            market_code=market_code,
            category_slug=category_slug,
        ),
        "thumbnail_url": _story_thumbnail_url(story),
        "video_url": video_url,
        "story_id": _story_story_id(story),
        "published_at": now,
        "updated_at": now,
    }


def _new_market_article_doc(
    *,
    article_id: str,
    author_id: str,
    market_id: str,
    category_id: str,
    market_code: str,
    category_slug: str,
    story: SeedStory,
    title: str,
    video_url: str | None,
    now: str,
) -> dict[str, Any]:
    """Build a new article document for market seeding."""

    return {
        "_id": article_id,
        "slug": f"{market_code}-{category_slug}-{article_id[:8]}",
        "status": "published",
        "author_id": author_id,
        "category_id": category_id,
        "market_ids": [market_id],
        "town_id": None,
        "media_ids": [],
        "view_count": 0,
        "created_at": now,
        **_market_article_fields(
            story,
            title=title,
            market_code=market_code,
            category_slug=category_slug,
            video_url=video_url,
            now=now,
        ),
    }


async def _ensure_market_articles(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    market_id: str,
    market_code: str,
    article_stories: dict[str, list[SeedStory]],
    slug_to_category_id: dict[str, str],
) -> list[str]:
    """Create or update seeded articles for a specific market."""

    article_ids: list[str] = []

    for category_slug, stories in article_stories.items():
        category_id = slug_to_category_id[category_slug]
        for story_index, story in enumerate(stories):
            title = _story_title(story)
            video_url = _story_video_url(
                story,
                category_slug=category_slug,
                story_index=story_index,
            )
            existing = await db[ARTICLES_COLLECTION].find_one(
                {
                    "category_id": category_id,
                    "market_ids": market_id,
                    "title": {"$in": _story_lookup_titles(story)},
                },
            )
            now = _utc_now_iso()
            fields = _market_article_fields(
                story,
                title=title,
                market_code=market_code,
                category_slug=category_slug,
                video_url=video_url,
                now=now,
            )
            if existing is not None:
                await db[ARTICLES_COLLECTION].update_one(
                    {"_id": existing["_id"]},
                    {"$set": fields},
                )
                article_ids.append(str(existing["_id"]))
                continue

            article_id = str(uuid4())
            doc = _new_market_article_doc(
                article_id=article_id,
                author_id=author_id,
                market_id=market_id,
                category_id=category_id,
                market_code=market_code,
                category_slug=category_slug,
                story=story,
                title=title,
                video_url=video_url,
                now=now,
            )
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

    limit = int(spec.get("limit") or 4)
    query_rule: dict[str, Any] | None = None
    pinned_ids: list[str] = []

    if spec.get("pinned"):
        pin_offset = int(spec.get("pin_offset") or 0)
        pinned_ids = pinned_article_ids[pin_offset:pin_offset + limit]
        query_rule = {"limit": limit}
    elif spec.get("category_id"):
        query_rule = {
            "category_id": spec["category_id"],
            "limit": limit,
        }
    else:
        query_rule = {"limit": limit}

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


async def _ensure_market_page(
    db: AsyncIOMotorDatabase,
    *,
    page_name: str,
    slot_specs: list[dict[str, Any]],
    market_id: str,
    market_code: str,
    display_name_key: str,
    slug_to_category_id: dict[str, str],
    pinned_article_ids: list[str],
) -> None:
    now = _utc_now_iso()
    layout = await db[LAYOUTS_COLLECTION].find_one(
        {"page_name": page_name, "market_id": market_id},
    )

    if layout is None:
        layout_id = str(uuid4())
        layout = {
            "_id": layout_id,
            "page_name": page_name,
            "market_id": market_id,
            "slot_ids": [],
            "is_active": True,
            "updated_at": now,
        }
        await db[LAYOUTS_COLLECTION].insert_one(layout)
        logger.info("Created %s layout for market %s", page_name, market_code)
    else:
        await db[LAYOUTS_COLLECTION].update_one(
            {"_id": layout["_id"]},
            {"$set": {"is_active": True, "updated_at": now}},
        )

    layout_id = str(layout["_id"])
    slot_ids: list[str] = []

    for spec in slot_specs:
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
    logger.info("Market %s %s page has %d slots", market_code, page_name, len(slot_ids))


async def _ensure_market_homepage(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    market_code: str,
    display_name_key: str,
    slug_to_category_id: dict[str, str],
    pinned_article_ids: list[str],
) -> None:
    await _ensure_market_page(
        db,
        page_name="homepage",
        slot_specs=HOMEPAGE_SLOT_SPECS,
        market_id=market_id,
        market_code=market_code,
        display_name_key=display_name_key,
        slug_to_category_id=slug_to_category_id,
        pinned_article_ids=pinned_article_ids,
    )


async def _ensure_market_world_page(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    market_code: str,
    display_name_key: str,
    slug_to_category_id: dict[str, str],
    pinned_article_ids: list[str],
) -> None:
    await _ensure_market_page(
        db,
        page_name="world",
        slot_specs=WORLD_PAGE_SLOT_SPECS,
        market_id=market_id,
        market_code=market_code,
        display_name_key=display_name_key,
        slug_to_category_id=slug_to_category_id,
        pinned_article_ids=pinned_article_ids,
    )


async def _ensure_market_politics_page(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    market_code: str,
    display_name_key: str,
    slug_to_category_id: dict[str, str],
    pinned_article_ids: list[str],
) -> None:
    """Seed the politics section page layout and slots for a market."""
    await _ensure_market_page(
        db,
        page_name="politics",
        slot_specs=POLITICS_PAGE_SLOT_SPECS,
        market_id=market_id,
        market_code=market_code,
        display_name_key=display_name_key,
        slug_to_category_id=slug_to_category_id,
        pinned_article_ids=pinned_article_ids,
    )


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
    """Publish homepage-feed invalidation after seeding completes.

    Raises:
        RuntimeError: When invalidation publish fails.
    """

    from shared.core.events import publish_homepage_feed_invalidation

    try:
        await publish_homepage_feed_invalidation(all_markets=True)
    except Exception as exc:
        logger.error("Failed to publish homepage feed cache invalidation", exc_info=True)
        raise RuntimeError("Failed to publish homepage feed cache invalidation") from exc


async def seed_dev() -> None:
    if os.getenv("ALLOW_DEV_SEED", "true").lower() not in {"1", "true", "yes"}:
        raise RuntimeError("Dev seed disabled. Set ALLOW_DEV_SEED=true to run seed_dev.py.")

    client = AsyncIOMotorClient(_mongo_uri())
    try:
        db = client[_mongo_db_name()]
        await ensure_indexes(db)

        admin = await _get_or_create_admin(db)
        await _ensure_editorial_users(db)
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
                article_stories=market["article_stories"],
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
            await _ensure_market_world_page(
                db,
                market_id=market_id,
                market_code=code,
                display_name_key=str(market["display_name_key"]),
                slug_to_category_id=slug_to_category_id,
                pinned_article_ids=article_ids,
            )
            await _ensure_market_politics_page(
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
