"""MongoDB user document model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from shared.models.common import utc_now


UserRoleType = Literal["admin", "editor", "reporter", "viewer"]


class User(BaseModel):
    """Represents a user document as stored in MongoDB."""

    id: str = Field(..., alias="_id")
    email: EmailStr
    password_hash: str
    role: UserRoleType = "viewer"
    full_name: str
    avatar_url: str | None = None
    bio: str | None = None
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: utc_now().isoformat())

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }

