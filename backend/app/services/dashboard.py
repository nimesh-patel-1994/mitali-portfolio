"""Admin dashboard (BE-021, TS-015, REQ-052, REQ-066).

``needs_rebuild`` is true when there is no (valid) build or ``content_changed_at`` is later than the build's
``content_snapshot_at`` (the server time the pre-renderer recorded at build start, so edits made during a build still
count). ``rebuild_command`` is a constant string: no endpoint ever runs the build (SEC-BE-017).
"""

from __future__ import annotations

from pathlib import Path
from typing import Final

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import dashboard as repository
from app.schemas.dashboard import ContentCount, Dashboard, LastBuild
from app.services.build_info import read_build_info

REBUILD_COMMAND: Final = "cd frontend; npm run build:site"


async def get_dashboard(session: AsyncSession, *, dist_dir: Path) -> Dashboard:
    build = await read_build_info(dist_dir)
    async with session.begin():
        new_enquiries, content_changed_at, counts = await repository.summary(session)
    last_build = (
        LastBuild(built_at=build.built_at, content_snapshot_at=build.content_snapshot_at) if build is not None else None
    )
    needs_rebuild = last_build is None or content_changed_at > last_build.content_snapshot_at
    return Dashboard(
        new_enquiries=new_enquiries,
        content_changed_at=content_changed_at,
        last_build=last_build,
        needs_rebuild=needs_rebuild,
        rebuild_command=REBUILD_COMMAND,
        content_counts={
            key: ContentCount(total=total, published=published) for key, (total, published) in counts.items()
        },
    )
