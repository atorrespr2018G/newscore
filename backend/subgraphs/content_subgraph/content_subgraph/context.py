"""GraphQL request context for the content subgraph."""

from __future__ import annotations

from dataclasses import dataclass

from motor.motor_asyncio import AsyncIOMotorDatabase
from strawberry.fastapi import BaseContext

from shared.core.db import get_database
from shared.read.loaders import AuthorNameLoader


@dataclass
class ContentContext(BaseContext):
    """Per-request context with database and loaders."""

    db: AsyncIOMotorDatabase
    authors: AuthorNameLoader


async def get_context() -> ContentContext:
    """Build GraphQL context for a request."""

    db = get_database()
    return ContentContext(db=db, authors=AuthorNameLoader(db))
