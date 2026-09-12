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
from shared.core.entertainment_page_sections_sync import DEFAULT_ENTERTAINMENT_TOPIC_LABELS
from shared.core.health_page_sections_sync import DEFAULT_HEALTH_TOPIC_LABELS
from shared.core.indexes import ensure_indexes
from shared.core.page_ad_placements import (
    PAGE_NAME_TECHNOLOGY,
    TECHNOLOGY_ARCHIVE_PIN_LIMIT,
    TECHNOLOGY_HERO_ARTICLE_LIMIT,
    TECHNOLOGY_LIVE_ARTICLE_LIMIT,
    TECHNOLOGY_TOP_STORIES_ARTICLE_LIMIT,
)
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
    {
        "name": "World",
        "slug": "sports-page-world",
        "description": "World news curated for the Sports page only.",
    },
    {
        "name": "World",
        "slug": "government-page-world",
        "description": "World news curated for the Government page only.",
    },
    {"name": "Politics", "slug": "politics", "description": "Policy, elections, and government."},
    {"name": "Health", "slug": "finance", "description": "Wellness, medicine, and public health."},
    {"name": "Technology", "slug": "technology", "description": "Tech industry, products, and innovation."},
    {"name": "Business", "slug": "business", "description": "Markets, companies, and the economy."},
    {"name": "Health", "slug": "health", "description": "Wellness, medicine, and public health."},
    {"name": "Entertainment", "slug": "entertainment", "description": "Culture, TV, film, and celebrity."},
    {"name": "Style", "slug": "style", "description": "Fashion, design, and living."},
    {"name": "Travel", "slug": "travel", "description": "Destinations, tips, and aviation."},
    {"name": "Sports", "slug": "sports", "description": "Scores, leagues, and athletes."},
    {"name": "Government", "slug": "government", "description": "Executive, legislature, judiciary, agencies, and defense."},
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
        "Satellite broadband reaches remote schools after spectrum deal",
        "Cybersecurity firms warn of new ransomware targeting hospitals",
        "Quantum computing lab reports error-correction milestone",
        "Social platforms test age checks for teen accounts",
        "Chip export controls reshape foundry investment plans",
        "Robotics maker opens first US assembly plant",
        "Researchers publish open dataset for climate-model training",
        "Telecoms begin nationwide 5G-Advanced rollout",
        "Browser makers agree on default tracking protections",
        "Gaming studios adopt cloud-native build pipelines",
        "Universities launch joint institute for AI safety",
        "Wearable maker adds on-device translation to earbuds",
        "Regulators probe app-store billing after developer complaints",
        "National lab deploys supercomputer for weather forecasting",
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
    # Sports hero + Top Stories each need 12 articles for the full 3-column layout
    # (right rail uses pinned indices 10–11 / 8–11).
    "sports": [
        "Championship race goes to final lap thriller",
        "Star player signs record-breaking extension",
        "Olympic committee confirms venue shortlist",
        "Underdog club advances after penalty shootout classic",
        "League expands replay review after controversial finish",
        "National team coach names roster for summer tournament",
        "College basketball tip-off brings rivalry series back to primetime",
        "Soccer federation opens new national development academy",
        "Track and field trials set wind-aid standards for outdoor meets",
        "Golf majors trial slower-play penalties across early rounds",
        "Boxing sanctioning bodies align title-fight purse rules",
        "Pro volleyball league expands to coastal market franchises",
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
        "Banda ancha satelital llega a escuelas remotas tras acuerdo de espectro",
        "Firmas de ciberseguridad alertan de ransomware contra hospitales",
        "Laboratorio cuántico reporta hito en corrección de errores",
        "Plataformas sociales prueban verificación de edad para menores",
        "Controles de exportación de chips reconfiguran inversión en fábricas",
        "Fabricante de robótica abre primera planta de ensamblaje en EE. UU.",
        "Investigadores publican dataset abierto para modelos climáticos",
        "Operadores inician despliegue nacional de 5G-Advanced",
        "Navegadores acuerdan protecciones de rastreo por defecto",
        "Estudios de videojuegos adoptan pipelines de compilación en la nube",
        "Universidades lanzan instituto conjunto de seguridad en IA",
        "Fabricante de wearables añade traducción en el dispositivo a auriculares",
        "Reguladores investigan cobros de tiendas de apps tras quejas",
        "Laboratorio nacional despliega supercomputadora para pronósticos",
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
    # Sports hero + Top Stories each need 12 articles for the full 3-column layout.
    "sports": [
        "Final de campeonato se define en última vuelta",
        "Estrella del deporte firma extensión récord",
        "Comité olímpico confirma sedes preseleccionadas",
        "Club sorpresa avanza tras tanda de penales histórica",
        "Liga amplía revisión por video tras polémico final",
        "Selección nacional anuncia convocatoria para torneo de verano",
        "Baloncesto universitario revive rivalidad en horario estelar",
        "Federación de fútbol abre academia nacional de desarrollo",
        "Atletismo fija estándares de viento para pruebas al aire libre",
        "Grandes de golf prueban sanciones por juego lento",
        "Organismos de boxeo alinean reglas de bolsa en peleas de título",
        "Liga de voleibol profesional se expande a franquicias costeras",
    ],
}

PR_TOWN_LABELS: dict[str, str] = {
    "adjuntas": "Adjuntas",
    "aguada": "Aguada",
    "aguadilla": "Aguadilla",
    "aguas-buenas": "Aguas Buenas",
    "aibonito": "Aibonito",
    "anasco": "Añasco",
    "arecibo": "Arecibo",
    "arroyo": "Arroyo",
    "barceloneta": "Barceloneta",
    "barranquitas": "Barranquitas",
    "bayamon": "Bayamón",
    "cabo-rojo": "Cabo Rojo",
    "caguas": "Caguas",
    "camuy": "Camuy",
    "canovanas": "Canóvanas",
    "carolina": "Carolina",
    "catano": "Cataño",
    "cayey": "Cayey",
    "ceiba": "Ceiba",
    "ciales": "Ciales",
    "cidra": "Cidra",
    "coamo": "Coamo",
    "comerio": "Comerío",
    "corozal": "Corozal",
    "culebra": "Culebra",
    "dorado": "Dorado",
    "fajardo": "Fajardo",
    "florida": "Florida",
    "guanica": "Guánica",
    "guayama": "Guayama",
    "guayanilla": "Guayanilla",
    "guaynabo": "Guaynabo",
    "gurabo": "Gurabo",
    "hatillo": "Hatillo",
    "hormigueros": "Hormigueros",
    "humacao": "Humacao",
    "isabela": "Isabela",
    "jayuya": "Jayuya",
    "juana-diaz": "Juana Díaz",
    "juncos": "Juncos",
    "lajas": "Lajas",
    "lares": "Lares",
    "las-marias": "Las Marías",
    "las-piedras": "Las Piedras",
    "loiza": "Loíza",
    "luquillo": "Luquillo",
    "manati": "Manatí",
    "maricao": "Maricao",
    "maunabo": "Maunabo",
    "mayaguez": "Mayagüez",
    "moca": "Moca",
    "morovis": "Morovis",
    "naguabo": "Naguabo",
    "naranjito": "Naranjito",
    "orocovis": "Orocovis",
    "patillas": "Patillas",
    "penuelas": "Peñuelas",
    "ponce": "Ponce",
    "quebradillas": "Quebradillas",
    "rincon": "Rincón",
    "rio-grande": "Río Grande",
    "sabana-grande": "Sabana Grande",
    "salinas": "Salinas",
    "san-german": "San Germán",
    "san-juan": "San Juan",
    "san-lorenzo": "San Lorenzo",
    "san-sebastian": "San Sebastián",
    "santa-isabel": "Santa Isabel",
    "toa-alta": "Toa Alta",
    "toa-baja": "Toa Baja",
    "trujillo-alto": "Trujillo Alto",
    "utuado": "Utuado",
    "vega-alta": "Vega Alta",
    "vega-baja": "Vega Baja",
    "vieques": "Vieques",
    "villalba": "Villalba",
    "yabucoa": "Yabucoa",
    "yauco": "Yauco",
}

PUERTO_RICO_TOWN_IDS: tuple[str, ...] = tuple(
    sorted(PR_TOWN_LABELS.keys(), key=lambda town_id: PR_TOWN_LABELS[town_id].casefold()),
)
PR_TOWN_CATEGORY_SLUGS: tuple[str, ...] = (
    "politics",
    "business",
    "sports",
    "entertainment",
    "government",
)

PR_TOWN_HEADLINES: dict[str, str] = {
    "san-juan": "San Juan council approves harbor modernization plan",
    "ponce": "Ponce cultural district expands evening festival hours",
    "mayaguez": "Mayagüez port expansion aims to boost Caribbean trade routes",
    "caguas": "Caguas tech hub draws mainland remote-work relocations",
    "bayamon": "Bayamón transit corridor adds express bus lanes",
    "carolina": "Carolina airport district reports record passenger traffic",
    "arecibo": "Arecibo observatory site reopens visitor center after upgrades",
    "guaynabo": "Guaynabo business park secures new pharmaceutical tenant",
}


def _pr_town_headline(town_id: str) -> str:
    """Return the primary local headline for a Puerto Rico municipality.

    Args:
        town_id: Municipality slug used in article filters.

    Returns:
        Headline text for the town's primary local story.
    """
    custom = PR_TOWN_HEADLINES.get(town_id)
    if custom is not None:
        return custom
    label = PR_TOWN_LABELS[town_id]
    return f"{label} community leaders outline local development priorities"

PR_ARTICLE_STORIES: dict[str, list[str]] = {
    "us": [
        "San Juan waterfront project wins federal resilience grant",
        "Ponce merchants reopen after hurricane recovery milestone",
        "Mayagüez port expansion aims to boost Caribbean trade routes",
        "Caguas tech hub draws mainland remote-work relocations",
        "Rincón tourism board reports record winter visitor season",
        "Vieques ferry schedule changes spark commuter debate",
    ],
    "world": [
        "Caribbean leaders meet on shared climate adaptation funds",
        "Storm track shifts raise alerts across the Lesser Antilles",
        "Regional airlines restore routes after runway repairs",
        "UN briefing highlights island food-security pressures",
        "Dominican Republic trade talks advance with island partners",
        "Satellite data shows coral bleaching across the Caribbean",
        "Cruise industry forecasts stronger winter season for the region",
        "Haiti aid corridor updates reshape port logistics plans",
        "Mexico and Caribbean states expand tourism security pact",
        "Global markets react to Atlantic shipping cost spike",
        "European visitors return as island hotel occupancy climbs",
        "WHO monitors mosquito-borne illness uptick in the region",
    ],
    "sports-page-world": [
        "Olympic host cities finalize joint security drills for opening week",
        "FIFA expands youth world cups to include Caribbean qualifier path",
        "Tennis majors agree on shared concussion review standards",
        "Global marathon circuit adds San Juan stop for championship points",
        "World surfing tour weighs Atlantic hurricane-window schedule shifts",
        "Basketball federation opens new Americas development academy",
        "Boxing sanctioning bodies align title-fight purse transparency rules",
        "Track and field council revises wind-aid records for outdoor meets",
        "International volleyball federation picks regional training hubs",
        "Golf majors trial slower-play penalties across early rounds",
        "Horse racing authorities tighten equine travel health checks",
        "World anti-doping agency updates athlete biological passport guidance",
    ],
    "politics": [
        "Governor outlines fiscal plan ahead of budget hearings",
        "Status commission schedules public forums on statehood debate",
        "Legislature advances energy reform targeting island grid",
        "San Juan mayor calls for faster federal disaster reimbursements",
        "Opposition leaders press for transparency in contract awards",
        "Resident commissioner testifies on Medicaid funding gap",
    ],
    "business": [
        "Manufacturing incentives attract pharmaceutical expansion",
        "Island banks report steady growth in small-business lending",
        "Renewable developers bid on new solar farm parcels",
        "Tourism revenue rebounds with cruise season uptick",
        "Tax incentive debate shapes next investment cycle",
        "Retailers adapt supply chains after shipping cost spike",
    ],
    "sports": [
        "Boricua boxer returns home after world-title defense",
        "Winter league baseball draws sold-out crowds in Carolina",
        "National basketball team opens Olympic qualifying camp",
        "Surf championship brings international athletes to Isabela",
        "High school volleyball rivalry sets attendance record",
        "Marathon organizers announce expanded safety protocols",
        "Criollos clinch playoff berth with late rally in San Juan",
        "Mayagüez soccer derby draws record midweek crowd",
        "Puerto Rico tennis open advances local juniors to semis",
        "Arecibo track meet crowns new island sprint champions",
        "Ponce basketball academy signs three college prospects",
        "Bayamón youth baseball tournament expands to 48 teams",
        "Caguas cycling classic returns with coastal stage route",
        "Island swimmers break records at Caribbean invite",
        "Guaynabo volleyball club wins regional title series",
        "Horse racing card at Camarero features stakes weekend",
        "Golfers tee off in Río Grande charity open",
        "Women's softball league launches island-wide draft",
        "Boxing undercard in Carolina fills outdoor arena",
        "College basketball tip-off brings rivalry back to Hato Rey",
        "Surfing circuit adds Rincón stop for winter season",
        "Triathlon organizers confirm Condado waterfront course",
        "High school football championship set for Mayagüez",
        "National soccer team announces friendlies in Bayamón",
        "Weightlifting federation hosts junior nationals in Caguas",
        "Esports tournament crowdfunds arena at San Juan campus",
        "Sailing regatta circles San Juan Bay under clear skies",
        "Cockfighting ban debate resurfaces ahead of sports bill",
        "Local MLB prospects train at winter camp in Gurabo",
        "Wheelchair basketball exhibition packs Ponce coliseum",
        "Cheerleading nationals open tryouts across the island",
        "Pickleball clubs petition for public courts in Carolina",
        "Mountain bike trails reopen in Utuado after storm repairs",
        "Fencing squad qualifies for Caribbean championships",
        "Handball federation schedules island cup in Arecibo",
        "Sports medicine clinic expands concussion protocols",
    ],
    "entertainment": [
        "Reggaeton festival lineup celebrates island artists",
        "Old San Juan film shoot closes streets for period drama",
        "Museum opens exhibit on bomba and plena traditions",
        "Theater company revives classic play with modern cast",
        "Food festival highlights regional chefs and artisans",
        "Carnival planners preview new parade route changes",
    ],
}

# Order matches DEFAULT_HOMEPAGE_SECTION_ITEMS / the public landing stack
# (Hero → Top Stories → More Top Stories → …). Older seeds put us-featured later.
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
        "position_key": "us-featured",
        "order_index": 1,
        "pinned": True,
        "pin_offset": 12,
        "limit": 12,
        "presentation_type": "featured_band",
        "display_name_us": "Top Stories",
        "display_name_co": "Colombia",
    },
    {
        "position_key": "more-top-stories",
        "order_index": 2,
        "pinned": True,
        "pin_offset": 24,
        "limit": 7,
        "presentation_type": "editorial_lead",
        "display_name_us": "More Top Stories",
        "display_name_co": "Más titulares",
    },
    {
        "position_key": "midterm-elections",
        "order_index": 3,
        "category_slug": "politics",
        "limit": 4,
        "presentation_type": "editorial_spotlight",
        "display_name_us": "Elections",
        "display_name_co": "Elecciones",
    },
    {
        "position_key": "editorial-rail",
        "order_index": 4,
        "limit": 5,
        "presentation_type": "rail_compact",
        "display_name_us": "Sports",
        "display_name_co": "Hoy",
    },
    {
        "position_key": "politics",
        "order_index": 5,
        "category_slug": "politics",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Politics",
        "display_name_co": "Política",
    },
    {
        "position_key": "sports",
        "order_index": 6,
        "category_slug": "sports",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Sports",
        "display_name_co": "Deportes",
    },
    {
        "position_key": "government",
        "order_index": 7,
        "category_slug": "government",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Government",
        "display_name_co": "Gobierno",
    },
    {
        "position_key": "health",
        "order_index": 8,
        "category_slug": "health",
        "limit": 20,
        "presentation_type": "live_carousel",
        "display_name_us": "Live",
        "display_name_co": "En Vivo",
    },
    {
        "position_key": "finance",
        "order_index": 9,
        "category_slug": "finance",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Health",
        "display_name_co": "Salud",
    },
    {
        "position_key": "entertainment",
        "order_index": 10,
        "category_slug": "entertainment",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Entertainment",
        "display_name_co": "Entretenimiento",
    },
    {
        "position_key": "world",
        "order_index": 11,
        "category_slug": "world",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "World",
        "display_name_co": "Mundo",
    },
    {
        "position_key": "technology",
        "order_index": 12,
        "category_slug": "technology",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Technology",
        "display_name_co": "Tecnología",
    },
    {
        "position_key": "business",
        "order_index": 13,
        "category_slug": "business",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Business",
        "display_name_co": "Negocios",
    },
    {
        "position_key": "more-top-stories-2",
        "order_index": 14,
        "pinned": True,
        "pin_offset": 31,
        "limit": 7,
        "presentation_type": "editorial_lead",
        "display_name_us": "Extra Stories",
        "display_name_co": "Historias extra",
    },
    {
        "position_key": "midterm-elections-2",
        "order_index": 15,
        "category_slug": "world",
        "limit": 4,
        "presentation_type": "editorial_spotlight",
        "display_name_us": "World watch",
        "display_name_co": "Panorama mundial",
    },
    {
        "position_key": "editorial-rail-2",
        "order_index": 16,
        "limit": 4,
        "presentation_type": "rail_compact",
        "display_name_us": "Featured",
        "display_name_co": "Destacados",
    },
    {
        "position_key": "us",
        "order_index": 17,
        "category_slug": "us",
        "limit": 7,
        "presentation_type": "grid_4",
        "display_name_us": "US",
        "display_name_co": "Colombia",
    },
    {
        "position_key": "style",
        "order_index": 18,
        "category_slug": "style",
        "limit": 4,
        "presentation_type": "grid_4",
        "display_name_us": "Style",
        "display_name_co": "Estilo",
    },
    {
        "position_key": "travel",
        "order_index": 19,
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
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Asia",
        "display_name_co": "Asia",
    },
    {
        "position_key": "world-regions",
        "order_index": 5,
        "category_slug": "world",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Oceania",
        "display_name_co": "Oceania",
    },
    {
        "position_key": "world-middle-east",
        "order_index": 6,
        "category_slug": "world",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Middle East",
        "display_name_co": "Medio Oriente",
    },
    {
        "position_key": "world-africa",
        "order_index": 7,
        "category_slug": "world",
        "limit": 12,
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
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Policy",
        "display_name_co": "Política Pública",
    },
    {
        "position_key": "politics-courts",
        "order_index": 5,
        "category_slug": "politics",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Courts & Law",
        "display_name_co": "Tribunales y Leyes",
    },
    {
        "position_key": "politics-state",
        "order_index": 6,
        "category_slug": "politics",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "State Politics",
        "display_name_co": "Política Estatal",
    },
    {
        "position_key": "politics-opinion",
        "order_index": 7,
        "category_slug": "politics",
        "limit": 12,
        "presentation_type": "grid_4",
        "display_name_us": "Opinion",
        "display_name_co": "Opinión",
    },
]

# Economía beats under parent slug `business` (public labels via i18n).
BUSINESS_CHILD_CATEGORIES: list[dict[str, str]] = [
    {
        "name": "Economy",
        "slug": "economy",
        "name_es": "Economía",
        "description": "Macroeconomy, prices, wages, and public finance.",
    },
    {
        "name": "Companies",
        "slug": "companies",
        "name_es": "Empresas",
        "description": "Companies, commerce, and corporate news.",
    },
    {
        "name": "Banking",
        "slug": "banking",
        "name_es": "Banca y finanzas",
        "description": "Banks, credit, and financial services.",
    },
    {
        "name": "Autos",
        "slug": "autos",
        "name_es": "Autos",
        "description": "Auto sales, dealers, and the vehicle industry.",
    },
    {
        "name": "Tourism",
        "slug": "tourism",
        "name_es": "Turismo",
        "description": "Hotels, airlines, and the visitor economy.",
    },
    {
        "name": "Construction",
        "slug": "construction",
        "name_es": "Construcción",
        "description": "Building, housing, and infrastructure projects.",
    },
    {
        "name": "Agriculture",
        "slug": "agriculture",
        "name_es": "Agricultura",
        "description": "Farms, food production, and rural markets.",
    },
]


def _business_page_slot_specs() -> list[dict[str, Any]]:
    """Build the Economía landing: hero plus compact beat rows."""

    specs: list[dict[str, Any]] = [
        {
            "position_key": "hero",
            "order_index": 0,
            "category_slug": "business",
            "limit": 30,
            "presentation_type": "hero",
            "display_name_us": "Economy",
            "display_name_co": "Economía",
        },
    ]
    for index, category in enumerate(BUSINESS_CHILD_CATEGORIES, start=1):
        specs.append(
            {
                "position_key": category["slug"],
                "order_index": index,
                "category_slug": category["slug"],
                "limit": 12,
                "presentation_type": "grid_4",
                "display_name_us": category["name"],
                "display_name_co": category["name_es"],
            },
        )
    return specs


BUSINESS_PAGE_SLOT_SPECS = _business_page_slot_specs()

TECHNOLOGY_CATEGORY_SLUG = "technology"

# Technology landing: Sports-like hero/Top Stories/Live filled from the
# technology category. Archive is pin-only (placement), without a Technology heading.
TECHNOLOGY_PAGE_SLOT_SPECS: list[dict[str, Any]] = [
    {
        "position_key": "hero",
        "order_index": 0,
        "category_slug": TECHNOLOGY_CATEGORY_SLUG,
        "limit": TECHNOLOGY_HERO_ARTICLE_LIMIT,
        "presentation_type": "hero",
        "display_name_us": "Technology",
        "display_name_co": "Tecnología",
    },
    {
        "position_key": "ad-ribbon",
        "order_index": 1,
        "limit": 0,
        "presentation_type": "ribbon_ad",
        "display_name_us": "Ribbon Advertisement",
        "display_name_co": "Anuncio de cinta",
    },
    {
        "position_key": "us-featured",
        "order_index": 2,
        "category_slug": TECHNOLOGY_CATEGORY_SLUG,
        "limit": TECHNOLOGY_TOP_STORIES_ARTICLE_LIMIT,
        "presentation_type": "featured_band",
        "display_name_us": "Top Stories",
        "display_name_co": "Noticias principales",
    },
    {
        "position_key": "ad-ribbon-2",
        "order_index": 3,
        "limit": 0,
        "presentation_type": "ribbon_ad",
        "display_name_us": "Ribbon Advertisement",
        "display_name_co": "Anuncio de cinta",
    },
    {
        "position_key": "health",
        "order_index": 4,
        "category_slug": TECHNOLOGY_CATEGORY_SLUG,
        "limit": TECHNOLOGY_LIVE_ARTICLE_LIMIT,
        "presentation_type": "live_carousel",
        "display_name_us": "Live",
        "display_name_co": "En Vivo",
    },
    {
        "position_key": "archive",
        "order_index": 5,
        "pinned": True,
        "pin_offset": 0,
        "limit": TECHNOLOGY_ARCHIVE_PIN_LIMIT,
        "presentation_type": "grid_4",
        "display_name_us": "Latest",
        "display_name_co": "Lo último",
    },
]


# Twelve stories per beat so compact carousels paginate (6 + 6).
BUSINESS_BEAT_STORIES: dict[str, list[str]] = {
    "economy": [
        "Treasury revises growth forecast after inflation cools",
        "Consumer prices ease for a third consecutive month",
        "Central bank holds rates as labor market cools",
        "Public debt debate shapes next fiscal year budget",
        "Wage growth outpaces inflation for first time this year",
        "Economists warn of slowdown if credit tightens further",
        "Household spending holds steady despite higher rents",
        "Trade deficit narrows as exports rebound",
        "Fuel prices drop after global supply outlook improves",
        "Unemployment stays near historic lows",
        "Small businesses report mixed outlook in quarterly survey",
        "Currency firms as investors return to emerging markets",
    ],
    "companies": [
        "Island retailer posts record quarterly sales",
        "Pharmaceutical plant announces second-shift hiring",
        "Local chain expands into three new municipalities",
        "Startup closes funding round to scale logistics software",
        "Family-owned manufacturer wins export contract",
        "Corporate merger draws regulator review",
        "Franchise group opens flagship store in San Juan",
        "Tech services firm relocates headquarters to Guaynabo",
        "Restaurant group reports rebound in weekend traffic",
        "Construction supplier lists shares on local exchange",
        "Beverage company invests in new bottling line",
        "Retailers cut prices ahead of back-to-school season",
    ],
    "banking": [
        "Island banks report growth in small-business lending",
        "Credit unions expand mortgage products for first-time buyers",
        "Regulators tighten capital rules for regional lenders",
        "ATM network outage prompts weekend customer alerts",
        "New digital bank opens branches in Bayamón and Ponce",
        "Interest on savings accounts rises after rate hold",
        "Commercial lenders compete for hotel refinancing deals",
        "Fraud alerts rise as check-washing scams spread",
        "Central bank reviews fees on international transfers",
        "Community banks launch farm-credit partnership",
        "Mortgage originations rebound as rates ease slightly",
        "Card networks cut interchange fees for local grocers",
    ],
    "autos": [
        "Dealers report surge in hybrid vehicle reservations",
        "Used-car prices ease after two years of spikes",
        "EV charging corridor planned along island highways",
        "Auto parts plant adds overnight production shift",
        "New pickup lineup arrives at San Juan dealerships",
        "Insurers raise premiums after parts-cost increases",
        "Ride-hail fleets shift toward compact hybrids",
        "Import tariffs debate hits luxury vehicle market",
        "Mechanics warn of delayed parts for older models",
        "Car-share service expands to airport and cruise docks",
        "Safety recall covers popular compact SUVs",
        "Dealership group opens certified pre-owned lot in Caguas",
    ],
    "tourism": [
        "Cruise season bookings top pre-pandemic levels",
        "Hotel occupancy rebounds in San Juan and Rincón",
        "Airlines add weekend flights for holiday travel",
        "Tour operators launch agro-tourism weekend packages",
        "Airport expansion aims to cut arrival wait times",
        "Beach towns report record July visitor spending",
        "Convention center books three international events",
        "Short-term rental rules reshape coastal inventory",
        "Hospitality workers ratify new wage agreement",
        "Eco-lodges report waitlists for winter season",
        "Port authority upgrades cruise terminal facilities",
        "Travel agencies push shoulder-season island packages",
    ],
    "construction": [
        "Housing starts rise as permit backlog clears",
        "Public works awards contracts for coastal road repairs",
        "Cement prices ease after import bottleneck lifts",
        "New mixed-use tower breaks ground in Hato Rey",
        "Contractors hire apprentices for school rebuilds",
        "Affordable-housing project adds 240 units in Bayamón",
        "Bridge retrofit timeline extended after inspection",
        "Developers pitch industrial park near port facilities",
        "Building-code update tightens hurricane standards",
        "Crane shortage delays two San Juan high-rises",
        "Municipality opens bids for water-main replacement",
        "Prefab housing plant scales production for rural towns",
    ],
    "agriculture": [
        "Coffee growers report stronger harvest after dry spell",
        "Plantain prices ease as local supply recovers",
        "Farmers market network expands to six new towns",
        "Drought aid reaches livestock producers in the south",
        "Hydroponic greenhouse opens near Caguas food hub",
        "Dairy cooperative invests in cold-storage upgrades",
        "Organic growers win supermarket shelf contracts",
        "Agricultural bank expands loans for irrigation systems",
        "Hurricane-resistant crop trials begin in the west",
        "Honey producers report rebound after hive losses",
        "School lunch program increases local produce orders",
        "Fisheries report stronger yellowtail landings this month",
    ],
}

# Default Puerto Rico Sports page section list (Horse Racing as one item).
PR_SPORT_SECTION_LABELS: list[str] = [
    "Baseball",
    "Basketball",
    "Boxing",
    "Volleyball",
    "Soccer",
    "Surfing",
    "Track and Field",
    "Tennis",
    "Golf",
    "Horse Racing",
]

# Twelve stories per sport so compact carousels get page 1 (6) + page 2 (6) with arrows.
PR_SPORT_SECTION_STORIES: dict[str, list[str]] = {
    "baseball": [
        "Criollos clinch playoff berth with late rally in San Juan",
        "Winter league baseball draws sold-out crowds in Carolina",
        "Bayamón youth baseball tournament expands to 48 teams",
        "Local MLB prospects train at winter camp in Gurabo",
        "Santurce shortstop leads league in stolen bases",
        "Caguas pitchers blank rivals in doubleheader sweep",
        "Ponce outfield prospect signs with mainland affiliate",
        "Arecibo catcher named winter league MVP finalist",
        "Mayagüez bullpen locks down late-inning wins",
        "Island coaches expand youth pitching clinics",
        "Carolina stadium upgrades night-game lighting",
        "San Juan series opener draws standing-room crowd",
    ],
    "basketball": [
        "National basketball team opens Olympic qualifying camp",
        "Ponce basketball academy signs three college prospects",
        "College basketball tip-off brings rivalry back to Hato Rey",
        "Wheelchair basketball exhibition packs Ponce coliseum",
        "Guaynabo BSN club extends winning streak to eight",
        "Arecibo juniors capture island basketball title",
        "Bayamón center averages double-double in playoff run",
        "Women's national squad announces Caribbean roster",
        "Caguas high school finals set attendance record",
        "Referee clinic certifies new island officials",
        "San Juan summer league expands to sixteen teams",
        "Mayagüez point guard earns conference honors",
    ],
    "boxing": [
        "Boricua boxer returns home after world-title defense",
        "Boxing undercard in Carolina fills outdoor arena",
        "San Juan gym crowns three new amateur champions",
        "Olympic hopefuls spar at Bayamón training center",
        "Women's boxing card sells out Coliseo Roberto Clemente",
        "Referee clinic updates safety rules for island bouts",
        "Lightweight prospect books first televised main event",
        "Ponce trainers open free youth boxing sessions",
        "Former champion announces comeback camp in Guaynabo",
        "Amateur tournament draws fighters from twelve towns",
        "Medical board tightens pre-fight concussion checks",
        "Arecibo venue hosts regional title eliminator",
    ],
    "volleyball": [
        "High school volleyball rivalry sets attendance record",
        "Guaynabo volleyball club wins regional title series",
        "National women's volleyball team announces summer roster",
        "Mayagüez hosts Caribbean volleyball invitational",
        "Indoor volleyball league expands to twelve towns",
        "Beach volleyball stop returns to Isla Verde shoreline",
        "Bayamón setters lead island all-star selections",
        "Caguas club clinches junior championship sweep",
        "San Juan open adds mixed doubles division",
        "Coaches clinic focuses on serve-receive drills",
        "Ponce arena upgrades courts for national qualifiers",
        "Arecibo Libero named tournament defensive MVP",
    ],
    "soccer": [
        "Mayagüez soccer derby draws record midweek crowd",
        "National soccer team announces friendlies in Bayamón",
        "Youth soccer academy opens new pitch in Caguas",
        "Island club advances in Caribbean club championship",
        "Referee association certifies thirty new officials",
        "Women's soccer league kicks off spring schedule",
        "San Juan striker leads golden boot race",
        "Ponce academy graduates sign first pro contracts",
        "Guaynabo derby ends in late equalizer drama",
        "Coastal clubs petition for lighted training fields",
        "Arecibo goalkeeper posts island-best save rate",
        "Carolina hosts youth futsal championship weekend",
    ],
    "surfing": [
        "Surf championship brings international athletes to Isabela",
        "Surfing circuit adds Rincón stop for winter season",
        "Jobos Beach contest crowns junior longboard winners",
        "Coastal cleanup pairs with surf festival in Aguadilla",
        "Local surfers qualify for Caribbean open final",
        "Wave forecast drives weekend crowds to northwest coast",
        "Women's shortboard final sets Isabela attendance mark",
        "Rincón schools add ocean safety surf clinics",
        "Photographers capture rare winter swell at Domes",
        "Junior team prepares for Central American qualifier",
        "Beach patrol expands weekend rescue coverage",
        "Aguadilla board makers debut sustainable designs",
    ],
    "track-and-field": [
        "Arecibo track meet crowns new island sprint champions",
        "National relay team breaks indoor record in San Juan",
        "High school track finals set for Bayamón stadium",
        "Javelin clinic draws athletes from across the island",
        "Marathon organizers announce expanded safety protocols",
        "Triathlon organizers confirm Condado waterfront course",
        "Caguas mid-distance runners sweep regional medals",
        "Ponce pole vault clinic fills weekend slots",
        "Women's 100 hurdles mark falls at island invite",
        "Mayagüez hosts multi-event youth championships",
        "Guaynabo throws circle opens after resurfacing",
        "Carolina road mile returns with elite field",
    ],
    "tennis": [
        "Puerto Rico tennis open advances local juniors to semis",
        "New public courts open in Carolina community park",
        "College tennis dual match returns to Mayagüez campus",
        "Island doubles pair qualifies for regional championship",
        "Wheelchair tennis exhibition held in Guaynabo",
        "Junior tennis camp expands scholarships for rural towns",
        "San Juan invitational crowns open singles champions",
        "Bayamón club installs six lighted hard courts",
        "Women's college team posts undefeated home stand",
        "Ponce juniors sweep Caribbean age-group titles",
        "Arecibo hosts weekend coaching certification course",
        "Caguas mixed doubles league opens spring season",
    ],
    "golf": [
        "Golfers tee off in Río Grande charity open",
        "Amateur golf championship moves to Dorado course",
        "Junior golf tour adds stop in Humacao",
        "Club pros host clinics for public-school athletes",
        "Women's golf invitational raises funds for youth sports",
        "Island golf association updates handicap rules",
        "Bayamón public course completes green renovation",
        "Mayagüez junior qualifier fills weekend tee sheet",
        "San Juan pro-am draws corporate field of forty",
        "Caguas high school golfers win regional title",
        "Ponce range expands junior after-school program",
        "Guaynabo senior open returns with record entries",
    ],
    "horse-racing": [
        "Horse racing card at Camarero features stakes weekend",
        "Local trainers prepare derby prospects at Camarero",
        "Jockey championship race draws record handle",
        "Stewards announce new equine welfare protocols",
        "Claiming races highlight midweek Camarero card",
        "Breeders showcase yearlings at island auction",
        "Fillies division stakes produce photo-finish drama",
        "Camarero expands barn safety inspections",
        "Apprentice jockeys earn first weekend winners",
        "Owners group funds track surface improvements",
        "Simulcast handle rises on Caribbean stakes day",
        "Veterinarians expand race-day fitness checks",
    ],
}

# Government page topics (USA + international), same compact-row count as Sports.
GOVERNMENT_SECTION_LABELS: list[str] = [
    "Executive",
    "Legislature",
    "Judiciary",
    "Agencies",
    "Services",
    "Emergency",
    "Defense",
]

# Entertainment page topics using the Sports landing template (no World band).
ENTERTAINMENT_SECTION_LABELS: list[str] = list(DEFAULT_ENTERTAINMENT_TOPIC_LABELS)

# Health page topics using the Entertainment landing template (no World band).
HEALTH_SECTION_LABELS: list[str] = list(DEFAULT_HEALTH_TOPIC_LABELS)

GOVERNMENT_CHILD_CATEGORIES: list[dict[str, str]] = [
    {
        "name": "Executive",
        "slug": "executive",
        "description": "Presidents, prime ministers, cabinets, and executive orders.",
    },
    {
        "name": "Legislature",
        "slug": "legislature",
        "description": "Congress, parliaments, and lawmaking.",
    },
    {
        "name": "Judiciary",
        "slug": "judiciary",
        "description": "Courts, rulings, and constitutional challenges.",
    },
    {
        "name": "Agencies",
        "slug": "agencies",
        "description": "Regulators and standing government bodies.",
    },
    {
        "name": "Services",
        "slug": "services",
        "description": "Public benefits, health systems, and civic services.",
    },
    {
        "name": "Emergency",
        "slug": "emergency",
        "description": "Disasters, civil defense, and emergency response.",
    },
    {
        "name": "Defense",
        "slug": "defense",
        "description": "Armed forces, alliances, and military policy.",
    },
]

GOVERNMENT_TOPIC_STORIES: dict[str, list[str]] = {
    "executive": [
        "White House issues executive order on federal AI procurement",
        "Cabinet secretaries brief governors on border coordination",
        "President meets G7 leaders on coordinated sanctions package",
        "Prime minister survives confidence vote after budget fight",
        "Executive branch names special envoy for Caribbean climate talks",
        "Oval Office sets timeline for infrastructure permitting overhaul",
        "French president hosts emergency summit on energy security",
        "Mexican executive branch expands federal police oversight",
        "UK Downing Street publishes civil-service reform white paper",
        "Brazilian presidency unveils Amazon conservation decree",
        "Canadian cabinet reshuffle elevates defense and health posts",
        "Colombian presidency launches rural development executive plan",
    ],
    "legislature": [
        "Senate advances stopgap funding as shutdown deadline nears",
        "House committee subpoenas agency records on disaster spending",
        "European Parliament votes on new migration screening rules",
        "Lawmakers revive bipartisan intelligence-oversight package",
        "Parliament debates emergency powers after storm season",
        "Congress schedules hearings on veterans benefits delays",
        "German Bundestag passes defense-spending authorization",
        "Mexican Congress reviews judicial-reform implementing bills",
        "UK Commons votes on public-service staffing caps",
        "Japanese Diet extends disaster-recovery appropriations",
        "Australian parliament probes intelligence-sharing gaps",
        "Colombian Congress debates rural land-titling overhaul",
    ],
    "judiciary": [
        "Supreme Court agrees to hear challenge to agency rulemaking",
        "Federal appeals court blocks detention-expansion order",
        "International Criminal Court opens new crimes-against-humanity docket",
        "High court reviews emergency-powers statute after floods",
        "Judges halt deportation flights pending asylum-screen review",
        "Constitutional court strikes down surveillance-data retention law",
        "State supreme court upholds voting-access expansion",
        "War-crimes tribunal schedules first hearings of the year",
        "Federal judge orders release of disaster-contract records",
        "European Court of Human Rights rules on protest restrictions",
        "National high court limits military courts over civilians",
        "Appeals panel restores whistleblower protections at a regulator",
    ],
    "agencies": [
        "EPA finalizes stricter drinking-water limits for utilities",
        "FDA recalls imported food after contamination findings",
        "IRS issues guidance on disaster-loss tax relief",
        "CDC updates respiratory-virus surveillance for the season",
        "WHO issues new pandemic-preparedness reporting rules",
        "Securities regulator fines firms over sanctions-evasion gaps",
        "Competition agency opens probe into port logistics fees",
        "Nuclear watchdog inspects power plants after seismic alerts",
        "Aviation authority tightens drone rules near airports",
        "Central bank supervisor warns lenders on climate risk",
        "Customs agency modernizes cargo screening at major ports",
        "Data-protection agency fines a ministry over leak response",
    ],
    "services": [
        "Social Security offices extend hours for benefit applications",
        "VA hospitals add mental-health clinics in three states",
        "Postal service restores delayed routes after storm damage",
        "National health service cuts wait times for specialist care",
        "Unemployment offices launch digital claims for disaster areas",
        "Public housing authority opens waitlist in coastal cities",
        "Veterans benefits backlog falls after staffing surge",
        "Transit agency expands reduced-fare program for seniors",
        "Education department accelerates student-aid disbursements",
        "Water utility restores service after treatment-plant outage",
        "Passport offices add weekend appointments before summer travel",
        "Pension service publishes new retirement-estimator tools",
    ],
    "emergency": [
        "FEMA pre-stages supplies as hurricane season peaks",
        "Civil defense issues flood warnings for coastal municipalities",
        "UN disaster office coordinates aid after earthquake",
        "National Guard deploys for wildfire containment in the west",
        "Emergency managers test tsunami sirens on the Pacific coast",
        "Red Cross and civil protection open cooling centers in heat wave",
        "Coast Guard leads search after ferry incident offshore",
        "Interior ministry activates volcano-evacuation routes",
        "Storm surge maps updated for Atlantic hurricane corridor",
        "Emergency broadcast system runs nationwide readiness test",
        "Field hospitals stand up after tropical storm landfall",
        "Disaster-recovery loans open for small businesses in the path",
    ],
    "defense": [
        "Pentagon requests supplemental funding for allied air defense",
        "NATO ministers raise readiness targets after security review",
        "Defense ministry announces Caribbean patrol rotation",
        "Joint exercises begin with partners in the Indo-Pacific",
        "Army modernizes hurricane-response engineering units",
        "Navy expands shipyard work to reduce maintenance backlog",
        "Air force tests new early-warning radar in the north",
        "Defense contractors face audit over spare-parts delays",
        "Peacekeeping contingent prepares for UN rotation",
        "Cyber command warns ministries of infrastructure probes",
        "Allied defense chiefs meet on ammunition stockpiles",
        "Military academies expand scholarships for technical officers",
    ],
}

GOVERNMENT_WORLD_STORIES: list[str] = [
    "UN Security Council schedules emergency session on regional ceasefire",
    "G20 ministers debate shared rules for cross-border disaster aid",
    "European Commission publishes new sanctions-compliance guidance",
    "OAS observers arrive for Caribbean election-integrity mission",
    "IMF and island finance ministers review hurricane-recovery facilities",
    "World Bank expands climate-resilience grants for coastal capitals",
    "International Court of Justice lists new maritime-boundary arguments",
    "NATO and partner governments coordinate hurricane-response airlift",
    "WHO member states vote on pandemic-treaty reporting deadlines",
    "UNHCR updates shelter standards after displacement in the region",
    "Interpol issues notice on sanctions-evasion networks in shipping",
    "Summit of the Americas draft communique focuses on energy security",
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
    {
        "code": "pr",
        "country": "Puerto Rico",
        "label": "Puerto Rico",
        "default_locale": "es-PR",
        "article_stories": PR_ARTICLE_STORIES,
        "display_name_key": "display_name_us",
        "breaking_items": [
            {"text": "Última hora: Noticia principal en San Juan", "severity": "high"},
            {"text": "Actualización: Nuevos detalles desde la isla", "severity": "medium"},
            {"text": "Política: Legislativo avanza reforma energética", "severity": "medium"},
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


async def _upsert_business_child_category(
    db: AsyncIOMotorDatabase,
    slug_to_id: dict[str, str],
    *,
    parent_id: str,
    category: dict[str, str],
) -> None:
    """Create or reparent one Economía beat category under business."""

    slug = category["slug"]
    fields = {
        "name": category["name"],
        "description": category["description"],
        "parent_id": parent_id,
    }
    existing = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
    if existing is not None:
        await db[CATEGORIES_COLLECTION].update_one({"_id": existing["_id"]}, {"$set": fields})
        slug_to_id[slug] = str(existing["_id"])
        return
    category_id = str(uuid4())
    await db[CATEGORIES_COLLECTION].insert_one(
        {
            "_id": category_id,
            "slug": slug,
            "created_at": _utc_now_iso(),
            **fields,
        },
    )
    slug_to_id[slug] = category_id
    logger.info("Created Economía beat category: %s", slug)


async def _ensure_business_child_categories(
    db: AsyncIOMotorDatabase,
    slug_to_id: dict[str, str],
) -> None:
    """Ensure Economía beat categories sit under the business parent."""

    parent_id = slug_to_id.get("business")
    if parent_id is None:
        raise RuntimeError("Missing business category before Economía children")
    for category in BUSINESS_CHILD_CATEGORIES:
        await _upsert_business_child_category(
            db,
            slug_to_id,
            parent_id=parent_id,
            category=category,
        )


async def _ensure_government_child_categories(
    db: AsyncIOMotorDatabase,
    slug_to_id: dict[str, str],
) -> None:
    """Ensure Government topic categories sit under the government parent."""

    parent_id = slug_to_id.get("government")
    if parent_id is None:
        raise RuntimeError("Missing government category before Government children")
    for category in GOVERNMENT_CHILD_CATEGORIES:
        await _upsert_business_child_category(
            db,
            slug_to_id,
            parent_id=parent_id,
            category=category,
        )


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


def _seed_article_category_ids(
    slug_to_category_id: dict[str, str],
    *,
    category_slug: str,
    category_id: str,
) -> list[str]:
    """Return category ids for a seeded article, including Government parent.

    Topic stories are stored on child slugs (executive, legislature, ...). Homepage
    and Government hero slots query the parent ``government`` category, so those
    stories must also carry the parent id.
    """

    ids = [category_id]
    if category_slug in GOVERNMENT_TOPIC_STORIES:
        parent_id = slug_to_category_id.get("government")
        if parent_id and parent_id not in ids:
            ids.insert(0, parent_id)
    return ids


def _government_slot_category_slug(position_key: str) -> str | None:
    """Map a government-page slot key to the category slug that should fill it."""

    preserved = {
        "hero": "government",
        "us-featured": "government",
        "health": "health",
        "world": "government-page-world",
    }
    if position_key in preserved:
        return preserved[position_key]
    child_slugs = {row["slug"] for row in GOVERNMENT_CHILD_CATEGORIES}
    if position_key in child_slugs:
        return position_key
    return None


async def _set_slot_query_category_id(
    db: AsyncIOMotorDatabase,
    slot_id: str,
    category_id: str,
) -> None:
    """Attach ``category_id`` to a slot query rule without clearing pins or limit."""

    slot = await db[SLOTS_COLLECTION].find_one({"_id": slot_id}, {"query_rule": 1})
    if slot is None:
        return
    query_rule = dict(slot.get("query_rule") or {})
    query_rule["category_id"] = category_id
    query_rule.setdefault("limit", 12)
    await db[SLOTS_COLLECTION].update_one(
        {"_id": slot_id},
        {"$set": {"query_rule": query_rule}},
    )


async def _stamp_government_page_category_fill(
    db: AsyncIOMotorDatabase,
    slug_to_category_id: dict[str, str],
) -> None:
    """Write category auto-fill onto government page slots so seeded stories appear."""

    cursor = db[LAYOUTS_COLLECTION].find({"page_name": "government"}, {"_id": 1})
    async for layout in cursor:
        slots = db[SLOTS_COLLECTION].find({"layout_id": layout["_id"]}, {"_id": 1, "position_key": 1})
        async for slot in slots:
            slug = _government_slot_category_slug(str(slot.get("position_key") or ""))
            category_id = slug_to_category_id.get(slug) if slug else None
            if not category_id:
                continue
            await _set_slot_query_category_id(db, str(slot["_id"]), category_id)


def _entertainment_slot_category_slug(position_key: str) -> str | None:
    """Map an entertainment-page slot key to the category slug that should fill it."""

    from shared.core.entertainment_page_sections_sync import slugify_entertainment_label

    preserved = {
        "hero": "entertainment",
        "us-featured": "entertainment",
        "health": "health",
        "entertainment": "entertainment",
    }
    if position_key in preserved:
        return preserved[position_key]
    if position_key.startswith("ad-ribbon"):
        return None
    topic_slugs = {slugify_entertainment_label(label) for label in ENTERTAINMENT_SECTION_LABELS}
    if position_key in topic_slugs:
        return position_key
    return None


async def _stamp_entertainment_page_category_fill(db: AsyncIOMotorDatabase) -> None:
    """Write category auto-fill onto entertainment page slots so seeded stories appear.

    Args:
        db: Database connection.
    """

    cursor = db[LAYOUTS_COLLECTION].find({"page_name": "entertainment"}, {"_id": 1})
    async for layout in cursor:
        slots = db[SLOTS_COLLECTION].find({"layout_id": layout["_id"]}, {"_id": 1, "position_key": 1})
        async for slot in slots:
            slug = _entertainment_slot_category_slug(str(slot.get("position_key") or ""))
            if not slug:
                continue
            category = await db[CATEGORIES_COLLECTION].find_one({"slug": slug}, {"_id": 1})
            if category is None:
                continue
            await _set_slot_query_category_id(db, str(slot["_id"]), str(category["_id"]))


def _health_slot_category_slug(position_key: str) -> str | None:
    """Map a health-page slot key to the category slug that should fill it."""

    from shared.core.health_page_sections_sync import slugify_health_label

    preserved = {
        "hero": "finance",
        "us-featured": "finance",
        "health": "health",
        "finance": "finance",
    }
    if position_key in preserved:
        return preserved[position_key]
    if position_key.startswith("ad-ribbon"):
        return None
    topic_slugs = {slugify_health_label(label) for label in HEALTH_SECTION_LABELS}
    if position_key in topic_slugs:
        return position_key
    return None


async def _stamp_health_page_category_fill(db: AsyncIOMotorDatabase) -> None:
    """Write category auto-fill onto health page slots so seeded stories appear.

    Args:
        db: Database connection.
    """

    cursor = db[LAYOUTS_COLLECTION].find({"page_name": "health"}, {"_id": 1})
    async for layout in cursor:
        slots = db[SLOTS_COLLECTION].find({"layout_id": layout["_id"]}, {"_id": 1, "position_key": 1})
        async for slot in slots:
            slug = _health_slot_category_slug(str(slot.get("position_key") or ""))
            if not slug:
                continue
            category = await db[CATEGORIES_COLLECTION].find_one({"slug": slug}, {"_id": 1})
            if category is None:
                continue
            await _set_slot_query_category_id(db, str(slot["_id"]), str(category["_id"]))


async def _stamp_homepage_government_category_fill(
    db: AsyncIOMotorDatabase,
    slug_to_category_id: dict[str, str],
) -> None:
    """Write parent Government category fill onto homepage government slots."""

    category_id = slug_to_category_id["government"]
    cursor = db[SLOTS_COLLECTION].find({"position_key": "government"}, {"_id": 1})
    async for slot in cursor:
        await _set_slot_query_category_id(db, str(slot["_id"]), category_id)


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
            fields["category_ids"] = _seed_article_category_ids(
                slug_to_category_id,
                category_slug=category_slug,
                category_id=category_id,
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
            doc["category_ids"] = fields["category_ids"]
            await db[ARTICLES_COLLECTION].insert_one(doc)
            article_ids.append(article_id)

    logger.info("Ensured %d articles for market %s", len(article_ids), market_code)
    return article_ids


async def _ensure_pr_town_category_article(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    market_id: str,
    town_id: str,
    category_slug: str,
    category_id: str,
    now: str,
) -> None:
    """Create or refresh one town-scoped article for a homepage category."""

    title = f"{PR_TOWN_LABELS[town_id]} {category_slug} update"
    existing = await db[ARTICLES_COLLECTION].find_one(
        {
            "category_id": category_id,
            "market_ids": market_id,
            "town_id": town_id,
            "title": title,
        },
    )
    fields = _market_article_fields(
        title,
        title=title,
        market_code="pr",
        category_slug=category_slug,
        video_url=None,
        now=now,
    )
    if existing is not None:
        await db[ARTICLES_COLLECTION].update_one({"_id": existing["_id"]}, {"$set": fields})
        return
    await db[ARTICLES_COLLECTION].insert_one(
        {
            "_id": str(uuid4()),
            "slug": f"pr-{town_id}-{category_slug}-{uuid4().hex[:8]}",
            "status": "published",
            "author_id": author_id,
            "category_id": category_id,
            "market_ids": [market_id],
            "town_id": town_id,
            "media_ids": [],
            "view_count": 0,
            "created_at": now,
            **fields,
        },
    )


async def _ensure_puerto_rico_town_articles(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    market_id: str,
    slug_to_category_id: dict[str, str],
) -> None:
    """Create or update town-scoped articles for each Puerto Rico municipality."""

    us_category_id = slug_to_category_id["us"]
    for town_id in PUERTO_RICO_TOWN_IDS:
        title = _pr_town_headline(town_id)
        existing = await db[ARTICLES_COLLECTION].find_one(
            {
                "category_id": us_category_id,
                "market_ids": market_id,
                "town_id": town_id,
                "title": title,
            },
        )
        now = _utc_now_iso()
        fields = _market_article_fields(
            title,
            title=title,
            market_code="pr",
            category_slug="us",
            video_url=None,
            now=now,
        )
        if existing is not None:
            await db[ARTICLES_COLLECTION].update_one(
                {"_id": existing["_id"]},
                {"$set": fields},
            )
        else:
            article_id = str(uuid4())
            doc = {
                "_id": article_id,
                "slug": f"pr-{town_id}-local-{article_id[:8]}",
                "status": "published",
                "author_id": author_id,
                "category_id": us_category_id,
                "market_ids": [market_id],
                "town_id": town_id,
                "media_ids": [],
                "view_count": 0,
                "created_at": now,
                **fields,
            }
            await db[ARTICLES_COLLECTION].insert_one(doc)

        for category_slug in PR_TOWN_CATEGORY_SLUGS:
            await _ensure_pr_town_category_article(
                db,
                author_id=author_id,
                market_id=market_id,
                town_id=town_id,
                category_slug=category_slug,
                category_id=slug_to_category_id[category_slug],
                now=now,
            )

    logger.info("Ensured Puerto Rico town articles for market pr")


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

    limit = int(spec["limit"]) if spec.get("limit") is not None else 4
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


async def _ensure_market_business_page(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    market_code: str,
    display_name_key: str,
    slug_to_category_id: dict[str, str],
    pinned_article_ids: list[str],
) -> None:
    """Seed the Economía section page layout and slots for a market."""
    await _ensure_market_page(
        db,
        page_name="business",
        slot_specs=BUSINESS_PAGE_SLOT_SPECS,
        market_id=market_id,
        market_code=market_code,
        display_name_key=display_name_key,
        slug_to_category_id=slug_to_category_id,
        pinned_article_ids=pinned_article_ids,
    )


async def _published_article_ids_for_category(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    category_id: str,
) -> list[str]:
    """Return published article ids for one market and category.

    Args:
        db: Database connection.
        market_id: Market document id.
        category_id: Category document id.

    Returns:
        Article ids in the market for that category.
    """

    cursor = db[ARTICLES_COLLECTION].find(
        {
            "status": "published",
            "market_ids": market_id,
            "category_id": category_id,
        },
        {"_id": 1},
    )
    return [str(doc["_id"]) async for doc in cursor]


async def _ensure_market_technology_page(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    market_code: str,
    display_name_key: str,
    slug_to_category_id: dict[str, str],
) -> None:
    """Seed Technology hero/Top Stories/Live plus a pin-only archive."""

    technology_ids = await _published_article_ids_for_category(
        db,
        market_id=market_id,
        category_id=slug_to_category_id[TECHNOLOGY_CATEGORY_SLUG],
    )
    await _ensure_market_page(
        db,
        page_name=PAGE_NAME_TECHNOLOGY,
        slot_specs=TECHNOLOGY_PAGE_SLOT_SPECS,
        market_id=market_id,
        market_code=market_code,
        display_name_key=display_name_key,
        slug_to_category_id=slug_to_category_id,
        pinned_article_ids=technology_ids,
    )


async def _ensure_market_sports_sections(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    market_code: str,
) -> None:
    """Seed per-market sports section config and sync the sports layout."""

    from shared.core.sports_page_sections_sync import slugify_sport_label, sync_sports_layout_slots
    from shared.read.collections import SPORTS_PAGE_SECTIONS_COLLECTION

    labels = PR_SPORT_SECTION_LABELS if market_code == "pr" else []
    items = [{"slug": slugify_sport_label(label), "label": label} for label in labels]
    now = _utc_now_iso()
    existing = await db[SPORTS_PAGE_SECTIONS_COLLECTION].find_one(
        {
            "market_id": market_id,
            "$or": [{"region_id": None}, {"region_id": {"$exists": False}}],
        },
        {"_id": 1},
    )
    if existing is not None:
        await db[SPORTS_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": {"items": items, "updated_at": now, "region_id": None}},
        )
    else:
        await db[SPORTS_PAGE_SECTIONS_COLLECTION].insert_one(
            {
                "_id": str(uuid4()),
                "market_id": market_id,
                "region_id": None,
                "items": items,
                "updated_at": now,
            },
        )
    await sync_sports_layout_slots(db, market_id=market_id, items=items, region_id=None)
    logger.info("Seeded sports sections for market %s (%d items)", market_code, len(items))


async def _ensure_us_state_sports_sections(db: AsyncIOMotorDatabase) -> None:
    """Seed sports lists for US states, Florida counties, and PR towns."""

    from shared.core.sports_page_sections_sync import ensure_geo_sports_sections

    result = await ensure_geo_sports_sections(db, labels=PR_SPORT_SECTION_LABELS)
    logger.info("Seeded geo sports sections: %s", result)


async def _ensure_market_government_sections(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    market_code: str,
) -> None:
    """Seed per-market government section config and sync the government layout."""

    from shared.core.government_page_sections_sync import (
        default_government_page_section_items,
        sync_government_layout_slots,
    )
    from shared.read.collections import GOVERNMENT_PAGE_SECTIONS_COLLECTION

    items = default_government_page_section_items(GOVERNMENT_SECTION_LABELS)
    now = _utc_now_iso()
    existing = await db[GOVERNMENT_PAGE_SECTIONS_COLLECTION].find_one(
        {
            "market_id": market_id,
            "$or": [{"region_id": None}, {"region_id": {"$exists": False}}],
        },
        {"_id": 1},
    )
    if existing is not None:
        await db[GOVERNMENT_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": {"items": items, "updated_at": now, "region_id": None}},
        )
    else:
        await db[GOVERNMENT_PAGE_SECTIONS_COLLECTION].insert_one(
            {
                "_id": str(uuid4()),
                "market_id": market_id,
                "region_id": None,
                "items": items,
                "updated_at": now,
            },
        )
    await sync_government_layout_slots(db, market_id=market_id, items=items, region_id=None)
    logger.info(
        "Seeded government sections for market %s (%d items)",
        market_code,
        len(items),
    )


async def _ensure_us_state_government_sections(db: AsyncIOMotorDatabase) -> None:
    """Seed government lists for US states, Florida counties, and PR towns."""

    from shared.core.government_page_sections_sync import ensure_geo_government_sections

    result = await ensure_geo_government_sections(db, labels=GOVERNMENT_SECTION_LABELS)
    logger.info("Seeded geo government sections: %s", result)


async def _ensure_market_entertainment_sections(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    market_code: str,
) -> None:
    """Seed per-market entertainment section config and sync the entertainment layout."""

    from shared.core.entertainment_page_sections_sync import (
        default_entertainment_page_section_items,
        sync_entertainment_layout_slots,
    )
    from shared.read.collections import ENTERTAINMENT_PAGE_SECTIONS_COLLECTION

    items = default_entertainment_page_section_items(ENTERTAINMENT_SECTION_LABELS)
    now = _utc_now_iso()
    existing = await db[ENTERTAINMENT_PAGE_SECTIONS_COLLECTION].find_one(
        {
            "market_id": market_id,
            "$or": [{"region_id": None}, {"region_id": {"$exists": False}}],
        },
        {"_id": 1},
    )
    if existing is not None:
        await db[ENTERTAINMENT_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": {"items": items, "updated_at": now, "region_id": None}},
        )
    else:
        await db[ENTERTAINMENT_PAGE_SECTIONS_COLLECTION].insert_one(
            {
                "_id": str(uuid4()),
                "market_id": market_id,
                "region_id": None,
                "items": items,
                "updated_at": now,
            },
        )
    await sync_entertainment_layout_slots(db, market_id=market_id, items=items, region_id=None)
    logger.info(
        "Seeded entertainment sections for market %s (%d items)",
        market_code,
        len(items),
    )


async def _ensure_us_state_entertainment_sections(db: AsyncIOMotorDatabase) -> None:
    """Seed entertainment lists for US states, Florida counties, and PR towns."""

    from shared.core.entertainment_page_sections_sync import ensure_geo_entertainment_sections

    result = await ensure_geo_entertainment_sections(db, labels=ENTERTAINMENT_SECTION_LABELS)
    logger.info("Seeded geo entertainment sections: %s", result)


async def _ensure_market_health_sections(
    db: AsyncIOMotorDatabase,
    *,
    market_id: str,
    market_code: str,
) -> None:
    """Seed per-market health section config and sync the health layout."""

    from shared.core.health_page_sections_sync import (
        default_health_page_section_items,
        sync_health_layout_slots,
    )
    from shared.read.collections import HEALTH_PAGE_SECTIONS_COLLECTION

    items = default_health_page_section_items(HEALTH_SECTION_LABELS)
    now = _utc_now_iso()
    existing = await db[HEALTH_PAGE_SECTIONS_COLLECTION].find_one(
        {
            "market_id": market_id,
            "$or": [{"region_id": None}, {"region_id": {"$exists": False}}],
        },
        {"_id": 1},
    )
    if existing is not None:
        await db[HEALTH_PAGE_SECTIONS_COLLECTION].update_one(
            {"_id": existing["_id"]},
            {"$set": {"items": items, "updated_at": now, "region_id": None}},
        )
    else:
        await db[HEALTH_PAGE_SECTIONS_COLLECTION].insert_one(
            {
                "_id": str(uuid4()),
                "market_id": market_id,
                "region_id": None,
                "items": items,
                "updated_at": now,
            },
        )
    await sync_health_layout_slots(db, market_id=market_id, items=items, region_id=None)
    logger.info(
        "Seeded health sections for market %s (%d items)",
        market_code,
        len(items),
    )


async def _ensure_us_state_health_sections(db: AsyncIOMotorDatabase) -> None:
    """Seed health lists for US states, Florida counties, and PR towns."""

    from shared.core.health_page_sections_sync import ensure_geo_health_sections

    result = await ensure_geo_health_sections(db, labels=HEALTH_SECTION_LABELS)
    logger.info("Seeded geo health sections: %s", result)


def _health_seed_headlines(label: str) -> list[str]:
    """Twelve headlines so compact Health rows paginate like Entertainment."""

    return [
        f"{label} clinics expand weekend hours in San Juan",
        f"New {label} study guides island wellness programs",
        f"Island {label} campaign launches in schools",
        f"{label} specialists join regional hospital network",
        f"Community centers add {label} workshops after grant",
        f"{label} tips shared at municipal health fair",
        f"Insurers expand coverage for {label} services",
        f"{label} research partnership grows across Caribbean",
        f"Families praise new wave of island {label} care",
        f"{label} centers reopen after renovation",
        f"Youth {label} program expands to 20 towns",
        f"{label} awareness week returns this fall",
    ]


async def _ensure_pr_health_section_articles(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    market_id: str,
) -> None:
    """Seed Puerto Rico articles for each configured health section category."""

    from shared.core.health_page_sections_sync import slugify_health_label

    parent = await db[CATEGORIES_COLLECTION].find_one({"slug": "finance"}, {"_id": 1})
    parent_id = str(parent["_id"]) if parent else None
    for label in HEALTH_SECTION_LABELS:
        slug = slugify_health_label(label)
        category = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
        if category is None:
            raise RuntimeError(f"Missing health category after sync: {slug}")
        category_id = str(category["_id"])
        category_ids = [parent_id, category_id] if parent_id else [category_id]
        for story in _health_seed_headlines(label):
            await _upsert_pr_health_story(
                db,
                author_id=author_id,
                market_id=market_id,
                category_id=category_id,
                category_ids=category_ids,
                slug=slug,
                story=story,
            )
    logger.info("Ensured Puerto Rico health-section articles for market pr")


async def _upsert_pr_health_story(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    market_id: str,
    category_id: str,
    category_ids: list[str],
    slug: str,
    story: str,
) -> None:
    """Insert or update one Puerto Rico health topic article.

    Args:
        db: Database connection.
        author_id: Admin user id for newly inserted articles.
        market_id: Puerto Rico market document id.
        category_id: Topic category document id.
        category_ids: Category ids including the Health parent (finance).
        slug: Topic category slug.
        story: Headline used as the article title.
    """

    existing = await db[ARTICLES_COLLECTION].find_one(
        {"category_id": category_id, "market_ids": market_id, "title": story},
    )
    now = _utc_now_iso()
    fields = _market_article_fields(
        story,
        title=story,
        market_code="pr",
        category_slug=slug,
        video_url=None,
        now=now,
    )
    fields["category_ids"] = category_ids
    if existing is not None:
        await db[ARTICLES_COLLECTION].update_one({"_id": existing["_id"]}, {"$set": fields})
        return
    article_id = str(uuid4())
    doc = _new_market_article_doc(
        article_id=article_id,
        author_id=author_id,
        market_id=market_id,
        category_id=category_id,
        market_code="pr",
        category_slug=slug,
        story=story,
        title=story,
        video_url=None,
        now=now,
    )
    doc["category_ids"] = category_ids
    await db[ARTICLES_COLLECTION].insert_one(doc)


def _entertainment_seed_headlines(label: str) -> list[str]:
    """Twelve headlines so compact Entertainment rows paginate like Sports."""

    return [
        f"{label} festival draws crowds in San Juan",
        f"New {label} showcase opens in Old San Juan",
        f"Island {label} awards honor emerging talent",
        f"{label} premiere sells out opening night",
        f"Schools add {label} workshops after grant",
        f"{label} exhibit tours museums across Puerto Rico",
        f"Streaming special spotlights local {label}",
        f"{label} producers expand Caribbean partnerships",
        f"Critics praise new wave of island {label}",
        f"{label} venues reopen after renovation",
        f"Youth {label} program expands to 20 towns",
        f"{label} week returns to Condado this fall",
    ]


async def _ensure_pr_entertainment_section_articles(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    market_id: str,
) -> None:
    """Seed Puerto Rico articles for each configured entertainment section category."""

    from shared.core.entertainment_page_sections_sync import slugify_entertainment_label

    parent = await db[CATEGORIES_COLLECTION].find_one({"slug": "entertainment"}, {"_id": 1})
    parent_id = str(parent["_id"]) if parent else None
    for label in ENTERTAINMENT_SECTION_LABELS:
        slug = slugify_entertainment_label(label)
        category = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
        if category is None:
            raise RuntimeError(f"Missing entertainment category after sync: {slug}")
        category_id = str(category["_id"])
        category_ids = [parent_id, category_id] if parent_id else [category_id]
        for story in _entertainment_seed_headlines(label):
            await _upsert_pr_entertainment_story(
                db,
                author_id=author_id,
                market_id=market_id,
                category_id=category_id,
                category_ids=category_ids,
                slug=slug,
                story=story,
            )
    logger.info("Ensured Puerto Rico entertainment-section articles for market pr")


async def _upsert_pr_entertainment_story(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    market_id: str,
    category_id: str,
    category_ids: list[str],
    slug: str,
    story: str,
) -> None:
    """Insert or update one Puerto Rico entertainment topic article.

    Args:
        db: Database connection.
        author_id: Admin user id for newly inserted articles.
        market_id: Puerto Rico market document id.
        category_id: Topic category document id.
        category_ids: Category ids including the Entertainment parent.
        slug: Topic category slug.
        story: Headline used as the article title.
    """

    existing = await db[ARTICLES_COLLECTION].find_one(
        {"category_id": category_id, "market_ids": market_id, "title": story},
    )
    now = _utc_now_iso()
    fields = _market_article_fields(
        story,
        title=story,
        market_code="pr",
        category_slug=slug,
        video_url=None,
        now=now,
    )
    fields["category_ids"] = category_ids
    if existing is not None:
        await db[ARTICLES_COLLECTION].update_one({"_id": existing["_id"]}, {"$set": fields})
        return
    article_id = str(uuid4())
    doc = _new_market_article_doc(
        article_id=article_id,
        author_id=author_id,
        market_id=market_id,
        category_id=category_id,
        market_code="pr",
        category_slug=slug,
        story=story,
        title=story,
        video_url=None,
        now=now,
    )
    doc["category_ids"] = category_ids
    await db[ARTICLES_COLLECTION].insert_one(doc)


async def _ensure_pr_sport_section_articles(
    db: AsyncIOMotorDatabase,
    *,
    author_id: str,
    market_id: str,
) -> None:
    """Seed Puerto Rico articles for each configured sport section category."""

    for slug, stories in PR_SPORT_SECTION_STORIES.items():
        category = await db[CATEGORIES_COLLECTION].find_one({"slug": slug})
        if category is None:
            raise RuntimeError(f"Missing sport category after sync: {slug}")
        category_id = str(category["_id"])
        for story in stories:
            existing = await db[ARTICLES_COLLECTION].find_one(
                {
                    "category_id": category_id,
                    "market_ids": market_id,
                    "title": story,
                },
            )
            now = _utc_now_iso()
            fields = _market_article_fields(
                story,
                title=story,
                market_code="pr",
                category_slug=slug,
                video_url=None,
                now=now,
            )
            if existing is not None:
                await db[ARTICLES_COLLECTION].update_one({"_id": existing["_id"]}, {"$set": fields})
                continue
            article_id = str(uuid4())
            await db[ARTICLES_COLLECTION].insert_one(
                _new_market_article_doc(
                    article_id=article_id,
                    author_id=author_id,
                    market_id=market_id,
                    category_id=category_id,
                    market_code="pr",
                    category_slug=slug,
                    story=story,
                    title=story,
                    video_url=None,
                    now=now,
                ),
            )
    logger.info("Ensured Puerto Rico sport-section articles for market pr")


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


async def _ensure_geo_regions_and_backfill() -> None:
    """Run geo hierarchy backfill so seeded data is region-ready."""

    from pathlib import Path

    from migrations.backfill_geo_regions import run_backfill

    report = await run_backfill(
        dry_run=False,
        report_path=Path("backend/admin_app/migrations/reports/seed_geo_reconciliation.json"),
    )
    logger.info("Geo backfill complete: %s", report.get("reconciliation"))


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
        await _ensure_business_child_categories(db, slug_to_category_id)
        await _ensure_government_child_categories(db, slug_to_category_id)

        for market in MARKET_DEFS:
            code = str(market["code"])
            market_id = market_code_to_id[code]
            article_ids = await _ensure_market_articles(
                db,
                author_id=str(admin["_id"]),
                market_id=market_id,
                market_code=code,
                article_stories={
                    **market["article_stories"],
                    **BUSINESS_BEAT_STORIES,
                    **GOVERNMENT_TOPIC_STORIES,
                    "government-page-world": GOVERNMENT_WORLD_STORIES,
                },
                slug_to_category_id=slug_to_category_id,
            )
            if code == "pr":
                await _ensure_puerto_rico_town_articles(
                    db,
                    author_id=str(admin["_id"]),
                    market_id=market_id,
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
            await _ensure_market_business_page(
                db,
                market_id=market_id,
                market_code=code,
                display_name_key=str(market["display_name_key"]),
                slug_to_category_id=slug_to_category_id,
                pinned_article_ids=article_ids,
            )
            await _ensure_market_technology_page(
                db,
                market_id=market_id,
                market_code=code,
                display_name_key=str(market["display_name_key"]),
                slug_to_category_id=slug_to_category_id,
            )
            await _ensure_market_sports_sections(
                db,
                market_id=market_id,
                market_code=code,
            )
            await _ensure_market_government_sections(
                db,
                market_id=market_id,
                market_code=code,
            )
            await _ensure_market_entertainment_sections(
                db,
                market_id=market_id,
                market_code=code,
            )
            await _ensure_market_health_sections(
                db,
                market_id=market_id,
                market_code=code,
            )
            if code == "pr":
                await _ensure_pr_sport_section_articles(
                    db,
                    author_id=str(admin["_id"]),
                    market_id=market_id,
                )
                await _ensure_pr_entertainment_section_articles(
                    db,
                    author_id=str(admin["_id"]),
                    market_id=market_id,
                )
                await _ensure_pr_health_section_articles(
                    db,
                    author_id=str(admin["_id"]),
                    market_id=market_id,
                )

        await _ensure_breaking_widgets(db)
        await _ensure_geo_regions_and_backfill()
        await _ensure_us_state_sports_sections(db)
        await _ensure_us_state_government_sections(db)
        await _ensure_us_state_entertainment_sections(db)
        await _ensure_us_state_health_sections(db)
        await _stamp_government_page_category_fill(db, slug_to_category_id)
        await _stamp_homepage_government_category_fill(db, slug_to_category_id)
        await _stamp_entertainment_page_category_fill(db)
        await _stamp_health_page_category_fill(db)
        await _invalidate_homepage_feed_cache()
    finally:
        client.close()


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_dev())
