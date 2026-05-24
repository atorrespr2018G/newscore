"""Unit tests for pagination helpers."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1] / "shared"
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from shared.core.pagination import PaginationParams


def test_pagination_skip_first_page() -> None:
    params = PaginationParams(page=1, page_size=20)
    assert params.skip == 0


def test_pagination_skip_second_page() -> None:
    params = PaginationParams(page=3, page_size=10)
    assert params.skip == 20
