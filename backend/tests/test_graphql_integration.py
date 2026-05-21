"""GraphQL federation integration tests (require running stack)."""

from __future__ import annotations

import os

import httpx
import pytest

GRAPHQL_URL = os.getenv("GRAPHQL_URL", "http://localhost:4000/graphql")


@pytest.mark.integration
async def test_homepage_feed_query() -> None:
    """Router returns homepage feed without GraphQL errors."""

    query = """
    query {
      homepageFeed {
        pageName
        slots {
          id
          articles {
            id
            title
            slug
          }
        }
      }
    }
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(GRAPHQL_URL, json={"query": query})
    assert response.status_code == 200
    body = response.json()
    assert "errors" not in body
    assert body["data"]["homepageFeed"]["pageName"] == "homepage"
