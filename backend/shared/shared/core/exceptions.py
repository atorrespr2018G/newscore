"""Custom exception hierarchy for NewsCore services."""

from __future__ import annotations


class NewsCoreBaseException(Exception):
    """Base exception for all domain errors in NewsCore.

    Attributes:
        message: Human-readable error message suitable for logs.
        detail: Optional safe detail for API responses.
    """

    def __init__(self, message: str, *, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail or message


class NotFoundError(NewsCoreBaseException):
    """Raised when a requested resource cannot be found."""


class PermissionError(NewsCoreBaseException):
    """Raised when a user lacks permission to perform an action."""


class ConflictError(NewsCoreBaseException):
    """Raised when a uniqueness or state conflict occurs."""


class ValidationError(NewsCoreBaseException):
    """Raised when business rules fail beyond schema validation."""


class MediaUploadError(NewsCoreBaseException):
    """Raised when media upload or processing fails."""


class PayloadTooLargeError(NewsCoreBaseException):
    """Raised when an uploaded file exceeds the configured size limit."""

