"""Test-only routes used to exercise middleware and error handling before real endpoints exist.

They are mounted on a test app only (``probe_app`` fixture), never on the real application.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, FastAPI
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Page, PageParams

router = APIRouter()


class ProbeResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1)
    value: int


class ProbeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    email: str | None = None
    password: str | None = None
    message: str | None = None
    results: list[ProbeResult] = Field(default_factory=list)
    blob: str | None = None


@router.get("/api/admin/_probe")
async def admin_probe_get() -> dict[str, bool]:
    return {"ok": True}


@router.put("/api/admin/_probe")
async def admin_probe_put(body: ProbeInput) -> dict[str, Any]:
    return {"ok": True, "results": len(body.results)}


@router.post("/api/admin/_probe")
async def admin_probe_post(body: ProbeInput) -> dict[str, bool]:
    return {"ok": True}


@router.get("/api/public/_probe")
async def public_probe_get() -> dict[str, bool]:
    return {"ok": True}


@router.post("/api/public/_probe")
async def public_probe_post(body: ProbeInput) -> dict[str, bool]:
    return {"ok": True}


@router.get("/api/public/_boom")
async def boom() -> None:
    raise RuntimeError("boom with secret detail: s3cr3t-value")


@router.get("/api/public/_page")
async def paged(params: Annotated[PageParams, Depends()]) -> Page[int]:
    total = 7
    items = list(range(total))[params.offset : params.offset + params.limit]
    return Page[int].build(items, total, params)


def attach(app: FastAPI) -> FastAPI:
    app.include_router(router)
    return app
