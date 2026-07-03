"""Logging utilities for NewsCore services."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Final

from shared.core.request_context import get_correlation_id


class _JsonFormatter(logging.Formatter):
    """Structured JSON log lines with optional correlation id."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        correlation_id = get_correlation_id()
        if correlation_id:
            payload["correlation_id"] = correlation_id
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


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

    formatter: logging.Formatter
    if fmt == "json":
        formatter = _JsonFormatter()
    else:
        formatter = logging.Formatter(fmt="%(asctime)s %(levelname)s %(name)s: %(message)s")

    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.propagate = False
    return logger
