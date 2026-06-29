"""Schemas for editorial workflow badge endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class NewCountOut(BaseModel):
    """Count of items newly entering a workflow view since the user's last visit."""

    count: int = Field(..., ge=0)


class ViewStateOut(BaseModel):
    """Result of marking a workflow view as seen by the current user."""

    view: str
    last_seen_at: str
