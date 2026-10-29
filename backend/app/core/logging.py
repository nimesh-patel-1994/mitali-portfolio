"""Structured JSON logging (TS-003 point 6, SEC-008).

Log records carry an event name as the message and optional structured ``fields`` passed through
``extra={"fields": {...}}``. Never pass request bodies, cookies, tokens, passwords, emails, IP addresses or enquiry
fields. Exception records include the exception type and stack frames only, never the exception message, because
driver messages can echo row values (for example a unique-violation detail containing an email address).
"""

from __future__ import annotations

import json
import logging
import sys
import traceback
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

_CONFIGURED_FLAG = "_mitali_json_handler"

_base_record_factory = logging.getLogRecordFactory()


def _record_factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
    """Stamp the current request id on every record when it is created (handlers may format later)."""
    record = _base_record_factory(*args, **kwargs)
    if not hasattr(record, "request_id"):
        record.request_id = request_id_var.get()
    return record


logging.setLogRecordFactory(_record_factory)


class JsonFormatter(logging.Formatter):
    """One JSON object per line: ts, level, logger, event, request_id and the record's ``fields``."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "event": record.getMessage(),
            "request_id": getattr(record, "request_id", None) or request_id_var.get(),
        }
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            for key, value in fields.items():
                if key not in payload:
                    payload[key] = value
        if record.exc_info and record.exc_info[0] is not None:
            exc_type, _exc, tb = record.exc_info
            payload["error_type"] = exc_type.__name__
            payload["stack"] = [
                f"{frame.filename}:{frame.lineno} in {frame.name}" for frame in traceback.extract_tb(tb)
            ]
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    """Install the JSON handler on the root logger once and silence uvicorn's access log (SEC-008)."""
    root = logging.getLogger()
    if not any(getattr(handler, _CONFIGURED_FLAG, False) for handler in root.handlers):
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(JsonFormatter())
        setattr(handler, _CONFIGURED_FLAG, True)
        root.addHandler(handler)
    root.setLevel(level)

    # Uvicorn's access log prints the client address and the full request line; the app writes its own line.
    access = logging.getLogger("uvicorn.access")
    access.handlers.clear()
    access.propagate = False
    access.disabled = True

    # Uvicorn's error/startup loggers keep working but go through the JSON handler.
    for name in ("uvicorn", "uvicorn.error"):
        logger = logging.getLogger(name)
        logger.handlers.clear()
        logger.propagate = True
