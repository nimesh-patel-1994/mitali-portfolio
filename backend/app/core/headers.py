"""Security headers per response type (SEC-010 table, SEC-BE-015, TS-003 point 9).

All header values live in this module. The middleware runs outside the error handling so error responses, 404s,
static ``/media`` files and (later) frontend files get the same treatment. A ``Content-Security-Policy`` already set
by an inner app (``MediaFiles`` for SVG) is kept.
"""

from __future__ import annotations

from typing import Final

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

CSP_HTML: Final = (
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; "
    "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
)
CSP_API: Final = "default-src 'none'; frame-ancestors 'none'"
CSP_SVG: Final = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
# Non-HTML, non-API resources (raster media, scripts, styles): nothing may load from them.
CSP_OTHER: Final = CSP_API

PERMISSIONS_POLICY: Final = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
ROBOTS_NOINDEX: Final = "noindex, nofollow"
NO_STORE: Final = "no-store"

COMMON_HEADERS: Final[dict[str, str]] = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Resource-Policy": "same-origin",
}
HTML_HEADERS: Final[dict[str, str]] = {
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Cross-Origin-Opener-Policy": "same-origin",
}

API_PREFIX: Final = "/api/"
ADMIN_API_PREFIX: Final = "/api/admin/"


def is_admin_shell_path(path: str) -> bool:
    return path == "/admin" or path.startswith("/admin/")


def security_headers_for(path: str, content_type: str | None) -> dict[str, str]:
    """Headers to set for a response; pure function so tests can compare it with the SEC-010 table."""
    headers = dict(COMMON_HEADERS)
    is_html = bool(content_type) and str(content_type).lower().startswith("text/html")
    if path.startswith(API_PREFIX):
        headers["Content-Security-Policy"] = CSP_API
        if path.startswith(ADMIN_API_PREFIX):
            headers["X-Robots-Tag"] = ROBOTS_NOINDEX
            headers["Cache-Control"] = NO_STORE
    elif is_html:
        headers["Content-Security-Policy"] = CSP_HTML
        headers.update(HTML_HEADERS)
        if is_admin_shell_path(path):
            headers["X-Robots-Tag"] = ROBOTS_NOINDEX
            headers["Cache-Control"] = NO_STORE
    else:
        headers["Content-Security-Policy"] = CSP_OTHER
    return headers


# Headers that must win over anything an inner app set (privacy of admin data).
_FORCED: Final = frozenset({"Cache-Control", "X-Robots-Tag"})


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = str(scope.get("path", ""))

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in security_headers_for(path, headers.get("content-type")).items():
                    if name in _FORCED or name not in headers:
                        headers[name] = value
            await send(message)

        await self.app(scope, receive, send_wrapper)
