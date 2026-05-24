"""Audit log service."""

from __future__ import annotations

from shared.core import audit as audit_core

write_event = audit_core.write_event
list_events = audit_core.list_events

__all__ = ["write_event", "list_events"]
