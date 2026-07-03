"""Article read operations."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from shared.core.exceptions import NotFoundError
from shared.core.pagination import PaginationParams
from shared.read.article_reads import (
    article_detail_out,
    article_out,
    list_story_groups as read_story_groups,
)
from shared.read.loaders import AuthorNameLoader
from shared.repositories.article_repository import ArticleRepository
from shared.schemas.article_schemas import ArticleDetailOut, ArticleOut, StoryGroupOut


async def get_by_id(db: AsyncIOMotorDatabase, article_id: str) -> dict[str, Any]:
    """Load an article document by id.

    Args:
        db: Database connection.
        article_id: Article id to load.

    Returns:
        Raw article document.

    Raises:
        NotFoundError: If the article does not exist.
    """

    repo = ArticleRepository(db)
    doc = await repo.find_by_id(article_id)
    if doc is None:
        raise NotFoundError("Article not found")
    return doc


async def get_detail_by_id(db: AsyncIOMotorDatabase, article_id: str) -> ArticleDetailOut:
    """Load an article detail DTO by id.

    Args:
        db: Database connection.
        article_id: Article id to load.

    Returns:
        Article detail payload.

    Raises:
        NotFoundError: If the article does not exist.
    """

    doc = await get_by_id(db, article_id)
    loader = AuthorNameLoader(db)
    return article_detail_out(doc, author_name=await loader.load(str(doc["author_id"])))


async def list_all(
    db: AsyncIOMotorDatabase,
    pagination: PaginationParams,
) -> tuple[list[ArticleOut], int]:
    """List paginated article summaries.

    Args:
        db: Database connection.
        pagination: Pagination parameters.

    Returns:
        A tuple of mapped articles and total count.
    """

    repo = ArticleRepository(db)
    total = await repo.count_all()
    docs = await repo.list_paginated(pagination)
    loader = AuthorNameLoader(db)
    await loader.load_many([str(doc["author_id"]) for doc in docs])
    items = [
        article_out(doc, author_name=await loader.load(str(doc["author_id"])))
        for doc in docs
    ]
    return items, total


async def list_story_groups(db: AsyncIOMotorDatabase) -> list[StoryGroupOut]:
    """List distinct editor-assigned story groups for the editor combobox.

    Args:
        db: Database connection.

    Returns:
        Story groups ordered by article count, largest first.
    """

    return await read_story_groups(db)
