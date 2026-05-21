"""Logging utilities for NewsCore services."""

from __future__ import annotations

import logging
import os
from typing import Final


def get_logger(name: str) -> logging.Logger:
    """Create or retrieve a configured logger.

    Args:
        name: Logger name, typically ``__name__``.

    Returns:
        A configured logger instance.
    """

    level_str: Final[str] = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_str, logging.INFO)

    logger = logging.getLogger(name)
    logger.setLevel(level)

    if logger.handlers:
        return logger

    handler = logging.StreamHandler()
    fmt = os.getenv("LOG_FORMAT", "text").lower()

    if fmt == "json":
        formatter = logging.Formatter(
            fmt='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}'
        )
    else:
        formatter = logging.Formatter(fmt="%(asctime)s %(levelname)s %(name)s: %(message)s")

    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.propagate = False
    return logger

