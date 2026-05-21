"""Federated GraphQL schema for the site subgraph."""

from __future__ import annotations

from strawberry.federation import Schema

from site_subgraph.types import Article, SiteQuery


schema = Schema(query=SiteQuery, types=[Article])
