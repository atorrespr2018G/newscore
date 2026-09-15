"""Unit tests for parent-to-child landing page disable inheritance."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT / "shared") not in sys.path:
    sys.path.insert(0, str(_ROOT / "shared"))

from shared.core.page_visibility import (
    disabled_page_names_from_docs,
    docs_for_page,
    local_enabled_from_doc,
    visibility_from_chain,
)


US_ID = "region-us"
FL_ID = "region-fl"
DADE_ID = "region-dade"
PR_ID = "region-pr"
SAN_JUAN_ID = "region-sju"

US_CHAIN = [
    (US_ID, "us"),
    (None, "us"),
]
FL_CHAIN = [
    (FL_ID, "us-fl"),
    (US_ID, "us"),
    (None, "us"),
]
DADE_CHAIN = [
    (DADE_ID, "us-fl-miami-dade"),
    (FL_ID, "us-fl"),
    (US_ID, "us"),
    (None, "us"),
]
PR_CHAIN = [
    (PR_ID, "pr"),
    (None, "pr"),
]
SAN_JUAN_CHAIN = [
    (SAN_JUAN_ID, "pr-san-juan"),
    (PR_ID, "pr"),
    (None, "pr"),
]


def _doc(page_name: str, region_id: str | None, enabled: bool) -> dict:
    """Build a page-visibility document for tests."""

    return {
        "page_name": page_name,
        "region_id": region_id,
        "is_enabled": enabled,
    }


def test_missing_doc_defaults_to_enabled() -> None:
    """Unset visibility keeps the page on."""

    assert local_enabled_from_doc(None) is True
    assert local_enabled_from_doc({"page_name": "sports"}) is True


def test_usa_disable_hides_states_and_counties() -> None:
    """USA → USA off hides Florida and Miami-Dade, not a sibling market."""

    docs = [_doc("sports", US_ID, False)]
    by_page = docs_for_page(docs, "sports")
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=US_CHAIN).effectively_enabled is False
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=FL_CHAIN).effectively_enabled is False
    dade = visibility_from_chain(docs_by_scope=by_page, chain_scopes=DADE_CHAIN)
    assert dade.effectively_enabled is False
    assert dade.inherited is True
    assert dade.disabled_by_region_code == "us"


def test_florida_disable_hides_counties_only() -> None:
    """USA → Florida off hides Miami-Dade but leaves other states on."""

    docs = [_doc("sports", FL_ID, False)]
    by_page = docs_for_page(docs, "sports")
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=US_CHAIN).effectively_enabled is True
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=FL_CHAIN).effectively_enabled is False
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=DADE_CHAIN).effectively_enabled is False
    texas_chain = [("region-tx", "us-tx"), (US_ID, "us"), (None, "us")]
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=texas_chain).effectively_enabled is True


def test_county_disable_is_local() -> None:
    """A county disable does not hide the parent state."""

    docs = [_doc("world", DADE_ID, False)]
    by_page = docs_for_page(docs, "world")
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=FL_CHAIN).effectively_enabled is True
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=DADE_CHAIN).effectively_enabled is False


def test_puerto_rico_country_disable_hides_towns() -> None:
    """Puerto Rico → Puerto Rico off hides every town."""

    docs = [_doc("entertainment", PR_ID, False)]
    by_page = docs_for_page(docs, "entertainment")
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=PR_CHAIN).effectively_enabled is False
    town = visibility_from_chain(docs_by_scope=by_page, chain_scopes=SAN_JUAN_CHAIN)
    assert town.effectively_enabled is False
    assert town.disabled_by_region_code == "pr"


def test_puerto_rico_town_disable_is_local() -> None:
    """A town disable does not hide other PR towns or the country."""

    docs = [_doc("health", SAN_JUAN_ID, False)]
    by_page = docs_for_page(docs, "health")
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=PR_CHAIN).effectively_enabled is True
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=SAN_JUAN_CHAIN).effectively_enabled is False
    ponce_chain = [("region-ponce", "pr-ponce"), (PR_ID, "pr"), (None, "pr")]
    assert visibility_from_chain(docs_by_scope=by_page, chain_scopes=ponce_chain).effectively_enabled is True


def test_child_cannot_override_parent_disable() -> None:
    """An explicit child enable still loses to a disabled parent."""

    docs = [_doc("sports", US_ID, False), _doc("sports", FL_ID, True)]
    by_page = docs_for_page(docs, "sports")
    florida = visibility_from_chain(docs_by_scope=by_page, chain_scopes=FL_CHAIN)
    assert florida.local_enabled is True
    assert florida.effectively_enabled is False
    assert florida.inherited is True


def test_disabled_page_names_lists_only_hidden_landings() -> None:
    """Feed nav can hide Sports while World stays listed."""

    docs = [_doc("sports", US_ID, False), _doc("world", FL_ID, False)]
    disabled = disabled_page_names_from_docs(
        docs=docs,
        chain_scopes=DADE_CHAIN,
        page_names=["sports", "world", "health"],
    )
    assert disabled == ["sports", "world"]
