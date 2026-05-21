"""GraphQL request context for the layout subgraph."""

from __future__ import annotations

from dataclasses import dataclass

from motor.motor_asyncio import AsyncIOMotorDatabase
from strawberry.fastapi import BaseContext

from shared.core.db import get_database


@dataclass
class LayoutContext(BaseContext):
    """Per-request context with database."""

    db: AsyncIOMotorDatabase


async def get_context() -> LayoutContext:
    """Build GraphQL context for a request."""

    return LayoutContext(db=get_database())
