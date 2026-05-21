"""Password hashing and verification helpers."""

from __future__ import annotations

import bcrypt


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt.

    Args:
        password: Plaintext password.

    Returns:
        Bcrypt hash string.
    """

    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(*, password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a bcrypt hash.

    Args:
        password: Plaintext password.
        password_hash: Bcrypt hash to verify against.

    Returns:
        True if password matches hash, else False.
    """

    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))

