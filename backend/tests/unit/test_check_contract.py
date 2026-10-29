"""BE-T-108: ``scripts/check_contract.py`` passes for the current app and reports drift readably."""

from __future__ import annotations

import copy
import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
import yaml

from app.main import create_app
from tests.harness import BACKEND_DIR, unit_settings

CONTRACT_PATH = BACKEND_DIR.parent / "docs" / "api-contract.yaml"


def _load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("check_contract", BACKEND_DIR / "scripts" / "check_contract.py")
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["check_contract"] = module
    spec.loader.exec_module(module)
    return module


check_contract = _load_script()


@pytest.fixture(scope="module")
def app_openapi() -> dict[str, Any]:
    return create_app(unit_settings()).openapi()


@pytest.fixture(scope="module")
def contract() -> dict[str, Any]:
    loaded: dict[str, Any] = check_contract.load_contract(CONTRACT_PATH)
    return loaded


def _contract_limited_to_app(contract: dict[str, Any], app_openapi: dict[str, Any], folder: Path) -> Path:
    """Contract copy that keeps only the operations the app implements (the build is incremental)."""
    implemented = set(check_contract.operations(app_openapi))
    limited = copy.deepcopy(contract)
    for path in list(limited["paths"]):
        item = limited["paths"][path]
        for method in list(item):
            if method in check_contract.HTTP_METHODS and (path, method.upper()) not in implemented:
                del item[method]
        if not any(method in check_contract.HTTP_METHODS for method in item):
            del limited["paths"][path]
    target = folder / "contract-subset.yaml"
    target.write_text(yaml.safe_dump(limited, sort_keys=False), encoding="utf-8")
    return target


@pytest.mark.be_t("BE-T-108")
def test_check_contract_current_app_partial_mode_exits_zero(capsys: pytest.CaptureFixture[str]) -> None:
    assert check_contract.main(["--partial", "--quiet"]) == 0
    assert "OK (partial)" in capsys.readouterr().out


@pytest.mark.be_t("BE-T-108")
def test_check_contract_strict_on_implemented_operations_exits_zero(
    contract: dict[str, Any], app_openapi: dict[str, Any], tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    subset = _contract_limited_to_app(contract, app_openapi, tmp_path)
    assert check_contract.main(["--contract", str(subset)], app_openapi=lambda: app_openapi) == 0
    assert "OK (strict)" in capsys.readouterr().out


@pytest.mark.be_t("BE-T-108")
def test_check_contract_changed_status_code_exits_non_zero_with_diff(
    contract: dict[str, Any], app_openapi: dict[str, Any], tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    subset = _contract_limited_to_app(contract, app_openapi, tmp_path)
    drifted = copy.deepcopy(app_openapi)
    responses = drifted["paths"]["/api/health"]["get"]["responses"]
    responses["500"] = responses.pop("503")

    assert check_contract.main(["--contract", str(subset)], app_openapi=lambda: drifted) == 1
    output = capsys.readouterr().out
    assert "GET /api/health: status codes differ (contract: ['200', '503'], app: ['200', '500'])" in output
    assert "FAIL" in output


@pytest.mark.be_t("BE-T-108")
def test_check_contract_reports_property_operation_id_and_missing_operation_drift(
    contract: dict[str, Any], app_openapi: dict[str, Any]
) -> None:
    drifted = copy.deepcopy(app_openapi)
    health = drifted["components"]["schemas"]["Health"]
    health["properties"]["db"] = health["properties"].pop("database")
    health["required"] = ["status", "db"]
    drifted["paths"]["/api/health"]["get"]["operationId"] = "healthCheck"
    drifted["paths"]["/api/extra"] = {"get": {"operationId": "extra", "responses": {"200": {"description": "x"}}}}
    del drifted["paths"]["/api/public/enquiries"]

    report = check_contract.compare_documents(contract, drifted, partial=False)
    text = "\n".join(report.errors)
    assert "GET /api/health: operationId differs (contract: getHealth, app: healthCheck)" in text
    assert "GET /api/health 200: properties differ (missing in app: ['database'], not in contract: ['db'])" in text
    assert "GET /api/extra: operation exists in the app but not in the contract" in text
    assert "POST /api/public/enquiries (createEnquiry): not implemented in the app" in text


def test_check_contract_error_envelope_matches_contract_error_schema(
    contract: dict[str, Any], app_openapi: dict[str, Any]
) -> None:
    contract_shape = check_contract.shape({"$ref": "#/components/schemas/Error"}, contract)
    app_shape = check_contract.shape({"$ref": "#/components/schemas/ErrorEnvelope"}, app_openapi)
    report = check_contract.Report()
    check_contract.compare_shapes(contract_shape, app_shape, "Error", report)
    assert report.errors == []


def test_check_contract_reads_yaml_1_2_scalars_as_strings(tmp_path: Path) -> None:
    """``1000_3000`` is a string in YAML 1.2 (OpenAPI 3.1); PyYAML's 1.1 resolver would read the integer 10003000."""
    source = tmp_path / "c.yaml"
    source.write_text("paths: {}\nvalues: [1000_3000, 12, 1.5, 0x1F, .inf]\n", encoding="utf-8")
    loaded = check_contract.load_contract(source)
    assert loaded["values"][:4] == ["1000_3000", 12, 1.5, 31]
    budget = check_contract.load_contract(CONTRACT_PATH)["components"]["schemas"]["BudgetRange"]["enum"]
    assert "1000_3000" in budget
