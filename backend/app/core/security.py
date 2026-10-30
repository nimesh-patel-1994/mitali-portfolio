"""Password hashing, token generation and keyed hashing (BE-008, SD-007, SEC-BE-001, SEC-BE-003).

Argon2id via ``argon2-cffi`` with the library defaults (RFC 9106 low-memory profile: time cost 3, memory 64 MiB,
parallelism 4). Hashing and verification are CPU-heavy and blocking: async callers use ``run_in_threadpool``.
Unknown emails verify against a fixed dummy hash so both failure paths do the same work.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from functools import lru_cache
from typing import Final

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher: Final = PasswordHasher()

# Fixed, non-secret input for the dummy hash; no account can have it because hashes are only made by the CLI.
_DUMMY_PASSWORD: Final = "mitali-portfolio-dummy-password-for-equal-timing"  # noqa: S105 - not a credential

TOKEN_BYTES: Final = 32  # 256 bit


def hash_password(password: str) -> str:
    return _hasher.hash(password)


@lru_cache(maxsize=1)
def dummy_hash() -> str:
    """Module-level dummy hash (computed once, with the current parameters)."""
    return _hasher.hash(_DUMMY_PASSWORD)


def verify_login_password(password_hash: str | None, password: str) -> bool:
    """Login check, run as one threadpool call: an unknown email (``None``) verifies against the dummy hash.

    The dummy hash is created (first use) and verified inside this blocking call, so neither path does Argon2 work
    on the event loop and both failure paths cost the same verification.
    """
    if password_hash is None:
        verify_password(dummy_hash(), password)
        return False
    return verify_password(password_hash, password)


def verify_password(password_hash: str, password: str) -> bool:
    """True when ``password`` matches; False for a mismatch or an unreadable hash (never raises for those)."""
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def generate_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def token_hash(token: str) -> bytes:
    """SHA-256 of a session or CSRF token (only hashes are stored, SD-007)."""
    return hashlib.sha256(token.encode("utf-8")).digest()


def digests_equal(left: bytes, right: bytes) -> bool:
    return hmac.compare_digest(left, right)


def strings_equal(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def keyed_hash(secret: str, value: str) -> str:
    """Hex HMAC-SHA256 used as rate-limit key (no raw IP or email is stored, SEC-BE-006/008)."""
    return hmac.new(secret.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()
