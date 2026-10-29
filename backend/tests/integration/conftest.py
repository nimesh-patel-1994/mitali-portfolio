"""Integration fixtures: the real app plus test-only probe routes (no database needed)."""

from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest
from fastapi import FastAPI

from app.core.config import Settings
from app.main import create_app
from tests.conftest import ALLOWED_ORIGIN, BASE_URL
from tests.integration import probe


@pytest.fixture
def probe_app(settings: Settings) -> FastAPI:
    return probe.attach(create_app(settings))


@pytest.fixture
async def probe_client(probe_app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=probe_app), base_url=BASE_URL) as client:
        yield client


@pytest.fixture
def allowed_origin() -> str:
    return ALLOWED_ORIGIN
