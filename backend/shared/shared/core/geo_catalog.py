"""Canonical geo catalogs for US/PR editorial placement scopes."""

from __future__ import annotations

# (state_code, label) — matches frontend/lib/us-states.ts
US_STATE_OPTIONS: tuple[tuple[str, str], ...] = (
    ("al", "Alabama"),
    ("ak", "Alaska"),
    ("az", "Arizona"),
    ("ar", "Arkansas"),
    ("ca", "California"),
    ("co", "Colorado"),
    ("ct", "Connecticut"),
    ("de", "Delaware"),
    ("fl", "Florida"),
    ("ga", "Georgia"),
    ("hi", "Hawaii"),
    ("id", "Idaho"),
    ("il", "Illinois"),
    ("in", "Indiana"),
    ("ia", "Iowa"),
    ("ks", "Kansas"),
    ("ky", "Kentucky"),
    ("la", "Louisiana"),
    ("me", "Maine"),
    ("md", "Maryland"),
    ("ma", "Massachusetts"),
    ("mi", "Michigan"),
    ("mn", "Minnesota"),
    ("ms", "Mississippi"),
    ("mo", "Missouri"),
    ("mt", "Montana"),
    ("ne", "Nebraska"),
    ("nv", "Nevada"),
    ("nh", "New Hampshire"),
    ("nj", "New Jersey"),
    ("nm", "New Mexico"),
    ("ny", "New York"),
    ("nc", "North Carolina"),
    ("nd", "North Dakota"),
    ("oh", "Ohio"),
    ("ok", "Oklahoma"),
    ("or", "Oregon"),
    ("pa", "Pennsylvania"),
    ("ri", "Rhode Island"),
    ("sc", "South Carolina"),
    ("sd", "South Dakota"),
    ("tn", "Tennessee"),
    ("tx", "Texas"),
    ("ut", "Utah"),
    ("vt", "Vermont"),
    ("va", "Virginia"),
    ("wa", "Washington"),
    ("wv", "West Virginia"),
    ("wi", "Wisconsin"),
    ("wy", "Wyoming"),
)

# (county_slug, label) — matches frontend/lib/florida-counties.ts
FLORIDA_COUNTY_OPTIONS: tuple[tuple[str, str], ...] = (
    ("alachua", "Alachua"),
    ("baker", "Baker"),
    ("bay", "Bay"),
    ("bradford", "Bradford"),
    ("brevard", "Brevard"),
    ("broward", "Broward"),
    ("calhoun", "Calhoun"),
    ("charlotte", "Charlotte"),
    ("citrus", "Citrus"),
    ("clay", "Clay"),
    ("collier", "Collier"),
    ("columbia", "Columbia"),
    ("desoto", "DeSoto"),
    ("dixie", "Dixie"),
    ("duval", "Duval"),
    ("escambia", "Escambia"),
    ("flagler", "Flagler"),
    ("franklin", "Franklin"),
    ("gadsden", "Gadsden"),
    ("gilchrist", "Gilchrist"),
    ("glades", "Glades"),
    ("gulf", "Gulf"),
    ("hamilton", "Hamilton"),
    ("hardee", "Hardee"),
    ("hendry", "Hendry"),
    ("hernando", "Hernando"),
    ("highlands", "Highlands"),
    ("hillsborough", "Hillsborough"),
    ("holmes", "Holmes"),
    ("indian-river", "Indian River"),
    ("jackson", "Jackson"),
    ("jefferson", "Jefferson"),
    ("lafayette", "Lafayette"),
    ("lake", "Lake"),
    ("lee", "Lee"),
    ("leon", "Leon"),
    ("levy", "Levy"),
    ("liberty", "Liberty"),
    ("madison", "Madison"),
    ("manatee", "Manatee"),
    ("marion", "Marion"),
    ("martin", "Martin"),
    ("miami-dade", "Miami-Dade"),
    ("monroe", "Monroe"),
    ("nassau", "Nassau"),
    ("okaloosa", "Okaloosa"),
    ("okeechobee", "Okeechobee"),
    ("orange", "Orange"),
    ("osceola", "Osceola"),
    ("palm-beach", "Palm Beach"),
    ("pasco", "Pasco"),
    ("pinellas", "Pinellas"),
    ("polk", "Polk"),
    ("putnam", "Putnam"),
    ("santa-rosa", "Santa Rosa"),
    ("sarasota", "Sarasota"),
    ("seminole", "Seminole"),
    ("st-johns", "St. Johns"),
    ("st-lucie", "St. Lucie"),
    ("sumter", "Sumter"),
    ("suwannee", "Suwannee"),
    ("taylor", "Taylor"),
    ("union", "Union"),
    ("volusia", "Volusia"),
    ("wakulla", "Wakulla"),
    ("walton", "Walton"),
    ("washington", "Washington"),
)

# (town_slug, label) — matches frontend/lib/puerto-rico-towns.ts
PUERTO_RICO_TOWN_OPTIONS: tuple[tuple[str, str], ...] = (
    ("adjuntas", "Adjuntas"),
    ("aguada", "Aguada"),
    ("aguadilla", "Aguadilla"),
    ("aguas-buenas", "Aguas Buenas"),
    ("aibonito", "Aibonito"),
    ("anasco", "Añasco"),
    ("arecibo", "Arecibo"),
    ("arroyo", "Arroyo"),
    ("barceloneta", "Barceloneta"),
    ("barranquitas", "Barranquitas"),
    ("bayamon", "Bayamón"),
    ("cabo-rojo", "Cabo Rojo"),
    ("caguas", "Caguas"),
    ("camuy", "Camuy"),
    ("canovanas", "Canóvanas"),
    ("carolina", "Carolina"),
    ("catano", "Cataño"),
    ("cayey", "Cayey"),
    ("ceiba", "Ceiba"),
    ("ciales", "Ciales"),
    ("cidra", "Cidra"),
    ("coamo", "Coamo"),
    ("comerio", "Comerío"),
    ("corozal", "Corozal"),
    ("culebra", "Culebra"),
    ("dorado", "Dorado"),
    ("fajardo", "Fajardo"),
    ("florida", "Florida"),
    ("guanica", "Guánica"),
    ("guayama", "Guayama"),
    ("guayanilla", "Guayanilla"),
    ("guaynabo", "Guaynabo"),
    ("gurabo", "Gurabo"),
    ("hatillo", "Hatillo"),
    ("hormigueros", "Hormigueros"),
    ("humacao", "Humacao"),
    ("isabela", "Isabela"),
    ("jayuya", "Jayuya"),
    ("juana-diaz", "Juana Díaz"),
    ("juncos", "Juncos"),
    ("lajas", "Lajas"),
    ("lares", "Lares"),
    ("las-marias", "Las Marías"),
    ("las-piedras", "Las Piedras"),
    ("loiza", "Loíza"),
    ("luquillo", "Luquillo"),
    ("manati", "Manatí"),
    ("maricao", "Maricao"),
    ("maunabo", "Maunabo"),
    ("mayaguez", "Mayagüez"),
    ("moca", "Moca"),
    ("morovis", "Morovis"),
    ("naguabo", "Naguabo"),
    ("naranjito", "Naranjito"),
    ("orocovis", "Orocovis"),
    ("patillas", "Patillas"),
    ("penuelas", "Peñuelas"),
    ("ponce", "Ponce"),
    ("quebradillas", "Quebradillas"),
    ("rincon", "Rincón"),
    ("rio-grande", "Río Grande"),
    ("sabana-grande", "Sabana Grande"),
    ("salinas", "Salinas"),
    ("san-german", "San Germán"),
    ("san-juan", "San Juan"),
    ("san-lorenzo", "San Lorenzo"),
    ("san-sebastian", "San Sebastián"),
    ("santa-isabel", "Santa Isabel"),
    ("toa-alta", "Toa Alta"),
    ("toa-baja", "Toa Baja"),
    ("trujillo-alto", "Trujillo Alto"),
    ("utuado", "Utuado"),
    ("vega-alta", "Vega Alta"),
    ("vega-baja", "Vega Baja"),
    ("vieques", "Vieques"),
    ("villalba", "Villalba"),
    ("yabucoa", "Yabucoa"),
    ("yauco", "Yauco"),
)

CURATED_LAYOUT_PAGE_NAMES: tuple[str, ...] = ("homepage", "world")
"""Layout pages that receive one exact board per geo region."""

STATE_SPORTS_LAYOUT_PAGE_NAME = "sports"
"""Sports page boards are curated per US state, Florida county, and PR town."""

STATE_GOVERNMENT_LAYOUT_PAGE_NAME = "government"
"""Government page boards are curated per US state, Florida county, and PR town."""

STATE_ENTERTAINMENT_LAYOUT_PAGE_NAME = "entertainment"
"""Entertainment page boards are curated per US state, Florida county, and PR town."""

STATE_HEALTH_LAYOUT_PAGE_NAME = "health"
"""Health page boards are curated per US state, Florida county, and PR town."""


def us_state_region_codes() -> tuple[str, ...]:
    """Return region codes for every US state (e.g. ``us-fl``)."""

    return tuple(f"us-{state_code}" for state_code, _ in US_STATE_OPTIONS)


def florida_county_region_codes() -> tuple[str, ...]:
    """Return region codes for every Florida county (e.g. ``us-fl-miami-dade``)."""

    return tuple(f"us-fl-{county_slug}" for county_slug, _ in FLORIDA_COUNTY_OPTIONS)


def puerto_rico_town_region_codes() -> tuple[str, ...]:
    """Return region codes for every Puerto Rico municipality (e.g. ``pr-san-juan``)."""

    return tuple(f"pr-{town_slug}" for town_slug, _ in PUERTO_RICO_TOWN_OPTIONS)


def country_region_codes() -> tuple[str, ...]:
    """Return US and Puerto Rico country region codes used by Configuration.

    Returns:
        ``us`` then ``pr``. The admin editors send these when no state or town
        is selected, so country boards must exist independently of market-level
        docs (``region_id=None``).
    """

    return ("us", "pr")


def sports_curated_region_codes() -> tuple[str, ...]:
    """Return every region code that owns an independent sports board.

    Returns:
        US states, Florida counties, and Puerto Rico towns in that order.
    """

    return (
        us_state_region_codes()
        + florida_county_region_codes()
        + puerto_rico_town_region_codes()
    )
