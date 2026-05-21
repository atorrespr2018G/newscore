"""GraphQL request context for the site subgraph."""

from __future__ import annotations

from dataclasses import dataclass

from motor.motor_asyncio import AsyncIOMotorDatabase
from strawberry.fastapi import BaseContext

from shared.core.db import get_database


@dataclass
class SiteContext(BaseContext):
    """Per-request context with database."""

    db: AsyncIOMotorDatabase


async def get_context() -> SiteContext:
    """Build GraphQL context for a request."""

    return SiteContext(db=get_database())
