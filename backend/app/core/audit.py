"""Audit events (SEC-008): event name + request id + timestamp only, never personal data or secrets."""

from __future__ import annotations

import logging
from typing import Final, Literal

AuditEvent = Literal[
    "auth.login_succeeded",
    "auth.login_failed",
    "auth.login_blocked",
    "auth.logout",
    "auth.session_expired",
    "auth.csrf_failed",
    "auth.origin_rejected",
    "cli.admin_created",
    "cli.password_reset",
    "contact.honeypot_hit",
    "contact.rate_limited",
]

audit_logger: Final = logging.getLogger("app.audit")

_WARNING_EVENTS: Final = frozenset(
    {"auth.login_failed", "auth.login_blocked", "auth.csrf_failed", "auth.origin_rejected", "contact.rate_limited"}
)


def audit(event: AuditEvent) -> None:
    level = logging.WARNING if event in _WARNING_EVENTS else logging.INFO
    audit_logger.log(level, event)
