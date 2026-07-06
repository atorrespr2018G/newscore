"""Runtime feature flags sourced from environment variables."""

from __future__ import annotations

import os


def _env_flag(name: str, *, default: bool = False) -> bool:
    """Return a boolean feature flag from env.

    Truthy values: 1, true, yes, on (case-insensitive).
    """

    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def geo_regions_enabled() -> bool:
    """Enable region hierarchy APIs and seed/backfill logic."""

    return _env_flag("GEO_REGIONS_ENABLED", default=False)


def geo_dual_write_enabled() -> bool:
    """Enable dual writes of legacy and region fields."""

    return _env_flag("GEO_DUAL_WRITE_ENABLED", default=False)


def geo_read_from_regions() -> bool:
    """Enable region-based read path for layouts and feeds."""

    return _env_flag("GEO_READ_FROM_REGIONS", default=False)


def geo_graphql_region_args() -> bool:
    """Enable regionCode GraphQL arguments."""

    return _env_flag("GEO_GRAPHQL_REGION_ARGS", default=False)
