"""Federated GraphQL schema for the layout subgraph."""

from __future__ import annotations

from strawberry.federation import Schema

from layout_subgraph.types import LayoutQuery, Slot


schema = Schema(query=LayoutQuery, types=[Slot])
