"""Route inventory (no database): SEC-BE-002 (no account routes besides login/logout/me), SEC-BE-005 (public routes
GET-only except ``createEnquiry``), BE-REV-003 (every admin route except login carries the session and CSRF
dependencies), coding standard 2 (explicit ``operation_id``)."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.dependencies.models import Dependant

from app.api.deps import get_current_admin, require_csrf
from app.main import create_app
from tests.harness import effective_api_routes, unit_settings


@pytest.fixture(scope="module")
def real_app() -> FastAPI:
    return create_app(unit_settings())


def _api_routes(app: FastAPI) -> Iterator[Any]:
    yield from effective_api_routes(app)


def _calls(dependant: Dependant) -> set[object]:
    found: set[object] = set()
    for sub in dependant.dependencies:
        found.add(sub.call)
        found |= _calls(sub)
    return found


@pytest.mark.sec("SEC-BE-002")
def test_admin_auth_routes_are_only_login_logout_me(real_app: FastAPI) -> None:
    auth = {route.operation_id for route in _api_routes(real_app) if route.path.startswith("/api/admin/auth")}
    assert auth == {"adminLogin", "adminLogout", "getAdminMe"}
    for route in _api_routes(real_app):
        body = route.body_field
        if body is not None and route.operation_id != "adminLogin":
            fields = set(getattr(body.field_info.annotation, "model_fields", {}))
            assert "password" not in fields, route.operation_id


@pytest.mark.sec("SEC-BE-005")
def test_public_routes_are_get_only_except_create_enquiry(real_app: FastAPI) -> None:
    for route in _api_routes(real_app):
        if route.path.startswith("/api/public") or route.path == "/api/health":
            methods = set(route.methods or ())
            if route.operation_id == "createEnquiry":
                assert methods == {"POST"}
            else:
                assert methods <= {"GET", "HEAD"}, route.path


@pytest.mark.be_t("BE-T-044")
def test_every_admin_route_except_login_has_session_and_csrf_dependencies(real_app: FastAPI) -> None:
    admin_routes = [route for route in _api_routes(real_app) if route.path.startswith("/api/admin")]
    assert admin_routes
    for route in admin_routes:
        calls = _calls(route.dependant)
        if route.operation_id == "adminLogin":
            assert get_current_admin not in calls
            continue
        assert get_current_admin in calls, route.path
        assert require_csrf in calls, route.path


def test_route_inventory_sees_every_operation_in_the_openapi_document(real_app: FastAPI) -> None:
    documented = {
        operation["operationId"]
        for item in real_app.openapi()["paths"].values()
        for operation in item.values()
        if isinstance(operation, dict) and "operationId" in operation
    }
    assert {route.operation_id for route in _api_routes(real_app)} == documented


def test_every_route_declares_its_contract_operation_id(real_app: FastAPI) -> None:
    for route in _api_routes(real_app):
        assert route.operation_id, route.path
        assert route.operation_id[0].islower()
