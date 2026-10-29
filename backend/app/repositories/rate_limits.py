"""``rate_limit_counters`` statements (BE-007, BE-010, SD-010).

The counter update is one atomic ``INSERT … ON CONFLICT … DO UPDATE … RETURNING`` (no read-modify-write), so
concurrent requests are counted exactly. Times come from the database clock (``now()``).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import Table, and_, case, delete, func, literal, or_, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RateLimitCounter

_table: Table = RateLimitCounter.__table__  # type: ignore[assignment]


@dataclass(frozen=True, slots=True)
class CounterState:
    count: int
    window_start: datetime
    blocked_until: datetime | None
    now: datetime


async def hit(
    session: AsyncSession,
    bucket: str,
    key_hash: str,
    *,
    window: timedelta,
    block_at: int | None = None,
    block_for: timedelta | None = None,
) -> CounterState:
    """Count one event in a fixed window; when ``block_at`` is reached set ``blocked_until = now() + block_for``."""
    now = func.now()
    expired = _table.c.window_start <= now - literal(window)
    new_count = case((expired, 1), else_=_table.c.count + 1)
    if block_at is not None and block_for is not None:
        blocked_until = case((new_count >= block_at, now + literal(block_for)), else_=None)
        initial_block = now + literal(block_for) if block_at <= 1 else None
    else:
        blocked_until = None
        initial_block = None
    statement = (
        insert(_table)
        .values(
            bucket=bucket,
            key_hash=key_hash,
            window_start=now,
            count=1,
            blocked_until=initial_block,
            updated_at=now,
        )
        .on_conflict_do_update(
            index_elements=[_table.c.bucket, _table.c.key_hash],
            set_={
                "window_start": case((expired, now), else_=_table.c.window_start),
                "count": new_count,
                "blocked_until": blocked_until,
                "updated_at": now,
            },
        )
        .returning(_table.c.count, _table.c.window_start, _table.c.blocked_until, now.label("now"))
    )
    row = (await session.execute(statement)).one()
    return CounterState(count=int(row[0]), window_start=row.window_start, blocked_until=row.blocked_until, now=row.now)


async def latest_block(session: AsyncSession, keys: list[tuple[str, str]]) -> tuple[datetime | None, datetime]:
    """Latest ``blocked_until`` still in the future among ``(bucket, key_hash)`` pairs, and the DB time."""
    now = func.now()
    condition = or_(*(and_(_table.c.bucket == bucket, _table.c.key_hash == key) for bucket, key in keys))
    statement = select(
        select(func.max(_table.c.blocked_until)).where(condition, _table.c.blocked_until > now).scalar_subquery(),
        now,
    )
    row = (await session.execute(statement)).one()
    return row[0], row[1]


async def delete_keys(session: AsyncSession, keys: list[tuple[str, str]]) -> None:
    await session.execute(delete(_table).where(tuple_(_table.c.bucket, _table.c.key_hash).in_(keys)))


async def delete_older_than(session: AsyncSession, age: timedelta) -> int:
    result = await session.execute(delete(_table).where(_table.c.updated_at < func.now() - literal(age)))
    return int(getattr(result, "rowcount", 0) or 0)
