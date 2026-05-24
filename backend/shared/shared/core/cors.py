"""CORS origin configuration shared across REST apps."""

from __future__ import annotations

import os


def cors_allow_origins() -> list[str]:
    """Return allowed CORS origins from CORS_ORIGINS (comma-separated).

    Defaults to permissive ``*`` in development when unset.
  """

    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def cors_allow_credentials() -> bool:
    """Whether credentialed CORS requests are allowed."""

    return cors_allow_origins() != ["*"]
