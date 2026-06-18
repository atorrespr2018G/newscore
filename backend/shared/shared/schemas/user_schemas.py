"""User request/response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


UserRoleType = Literal["admin", "editor", "reporter", "viewer"]


class LoginRequest(BaseModel):
    """Request body for POST /auth/login."""

    email: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=6, max_length=200)


class TokenResponse(BaseModel):
    """Response body for login."""

    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    """Request body for POST /users."""

    email: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=6, max_length=200)
    full_name: str = Field(..., min_length=2, max_length=200)
    role: UserRoleType = "viewer"


class UserUpdate(BaseModel):
    """Request body for PATCH /users/{id}. All fields optional."""

    full_name: str | None = Field(None, min_length=2, max_length=200)
    role: UserRoleType | None = None
    is_active: bool | None = None


class ReporterBioUpdate(BaseModel):
    """Request body for PATCH /reporters/{id}/bio."""

    bio: str = Field(..., min_length=0, max_length=2000)


class UserOut(BaseModel):
    """Response schema for user objects."""

    id: str
    email: str
    role: UserRoleType
    full_name: str
    avatar_url: str | None = None
    bio: str | None = None
    is_active: bool
    created_at: str

