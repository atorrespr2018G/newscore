"""Pytest configuration for backend tests."""

from __future__ import annotations

import pytest


def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers."""

    config.addinivalue_line("markers", "integration: tests that require docker compose stack")
