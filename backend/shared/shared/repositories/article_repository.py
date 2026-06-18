"""MongoDB access for articles."""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from shared.core.pagination import PaginationParams
from shared.models.article import Article

ARTICLES_COLLECTION = "articles"


class ArticleRepository:
    """Thin repository for article documents."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db[ARTICLES_COLLECTION]

    async def find_by_id(self, article_id: str) -> dict[str, Any] | None:
        """Load one article document by id.

        Args:
            article_id: Article identifier.

        Returns:
            Matching article document, if found.
        """

        return await self._collection.find_one({"_id": article_id})

    async def insert(self, doc: dict[str, Any]) -> None:
        """Insert a new article document.

        Args:
            doc: Article document to persist.
        """

        await self._collection.insert_one(doc)

    async def find_one_and_update(
        self,
        article_id: str,
        update_doc: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Update one article document and return the updated copy.

        Args:
            article_id: Article identifier.
            update_doc: Fields to write with `$set`.

        Returns:
            Updated article document, if found.
        """

        return await self._collection.find_one_and_update(
            {"_id": article_id},
            {"$set": update_doc},
            return_document=ReturnDocument.AFTER,
        )

    async def slug_exists(self, slug: str, *, exclude_id: str | None = None) -> bool:
        """Check whether a slug already exists.

        Args:
            slug: Candidate slug.
            exclude_id: Optional article id to exclude from uniqueness checks.

        Returns:
            True when another article already has the slug.
        """

        query: dict[str, Any] = {"slug": slug}
        if exclude_id is not None:
            query["_id"] = {"$ne": exclude_id}
        doc = await self._collection.find_one(query, {"_id": 1})
        return doc is not None

    async def count_all(self) -> int:
        """Count all article documents."""

        return await self._collection.count_documents({})

    async def list_paginated(self, pagination: PaginationParams) -> list[dict[str, Any]]:
        """List article documents using pagination params.

        Args:
            pagination: Pagination parameters.

        Returns:
            Ordered article documents for the requested page.
        """

        cursor = (
            self._collection.find({})
            .sort("created_at", -1)
            .skip(pagination.skip)
            .limit(pagination.page_size)
        )
        return [doc async for doc in cursor]

    @staticmethod
    def to_model(doc: dict[str, Any]) -> Article:
        """Convert a Mongo document to an `Article` model.

        Args:
            doc: Raw Mongo article document.

        Returns:
            Validated `Article` model.
        """

        return Article.model_validate(doc)
