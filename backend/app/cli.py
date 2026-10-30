"""Admin command line (BE-011, TS-009, SEC-BE-002; BE-023, TS-017): ``create-admin``, ``reset-password``, ``seed``.

Usage (from ``backend/``)::

    uv run python -m app.cli create-admin --email you@example.com
    uv run python -m app.cli reset-password [--email you@example.com]
    uv run python -m app.cli seed [--reset]

Passwords are never accepted as arguments (they would end up in shell history): they are read twice with
``getpass``, or once from standard input with ``--password-stdin`` (automated tests). They are never echoed,
printed or logged. ``seed`` asks for nothing and never creates an admin. Exit code 0 on success, 1 on any refusal or
error.
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import sys
from collections.abc import Callable, Sequence
from typing import TextIO

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import ConfigError, Settings, load_settings
from app.db import DatabaseUnreachableError, create_engine, create_sessionmaker, verify_connection
from app.seed.runner import run_seed
from app.services import auth as auth_service
from app.services.auth import AdminAccountError
from app.services.seed import SeedSummary

SessionFactory = Callable[[], AsyncSession]

EXIT_OK = 0
EXIT_FAILED = 1


class CliError(Exception):
    """Refusal with a message that is safe to print."""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="mitali-portfolio admin commands")
    commands = parser.add_subparsers(dest="command", required=True)

    create = commands.add_parser("create-admin", help="create the single admin account (only when none exists)")
    create.add_argument("--email", required=True, help="admin email address")
    create.add_argument("--password-stdin", action="store_true", help="read the password from standard input")

    reset = commands.add_parser("reset-password", help="set a new admin password and end all sessions")
    reset.add_argument("--email", help="admin email address (optional; checked when given)")
    reset.add_argument("--password-stdin", action="store_true", help="read the password from standard input")

    seed = commands.add_parser("seed", help="insert the original sample content and placeholder images")
    seed.add_argument(
        "--reset", action="store_true", help="restore seeded rows to their seed values (default: insert missing only)"
    )
    return parser


def read_password(*, from_stdin: bool, stdin: TextIO) -> str:
    if from_stdin:
        line = stdin.readline()
        if not line:
            raise CliError("No password received on standard input.")
        return line.rstrip("\r\n")
    first = getpass.getpass("New admin password: ")
    second = getpass.getpass("Repeat the password: ")
    if first != second:
        raise CliError("The passwords do not match. Nothing was changed.")
    return first


async def main_async(
    argv: Sequence[str] | None = None,
    *,
    settings: Settings | None = None,
    session_factory: SessionFactory | None = None,
    stdin: TextIO | None = None,
    stdout: TextIO | None = None,
    stderr: TextIO | None = None,
) -> int:
    """Run one command. Tests inject ``session_factory`` (sessions on the test transaction) and the streams."""
    stdin, stdout, stderr = stdin or sys.stdin, stdout or sys.stdout, stderr or sys.stderr
    args = build_parser().parse_args(list(argv) if argv is not None else None)
    engine = None
    try:
        if settings is None:
            settings = load_settings()
        if args.command == "seed":
            return await _seed(args.reset, settings, session_factory, stdout, stderr)
        if session_factory is None:
            engine = create_engine(settings.database_url, pool_size=1)
            await verify_connection(engine, settings.database_location())
            session_factory = create_sessionmaker(engine)
        password = read_password(from_stdin=args.password_stdin, stdin=stdin)
        async with session_factory() as session:
            if args.command == "create-admin":
                await auth_service.create_admin(session, email=args.email, password=password)
                print("Admin account created. Log in at /admin.", file=stdout)
            else:
                await auth_service.reset_password(
                    session, email=args.email, password=password, hash_secret=settings.hash_key_secret
                )
                print("Password changed. All admin sessions were ended.", file=stdout)
        return EXIT_OK
    except (CliError, AdminAccountError, ConfigError, DatabaseUnreachableError) as exc:
        print(f"Error: {exc}", file=stderr)
    except (OSError, SQLAlchemyError) as exc:
        location = settings.database_location() if settings is not None else "the configured host"
        print(f"Error: database unreachable on {location} ({type(exc).__name__}).", file=stderr)
    except Exception as exc:  # CLI entry point: never show a traceback that could contain input (BE-REV-006)
        print(f"Error: unexpected failure ({type(exc).__name__}). Nothing was changed.", file=stderr)
    finally:
        if engine is not None:
            await engine.dispose()
    return EXIT_FAILED


async def _seed(
    reset: bool,
    settings: Settings,
    session_factory: SessionFactory | None,
    stdout: TextIO,
    stderr: TextIO,
) -> int:
    try:
        summary = await run_seed(reset, settings=settings, session_factory=session_factory)
    except DatabaseUnreachableError as exc:
        print(f"Error: {exc}", file=stderr)
        return EXIT_FAILED
    except Exception as exc:  # CLI entry point: one clear line, the transaction was rolled back (BE-REV-006)
        print(f"Error: seeding failed ({type(exc).__name__}). Nothing was changed in the database.", file=stderr)
        return EXIT_FAILED
    print(_seed_report(summary), file=stdout)
    return EXIT_OK


def _seed_report(summary: SeedSummary) -> str:
    mode = "reset to seed values" if summary.reset else "missing records inserted"
    counts = ", ".join(f"{name} {count}" for name, count in summary.counts.items())
    enquiries = "sample enquiries included (development)" if summary.enquiries_seeded else "no sample enquiries"
    return f"Seed complete ({mode}; {enquiries}; {summary.images_written} placeholder images). Rows: {counts}."


def main(argv: Sequence[str] | None = None, *, settings: Settings | None = None) -> int:
    return asyncio.run(main_async(argv, settings=settings))


if __name__ == "__main__":
    raise SystemExit(main())
