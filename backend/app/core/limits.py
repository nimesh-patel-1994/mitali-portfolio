"""Request body size limits (TS-003 point 4, SEC-BE-018).

JSON and other bodies: at most 1 MB. ``POST /api/admin/media``: at most 10 MB file + 64 KB multipart overhead
(TS-011; the upload service additionally counts the file bytes itself).

The limit is enforced twice: early from ``Content-Length`` and while the body streams in (chunked requests or a
lying header). When the streamed limit trips, whatever the inner app does with the error (FastAPI turns body read
failures into a 400) is replaced by the 413 envelope as long as no response has started.
"""

from __future__ import annotations

from typing import Final

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import ErrorCode, error_body

JSON_BODY_LIMIT: Final = 1024 * 1024  # 1 MB
MEDIA_FILE_LIMIT: Final = 10 * 1024 * 1024  # 10 MB
MEDIA_BODY_LIMIT: Final = MEDIA_FILE_LIMIT + 64 * 1024  # file + form overhead
MEDIA_UPLOAD_PATH: Final = "/api/admin/media"


class BodyTooLargeError(Exception):
    """Raised from ``receive`` when the streamed body exceeds the limit."""


def limit_for(method: str, path: str) -> tuple[int, ErrorCode, str]:
    if method == "POST" and path.rstrip("/") == MEDIA_UPLOAD_PATH:
        return MEDIA_BODY_LIMIT, "file_too_large", "The file is larger than 10 MB."
    return JSON_BODY_LIMIT, "payload_too_large", "The request body is too large (max 1 MB)."


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit, code, message = limit_for(scope["method"], scope["path"])
        too_large = JSONResponse(error_body(code, message), status_code=413)

        content_length = Headers(scope=scope).get("content-length")
        if content_length is not None:
            try:
                declared = int(content_length)
            except ValueError:
                declared = -1
            if declared > limit:
                await self._reject(too_large, scope, receive, send)
                return

        received = 0
        exceeded = False
        response_started = False
        sent_413 = False

        async def limited_receive() -> Message:
            nonlocal received, exceeded
            message_in = await receive()
            if message_in["type"] == "http.request":
                received += len(message_in.get("body", b""))
                if received > limit:
                    exceeded = True
                    raise BodyTooLargeError
            return message_in

        async def guarded_send(message_out: Message) -> None:
            nonlocal response_started, sent_413
            if exceeded and not response_started:
                # Swallow the inner app's response (typically FastAPI's 400 for a failed body read).
                if message_out["type"] == "http.response.start":
                    response_started = sent_413 = True
                    await too_large(scope, _empty_receive, send)
                return
            if exceeded:
                return
            if message_out["type"] == "http.response.start":
                response_started = True
            await send(message_out)

        try:
            await self.app(scope, limited_receive, guarded_send)
        except BodyTooLargeError:
            if sent_413:
                return
            if response_started:
                raise
            await too_large(scope, _empty_receive, send)

    @staticmethod
    async def _reject(response: JSONResponse, scope: Scope, receive: Receive, send: Send) -> None:
        # Close the connection afterwards: the unread body must not be parsed as a next request.
        response.headers["Connection"] = "close"
        await response(scope, receive, send)


async def _empty_receive() -> Message:
    return {"type": "http.disconnect"}
