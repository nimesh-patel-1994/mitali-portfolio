"""Input base model and shared field types (BE-012, SEC-BE-007, SEC-BE-014, coding standard 4).

Every request body derives from ``InputModel``: unknown fields are rejected (``extra="forbid"``) and surrounding
whitespace is stripped. String fields use one of the annotated types below so control characters are rejected with
the field path in the 422 envelope:

* ``SingleLine``: names, labels, titles, slugs, emails, URLs; rejects every C0 control character (incl. CR/LF) and DEL.
* ``MultiLine``: free text (summaries, answers, messages); allows ``\\t``, ``\\n``, ``\\r`` only.
* ``MarkdownText``: like ``MultiLine`` but whitespace is kept as typed (leading indentation is Markdown syntax).

A unit test checks that every ``str`` field of every ``InputModel`` subclass uses one of these validators.
"""

from __future__ import annotations

import re
from typing import Annotated, Final
from urllib.parse import urlsplit, urlunsplit

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints

SLUG_REGEX: Final = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
SLUG_PATTERN: Final = re.compile(SLUG_REGEX)
SLUG_MAX_LENGTH: Final = 80
URL_MAX_LENGTH: Final = 500
EMAIL_MAX_LENGTH: Final = 254

_SINGLE_LINE_FORBIDDEN: Final = re.compile(r"[\x00-\x1f\x7f]")
_MULTI_LINE_FORBIDDEN: Final = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

SINGLE_LINE_MESSAGE: Final = "Must be a single line without control characters."
MULTI_LINE_MESSAGE: Final = "Must not contain control characters."


def check_single_line(value: str) -> str:
    if _SINGLE_LINE_FORBIDDEN.search(value):
        raise ValueError(SINGLE_LINE_MESSAGE)
    return value


def check_multi_line(value: str) -> str:
    if _MULTI_LINE_FORBIDDEN.search(value):
        raise ValueError(MULTI_LINE_MESSAGE)
    return value


# Validators that mark a str field as checked (used by the InputModel field audit test).
TEXT_VALIDATORS: Final = (check_single_line, check_multi_line)


class InputModel(BaseModel):
    """Base for every request body: unknown fields forbidden, whitespace stripped."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


SingleLine = Annotated[str, AfterValidator(check_single_line)]
MultiLine = Annotated[str, AfterValidator(check_multi_line)]
MarkdownText = Annotated[str, StringConstraints(strip_whitespace=False), AfterValidator(check_multi_line)]

Slug = Annotated[
    str,
    StringConstraints(max_length=SLUG_MAX_LENGTH, pattern=SLUG_REGEX),
    AfterValidator(check_single_line),
]

Email = Annotated[EmailStr, Field(max_length=EMAIL_MAX_LENGTH), AfterValidator(check_single_line)]

# Contract ``StringList``: at most 30 items, each 1..60 characters on one line.
ListItem = Annotated[str, StringConstraints(min_length=1, max_length=60), AfterValidator(check_single_line)]
StringList = Annotated[list[ListItem], Field(max_length=30)]


# ------------------------------------------------------------------------------------------- URLs (SEC-BE-014)

_HOST_LABEL: Final = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
_WHITESPACE_OR_CONTROL: Final = re.compile(r"[\s\x00-\x1f\x7f]")


def normalise_http_url(value: str) -> str:
    """Return the URL with scheme and host in lower case, or raise ``ValueError``.

    Accepted: absolute ``http``/``https`` URLs with a host name (ASCII labels or an IP literal), no user info, no
    whitespace or control characters. Everything else (``javascript:``, ``data:``, ``ftp:``, ``//host``, relative
    paths) is refused.
    """
    message = "Enter a full web address starting with http:// or https://."
    if not value or _WHITESPACE_OR_CONTROL.search(value) or not value.isascii():
        raise ValueError(message)
    try:
        parts = urlsplit(value)
        port = parts.port  # raises ValueError for a malformed port
    except ValueError:
        raise ValueError(message) from None
    scheme = parts.scheme.lower()
    if scheme not in {"http", "https"} or not parts.netloc or parts.username is not None or parts.password is not None:
        raise ValueError(message)
    if "@" in parts.netloc:
        raise ValueError(message)
    host = (parts.hostname or "").lower()
    if not host or not _valid_host(host):
        raise ValueError(message)
    netloc = f"[{host}]" if ":" in host else host
    if port is not None:
        netloc = f"{netloc}:{port}"
    return urlunsplit((scheme, netloc, parts.path, parts.query, parts.fragment))


def _valid_host(host: str) -> bool:
    if ":" in host:  # IPv6 literal (already unbracketed by urlsplit)
        return bool(re.fullmatch(r"[0-9a-f:.]+", host))
    labels = host.rstrip(".").split(".")
    return all(_HOST_LABEL.match(label) for label in labels)


def _check_http_url(value: str) -> str:
    return normalise_http_url(value)


def _check_booking_url(value: str | None) -> str | None:
    """``booking_url``: null, empty (stored as null), ``#`` or an absolute http(s) URL."""
    if value is None or value == "":
        return None
    if value == "#":
        return value
    return _check_http_url(value)


HttpUrlText = Annotated[
    str,
    StringConstraints(max_length=URL_MAX_LENGTH),
    AfterValidator(check_single_line),
    AfterValidator(_check_http_url),
]
# ``str | None`` with the checks on the string branch; empty strings become None in ``_check_booking_url``.
BookingUrl = (
    Annotated[
        str,
        StringConstraints(max_length=URL_MAX_LENGTH),
        AfterValidator(check_single_line),
        AfterValidator(_check_booking_url),
    ]
    | None
)
