"""Federated GraphQL schema for the content subgraph."""

from __future__ import annotations

import strawberry
from strawberry.federation import Schema

from content_subgraph.types import Article, ContentQuery


schema = Schema(query=ContentQuery, types=[Article])
