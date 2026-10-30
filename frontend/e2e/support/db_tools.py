"""E2E helper (tester): small maintenance actions on the TEST database only.

Run from backend/ with the backend virtualenv:  python -m uv run python ../frontend/e2e/support/db_tools.py <action>
Reads DATABASE_URL from the environment (the E2E harness sets it to TEST_DATABASE_URL). Refuses any database whose
name does not end in "_test". Never prints the URL.

Actions:
  clear-limits   delete all rate-limit / login-throttle counters (contact form and login buckets)
"""

import asyncio
import os
import sys

import asyncpg  # type: ignore[import-untyped]
from sqlalchemy.engine import make_url


async def main(action: str) -> int:
    raw = os.environ.get("DATABASE_URL", "")
    url = make_url(raw)
    if not (url.database or "").endswith("_test"):
        print("db_tools: refusing: DATABASE_URL is not a *_test database", file=sys.stderr)
        return 2
    conn = await asyncpg.connect(
        user=url.username, password=url.password, host=url.host, port=url.port, database=url.database
    )
    try:
        if action == "clear-limits":
            await conn.execute("DELETE FROM rate_limit_counters")
        else:
            print(f"db_tools: unknown action {action}", file=sys.stderr)
            return 2
    finally:
        await conn.close()
    print(f"db_tools: {action} OK")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "")))
