"""Admin authentication, sessions, CSRF and the CLI account functions (BE-008..BE-011, TS-008, TS-009).

Login (TS-008 step 1): normalise email → short locked transaction: throttle check and reserve (count) the attempt in
both buckets, before any Argon2 work → verify in the threadpool with no connection held (dummy hash for unknown
emails); a failure is already counted, 401 → on success reset buckets, rehash when needed, delete the admin's
expired sessions, create a new session (only SHA-256 hashes stored), set ``last_login_at``.

Passwords, tokens and emails are never logged; audit events carry the event name only (SEC-008).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Final

from email_validator import EmailNotValidError, validate_email
from pydantic import SecretStr
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core import security
from app.core.audit import audit
from app.core.errors import CsrfFailedError, InvalidCredentialsError, TooManyAttemptsError, UnauthenticatedError
from app.repositories import admin_users, sessions
from app.schemas.auth import AdminSession
from app.schemas.base import check_single_line
from app.services import rate_limit

IDLE_TIMEOUT: Final = timedelta(hours=8)
ABSOLUTE_LIFETIME: Final = timedelta(days=7)
LAST_SEEN_REFRESH: Final = timedelta(minutes=1)

PASSWORD_MIN_LENGTH: Final = 12
PASSWORD_MAX_LENGTH: Final = 128


def utcnow() -> datetime:
    return datetime.now(UTC)


def normalise_email(email: str) -> str:
    return email.strip().lower()


# ----------------------------------------------------------------------------------------------- login / logout


@dataclass(frozen=True, slots=True)
class LoginResult:
    admin_session: AdminSession
    session_token: str
    csrf_token: str


@dataclass(frozen=True, slots=True)
class CurrentAdmin:
    admin_id: uuid.UUID
    email: str
    session_id: uuid.UUID
    csrf_token_hash: bytes
    last_seen_at: datetime
    absolute_expires_at: datetime

    @property
    def idle_expires_at(self) -> datetime:
        return self.last_seen_at + IDLE_TIMEOUT


async def login(
    session: AsyncSession, *, email: str, password: str, client_ip: str, hash_secret: SecretStr
) -> LoginResult:
    normalised = normalise_email(email)
    keys = rate_limit.login_keys(hash_secret, client_ip, normalised)

    async with session.begin():
        await rate_limit.cleanup_old_counters(session)

    # 1. Reserve the attempt (short transaction under the per-key advisory locks): refuse while blocked, otherwise
    #    count it in both buckets before any Argon2 work. Concurrent attempts are counted one after another, so at
    #    most LOGIN_FAILURE_LIMIT of them per window get past this point (review m3/B-1, SEC-BE-006).
    async with session.begin():
        await rate_limit.lock_login_keys(session, keys)
        retry_after = await rate_limit.reserve_login_attempt(session, keys)
        admin = None if retry_after is not None else await admin_users.get_by_email(session, normalised)
        admin_id = admin.id if admin is not None else None
        stored_hash = admin.password_hash if admin is not None else None
    if retry_after is not None:
        audit("auth.login_blocked")
        raise TooManyAttemptsError(retry_after)

    # 2. Verify with no transaction and no pooled connection held; the dummy hash is created and verified in the
    #    same threadpool call for unknown emails, so both failure paths do equal work (review m2). A failure is
    #    already counted by the reservation.
    password_ok = await run_in_threadpool(security.verify_login_password, stored_hash, password)
    if admin_id is None or stored_hash is None or not password_ok:
        audit("auth.login_failed")
        raise InvalidCredentialsError()

    # 3. Success (short transaction): reset both buckets, rehash when needed, create the session.
    new_hash = await run_in_threadpool(security.hash_password, password) if security.needs_rehash(stored_hash) else None
    async with session.begin():
        result = await _start_session(session, keys, admin_id, stored_hash, new_hash)
    audit("auth.login_succeeded")
    return result


async def _start_session(
    session: AsyncSession,
    keys: rate_limit.LoginKeys,
    admin_id: uuid.UUID,
    verified_hash: str,
    new_hash: str | None,
) -> LoginResult:
    now = utcnow()
    # Locked re-read: a password reset that committed after verification changes the hash (and ends all sessions),
    # so the password checked against the old hash must not start a session or overwrite the new hash.
    admin = await admin_users.get_by_id_for_update(session, admin_id)
    if admin is None or admin.password_hash != verified_hash:  # deleted or reset between verification and now
        audit("auth.login_failed")
        raise InvalidCredentialsError()
    if new_hash is not None:
        await admin_users.set_password_hash(session, admin_id, new_hash, now=now, changed=False)
    session_token = security.generate_token()
    csrf_token = security.generate_token()
    absolute_expires_at = now + ABSOLUTE_LIFETIME
    await rate_limit.reset_login_buckets(session, keys)
    await sessions.delete_expired_for_admin(session, admin_id, now=now, idle_timeout=IDLE_TIMEOUT)
    await sessions.insert(
        session,
        admin_user_id=admin_id,
        token_hash=security.token_hash(session_token),
        csrf_token_hash=security.token_hash(csrf_token),
        now=now,
        absolute_expires_at=absolute_expires_at,
    )
    await admin_users.set_last_login(session, admin_id, now)
    return LoginResult(
        admin_session=AdminSession(
            email=admin.email,
            csrf_token=csrf_token,
            idle_expires_at=now + IDLE_TIMEOUT,
            absolute_expires_at=absolute_expires_at,
        ),
        session_token=session_token,
        csrf_token=csrf_token,
    )


async def authenticate(session: AsyncSession, session_token: str | None) -> CurrentAdmin:
    """Resolve the ``mp_session`` cookie to the admin; 401 when missing, unknown or expired (expired row deleted)."""
    if not session_token:
        raise UnauthenticatedError()
    now = utcnow()
    expired = False
    current: CurrentAdmin | None = None
    async with session.begin():
        found = await sessions.get_with_admin(session, security.token_hash(session_token))
        if found is not None:
            row, admin = found
            if row.absolute_expires_at <= now or row.last_seen_at + IDLE_TIMEOUT <= now:
                await sessions.delete_by_id(session, row.id)
                expired = True
            else:
                last_seen_at = row.last_seen_at
                if now - last_seen_at >= LAST_SEEN_REFRESH:
                    await sessions.touch(session, row.id, now)
                    last_seen_at = now
                current = CurrentAdmin(
                    admin_id=admin.id,
                    email=admin.email,
                    session_id=row.id,
                    csrf_token_hash=row.csrf_token_hash,
                    last_seen_at=last_seen_at,
                    absolute_expires_at=row.absolute_expires_at,
                )
    if expired:
        audit("auth.session_expired")
    if current is None:
        raise UnauthenticatedError()
    return current


def verify_csrf(current: CurrentAdmin, header_token: str | None, cookie_token: str | None) -> None:
    """Header must equal the ``mp_csrf`` cookie and hash to the session's ``csrf_token_hash`` (constant time)."""
    valid = (
        bool(header_token)
        and bool(cookie_token)
        and security.strings_equal(header_token or "", cookie_token or "")
        and security.digests_equal(security.token_hash(header_token or ""), current.csrf_token_hash)
    )
    if not valid:
        audit("auth.csrf_failed")
        raise CsrfFailedError()


async def describe_session(
    session: AsyncSession, current: CurrentAdmin, csrf_cookie: str | None
) -> tuple[AdminSession, str | None]:
    """``getAdminMe``: return the CSRF token from the cookie when it belongs to this session.

    Only the hash is stored, so when the ``mp_csrf`` cookie is missing (it is a browser-session cookie) or does not
    match, a new CSRF token is issued for the session. Returns ``(AdminSession, new_token_or_None)``.
    """
    token = csrf_cookie
    rotated: str | None = None
    if not token or not security.digests_equal(security.token_hash(token), current.csrf_token_hash):
        rotated = security.generate_token()
        async with session.begin():
            await sessions.set_csrf_hash(session, current.session_id, security.token_hash(rotated))
        token = rotated
    return (
        AdminSession(
            email=current.email,
            csrf_token=token,
            idle_expires_at=current.idle_expires_at,
            absolute_expires_at=current.absolute_expires_at,
        ),
        rotated,
    )


async def logout(session: AsyncSession, current: CurrentAdmin) -> None:
    async with session.begin():
        await sessions.delete_by_id(session, current.session_id)
    audit("auth.logout")


# ----------------------------------------------------------------------------------------------- CLI (BE-011)


class AdminAccountError(Exception):
    """A CLI account operation was refused; the message is safe to print (no password, no hash)."""


def normalise_cli_email(email: str) -> str:
    try:
        check_single_line(email)
        validated = validate_email(email.strip(), check_deliverability=False)
    except (EmailNotValidError, ValueError):
        raise AdminAccountError("The email address is not valid.") from None
    return validated.normalized.lower()


def validate_password_policy(password: str, email: str) -> None:
    """12..128 characters, one line, not equal to the email or its local part (case-insensitive)."""
    if len(password) < PASSWORD_MIN_LENGTH:
        raise AdminAccountError(f"The password must be at least {PASSWORD_MIN_LENGTH} characters long.")
    if len(password) > PASSWORD_MAX_LENGTH:
        raise AdminAccountError(f"The password must be at most {PASSWORD_MAX_LENGTH} characters long.")
    try:
        check_single_line(password)
    except ValueError:
        raise AdminAccountError("The password must not contain line breaks or control characters.") from None
    lowered = password.casefold()
    normalised = email.strip().casefold()
    local_part = normalised.split("@", 1)[0]
    if lowered in {normalised, local_part}:
        raise AdminAccountError("The password must not be the email address or the part before the @.")


async def create_admin(session: AsyncSession, *, email: str, password: str) -> None:
    normalised = normalise_cli_email(email)
    validate_password_policy(password, normalised)
    password_hash = await run_in_threadpool(security.hash_password, password)
    try:
        async with session.begin():
            if await admin_users.any_exists(session):
                raise AdminAccountError("An admin already exists. Use reset-password to change its password.")
            await admin_users.insert(session, email=normalised, password_hash=password_hash, now=utcnow())
    except IntegrityError:  # single-admin unique index (concurrent create)
        raise AdminAccountError("An admin already exists. Use reset-password to change its password.") from None
    audit("cli.admin_created")


async def reset_password(session: AsyncSession, *, email: str | None, password: str, hash_secret: SecretStr) -> None:
    """New hash and ``password_changed_at``; deletes every session and clears the ``login_account`` bucket."""
    async with session.begin():
        admin = await admin_users.get_single(session)
        if admin is None:
            raise AdminAccountError("No admin account exists. Run create-admin first.")
        admin_id, admin_email = admin.id, admin.email
    if email is not None and normalise_cli_email(email) != normalise_email(admin_email):
        raise AdminAccountError("No admin account with that email exists.")
    validate_password_policy(password, admin_email)
    password_hash = await run_in_threadpool(security.hash_password, password)
    async with session.begin():
        await admin_users.set_password_hash(session, admin_id, password_hash, now=utcnow(), changed=True)
        await sessions.delete_all_for_admin(session, admin_id)
        await rate_limit.clear_account_bucket(session, hash_secret, normalise_email(admin_email))
    audit("cli.password_reset")
