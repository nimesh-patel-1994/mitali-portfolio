"""DB-backed rate limiting (BE-007 contact form, BE-010 login throttle; SD-010, SEC-BE-006, SEC-BE-008).

Keys are HMAC-SHA256(``HASH_KEY_SECRET``, raw value) in hex: no raw IP address or email is stored. The functions
run inside the caller's transaction.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Final, Literal

from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import keyed_hash
from app.repositories import rate_limits as repository

Bucket = Literal["contact_ip", "login_ip", "login_account"]

CONTACT_LIMIT: Final = 5
CONTACT_WINDOW: Final = timedelta(minutes=10)

LOGIN_FAILURE_LIMIT: Final = 5
LOGIN_WINDOW: Final = timedelta(minutes=15)
LOGIN_BLOCK: Final = timedelta(minutes=15)

COUNTER_MAX_AGE: Final = timedelta(days=1)


@dataclass(frozen=True, slots=True)
class WindowResult:
    count: int
    allowed: bool
    retry_after_seconds: int


@dataclass(frozen=True, slots=True)
class LoginKeys:
    ip: str
    account: str

    def pairs(self) -> list[tuple[str, str]]:
        return [("login_ip", self.ip), ("login_account", self.account)]


def make_key(secret: SecretStr, raw_value: str) -> str:
    return keyed_hash(secret.get_secret_value(), raw_value)


def login_keys(secret: SecretStr, client_ip: str, normalised_email: str) -> LoginKeys:
    return LoginKeys(ip=make_key(secret, client_ip), account=make_key(secret, normalised_email))


def _seconds_until(moment: datetime, now: datetime) -> int:
    return max(1, math.ceil((moment - now).total_seconds()))


async def hit_fixed_window(
    session: AsyncSession,
    secret: SecretStr,
    bucket: Bucket,
    raw_key: str,
    limit: int,
    window: timedelta,
) -> WindowResult:
    """Count one event; ``allowed`` is False once the count exceeds ``limit`` within the window."""
    state = await repository.hit(session, bucket, make_key(secret, raw_key), window=window)
    retry_after = _seconds_until(state.window_start + window, state.now)
    return WindowResult(count=state.count, allowed=state.count <= limit, retry_after_seconds=retry_after)


async def check_login_block(session: AsyncSession, keys: LoginKeys) -> int | None:
    """Seconds until the block ends when either login bucket is blocked, else None."""
    blocked_until, now = await repository.latest_block(session, keys.pairs())
    if blocked_until is None:
        return None
    return _seconds_until(blocked_until, now)


async def register_login_failure(session: AsyncSession, keys: LoginKeys) -> None:
    """Count a failure in both buckets; the 5th failure in a window blocks that bucket for 15 minutes."""
    for bucket, key in keys.pairs():
        await repository.hit(
            session, bucket, key, window=LOGIN_WINDOW, block_at=LOGIN_FAILURE_LIMIT, block_for=LOGIN_BLOCK
        )


async def reset_login_buckets(session: AsyncSession, keys: LoginKeys) -> None:
    await repository.delete_keys(session, keys.pairs())


async def clear_account_bucket(session: AsyncSession, secret: SecretStr, normalised_email: str) -> None:
    await repository.delete_keys(session, [("login_account", make_key(secret, normalised_email))])


async def cleanup_old_counters(session: AsyncSession) -> int:
    """Delete counters not touched for a day (run opportunistically on login)."""
    return await repository.delete_older_than(session, COUNTER_MAX_AGE)
