"""Thin data-access repositories for editorial domains."""

from shared.repositories.article_repository import ArticleRepository
from shared.repositories.slot_repository import SlotRepository

__all__ = ["ArticleRepository", "SlotRepository"]
