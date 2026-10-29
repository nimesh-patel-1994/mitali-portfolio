"""Live preview (BE-018): the same ``render_markdown`` as on save, run in the threadpool (CPU work)."""

from __future__ import annotations

from starlette.concurrency import run_in_threadpool

from app.schemas.markdown import MarkdownPreview
from app.services.markdown import render_markdown


async def preview_markdown(markdown: str) -> MarkdownPreview:
    rendered = await run_in_threadpool(render_markdown, markdown)
    return MarkdownPreview(
        html=rendered.html, word_count=rendered.word_count, reading_time_min=rendered.reading_time_min
    )
