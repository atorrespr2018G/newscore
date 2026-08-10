"""Build NewsCore region codes from Media Desk taxonomy fields."""

from __future__ import annotations


def to_region_code(
    market_code: str,
    town_id: str | None,
    county_id: str | None = None,
) -> str:
    """Build a canonical region code from market + locality + optional county.

    Args:
        market_code: Market short code such as ``us``, ``pr``, or ``co``.
        town_id: State or town code, when set.
        county_id: Florida county code, when set.

    Returns:
        Region code such as ``us-fl-miami-dade``.
    """

    market = market_code.strip().lower()
    town = (town_id or "").strip().lower()
    county = (county_id or "").strip().lower()
    if county:
        return f"{market}-{town}-{county}" if town else f"{market}-{county}"
    if not town:
        return market
    return f"{market}-{town}"
