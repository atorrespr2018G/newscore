"""Constants shared across all NewsCore backend services."""

from __future__ import annotations

from typing import Final

JWT_ALGORITHM: Final[str] = "HS256"

SUPPORTED_IMAGE_TYPES: Final[set[str]] = {"image/jpeg", "image/png", "image/webp"}
SUPPORTED_VIDEO_TYPES: Final[set[str]] = {
    "video/mp4",
    "video/webm",
    "video/quicktime",
}

DEFAULT_PAGE_SIZE: Final[int] = 20
MAX_PAGE_SIZE: Final[int] = 200

