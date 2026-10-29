"""Compare the FastAPI-generated OpenAPI document with ``docs/api-contract.yaml`` (TS-019 point 2, BE-025).

Checked per operation: path, method, ``operationId``, parameters (name, location, required), request body (media
types, required flag, schema shape) and response status codes with their schema shape. "Schema shape" means object
property names, ``required`` lists, array items, scalar types and enums, resolved through ``$ref``/``allOf`` and with
``null`` alternatives ignored, so component *names* may differ (e.g. ``ErrorEnvelope`` vs ``Error``) while the JSON
structure must match.

Usage (from ``backend/``)::

    uv run python scripts/check_contract.py            # strict: every contract operation must exist
    uv run python scripts/check_contract.py --partial  # only operations the app already has (build in progress)

Exit codes: 0 = no drift, 1 = drift found (diff printed), 2 = the contract or the app could not be loaded.
The app is built with dummy settings and never connects to a database.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONTRACT = BACKEND_DIR.parent / "docs" / "api-contract.yaml"
HTTP_METHODS = ("get", "put", "post", "delete", "patch", "head", "options")

Schema = dict[str, Any]


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def error(self, message: str) -> None:
        self.errors.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)


# --------------------------------------------------------------------------------------------- loading


class _Yaml12Loader(yaml.SafeLoader):
    """SafeLoader with YAML 1.2 core-schema integers and floats.

    PyYAML implements YAML 1.1, where ``1000_3000`` is the integer 10003000 (underscores are digit separators). The
    contract is OpenAPI 3.1 (YAML 1.2), and the frontend's generator reads such values as strings, so this checker
    must too.
    """


_Yaml12Loader.yaml_implicit_resolvers = {
    key: [(tag, regexp) for tag, regexp in resolvers if tag not in {"tag:yaml.org,2002:int", "tag:yaml.org,2002:float"}]
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}
_Yaml12Loader.add_implicit_resolver(
    "tag:yaml.org,2002:int", re.compile(r"^(?:[-+]?[0-9]+|0o[0-7]+|0x[0-9a-fA-F]+)$"), list("-+0123456789")
)
_Yaml12Loader.add_implicit_resolver(
    "tag:yaml.org,2002:float",
    re.compile(
        r"^(?:[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$"
    ),
    list("-+0123456789."),
)


def load_contract(path: Path) -> Schema:
    with path.open(encoding="utf-8") as handle:
        document = yaml.load(handle, Loader=_Yaml12Loader)  # noqa: S506 - SafeLoader subclass
    if not isinstance(document, dict) or "paths" not in document:
        raise ValueError(f"{path} is not an OpenAPI document")
    return document


def build_app_openapi() -> Schema:
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    from app.core.config import load_settings
    from app.main import create_app

    settings = load_settings(
        _env_file=None,
        app_env="test",
        database_url="postgresql+asyncpg://contract:check@127.0.0.1:1/contract_check",
        hash_key_secret="contract-check-dummy-secret-0123456789abcdef",  # noqa: S106 - dummy, never used
    )
    app = create_app(settings)
    return app.openapi()


# --------------------------------------------------------------------------------------------- normalisation


def _resolve(document: Schema, ref: str) -> Schema:
    if not ref.startswith("#/"):
        raise ValueError(f"external $ref not supported: {ref}")
    node: Any = document
    for part in ref[2:].split("/"):
        node = node[part]
    if not isinstance(node, dict):
        raise ValueError(f"$ref {ref} does not point to an object")
    return node


def _types(schema: Schema) -> set[str]:
    raw = schema.get("type")
    if isinstance(raw, list):
        return {str(item) for item in raw if item != "null"}
    if isinstance(raw, str) and raw != "null":
        return {raw}
    return set()


def _is_null(schema: Any) -> bool:
    return isinstance(schema, dict) and (schema.get("type") == "null" or schema.get("type") == ["null"])


def shape(schema: Any, document: Schema, seen: frozenset[str] = frozenset()) -> Schema:
    """Reduce a schema to the structure that matters for the contract comparison."""
    if not isinstance(schema, dict) or not schema:
        return {"kind": "any"}
    if "$ref" in schema:
        ref = str(schema["$ref"])
        if ref in seen:
            return {"kind": "cycle", "ref": ref.rsplit("/", 1)[-1]}
        return shape(_resolve(document, ref), document, seen | {ref})
    if "allOf" in schema:
        merged: Schema = {"kind": "object", "properties": {}, "required": set(), "additional": None}
        for part in schema["allOf"]:
            sub = shape(part, document, seen)
            if sub["kind"] == "object":
                merged["properties"].update(sub["properties"])
                merged["required"] |= sub["required"]
        own = {key: value for key, value in schema.items() if key != "allOf"}
        if own.get("properties") or own.get("required"):
            sub = shape({**own, "type": "object"}, document, seen)
            merged["properties"].update(sub["properties"])
            merged["required"] |= sub["required"]
        return merged
    for combinator in ("anyOf", "oneOf"):
        if combinator in schema:
            options = [shape(item, document, seen) for item in schema[combinator] if not _is_null(item)]
            if len(options) == 1:
                return options[0]
            return {"kind": "union", "options": options}
    types = _types(schema)
    if "properties" in schema or types == {"object"}:
        additional = schema.get("additionalProperties")
        return {
            "kind": "object",
            "properties": {
                name: shape(value, document, seen) for name, value in (schema.get("properties") or {}).items()
            },
            "required": set(schema.get("required") or []),
            "additional": shape(additional, document, seen) if isinstance(additional, dict) else None,
        }
    if types == {"array"}:
        return {"kind": "array", "items": shape(schema.get("items"), document, seen)}
    enum: list[Any] | None = None
    if "enum" in schema:
        enum = list(schema["enum"])
    elif "const" in schema:
        enum = [schema["const"]]
    if enum is not None:
        enum = [value for value in enum if value is not None]
    return {"kind": "scalar", "types": types, "enum": None if enum is None else sorted(map(str, enum))}


def compare_shapes(contract: Schema, app: Schema, where: str, report: Report) -> None:
    if contract["kind"] == "any" or app["kind"] == "any" or "cycle" in (contract["kind"], app["kind"]):
        return
    if contract["kind"] != app["kind"]:
        report.error(f"{where}: contract has {contract['kind']}, app has {app['kind']}")
        return
    kind = contract["kind"]
    if kind == "object":
        c_props, a_props = set(contract["properties"]), set(app["properties"])
        if c_props != a_props:
            missing = sorted(c_props - a_props)
            extra = sorted(a_props - c_props)
            report.error(f"{where}: properties differ (missing in app: {missing}, not in contract: {extra})")
        if contract["required"] != app["required"]:
            report.error(
                f"{where}: required differs (contract: {sorted(contract['required'])}, app: {sorted(app['required'])})"
            )
        for name in sorted(c_props & a_props):
            compare_shapes(contract["properties"][name], app["properties"][name], f"{where}.{name}", report)
        if contract["additional"] is not None and app["additional"] is not None:
            compare_shapes(contract["additional"], app["additional"], f"{where}.<additional>", report)
    elif kind == "array":
        compare_shapes(contract["items"], app["items"], f"{where}[]", report)
    elif kind == "scalar":
        if contract["types"] and app["types"] and contract["types"] != app["types"]:
            report.error(f"{where}: type differs (contract: {sorted(contract['types'])}, app: {sorted(app['types'])})")
        if contract["enum"] is not None and contract["enum"] != app["enum"]:
            report.error(f"{where}: enum differs (contract: {contract['enum']}, app: {app['enum']})")
    elif kind == "union" and len(contract["options"]) != len(app["options"]):
        report.error(f"{where}: union with {len(contract['options'])} options vs {len(app['options'])}")


# --------------------------------------------------------------------------------------------- operations


def operations(document: Schema) -> dict[tuple[str, str], Schema]:
    found: dict[tuple[str, str], Schema] = {}
    for path, item in (document.get("paths") or {}).items():
        if not isinstance(item, dict):
            continue
        shared = item.get("parameters") or []
        for method in HTTP_METHODS:
            operation = item.get(method)
            if isinstance(operation, dict):
                found[(path, method.upper())] = {**operation, "_shared_parameters": shared}
    return found


def _parameters(operation: Schema, document: Schema) -> dict[tuple[str, str], bool]:
    result: dict[tuple[str, str], bool] = {}
    for raw in [*operation.get("_shared_parameters", []), *(operation.get("parameters") or [])]:
        parameter = _resolve(document, raw["$ref"]) if "$ref" in raw else raw
        location = str(parameter.get("in"))
        if location == "cookie":
            continue  # cookies are covered by securitySchemes, not compared
        result[(str(parameter.get("name")), location)] = bool(parameter.get("required", location == "path"))
    return result


def _content(body: Schema | None, document: Schema) -> dict[str, Schema]:
    if not body:
        return {}
    if "$ref" in body:
        body = _resolve(document, body["$ref"])
    return {media: spec.get("schema", {}) for media, spec in (body.get("content") or {}).items()}


def compare_operation(
    key: tuple[str, str], contract_op: Schema, app_op: Schema, contract: Schema, app: Schema, report: Report
) -> None:
    path, method = key
    label = f"{method} {path}"
    if contract_op.get("operationId") != app_op.get("operationId"):
        report.error(
            f"{label}: operationId differs (contract: {contract_op.get('operationId')}, "
            f"app: {app_op.get('operationId')})"
        )

    c_params, a_params = _parameters(contract_op, contract), _parameters(app_op, app)
    if set(c_params) != set(a_params):
        report.error(f"{label}: parameters differ (contract: {sorted(c_params)}, app: {sorted(a_params)})")
    for name in sorted(set(c_params) & set(a_params)):
        if c_params[name] != a_params[name]:
            report.error(f"{label}: parameter {name[1]}:{name[0]} required={c_params[name]} vs {a_params[name]}")

    c_body, a_body = contract_op.get("requestBody"), app_op.get("requestBody")
    c_content, a_content = _content(c_body, contract), _content(a_body, app)
    if set(c_content) != set(a_content):
        report.error(
            f"{label}: request body media types differ (contract: {sorted(c_content)}, app: {sorted(a_content)})"
        )
    elif c_body and a_body and bool(c_body.get("required")) != bool(a_body.get("required")):
        report.error(f"{label}: request body required flag differs")
    for media in sorted(set(c_content) & set(a_content)):
        compare_shapes(
            shape(c_content[media], contract),
            shape(a_content[media], app),
            f"{label} request[{media}]",
            report,
        )

    c_responses = {str(code): spec for code, spec in (contract_op.get("responses") or {}).items()}
    a_responses = {str(code): spec for code, spec in (app_op.get("responses") or {}).items()}
    if set(c_responses) != set(a_responses):
        report.error(f"{label}: status codes differ (contract: {sorted(c_responses)}, app: {sorted(a_responses)})")
    for code in sorted(set(c_responses) & set(a_responses)):
        c_resp = c_responses[code]
        c_resp = _resolve(contract, c_resp["$ref"]) if "$ref" in c_resp else c_resp
        c_media, a_media = _content(c_resp, contract), _content(a_responses[code], app)
        if bool(c_media) != bool(a_media):
            report.error(f"{label} {code}: contract body {'present' if c_media else 'absent'}, app differs")
            continue
        for media in sorted(set(c_media) & set(a_media)):
            compare_shapes(shape(c_media[media], contract), shape(a_media[media], app), f"{label} {code}", report)


def compare_documents(contract: Schema, app: Schema, *, partial: bool = False) -> Report:
    report = Report()
    c_ops, a_ops = operations(contract), operations(app)
    for key in sorted(set(a_ops) - set(c_ops)):
        report.error(f"{key[1]} {key[0]}: operation exists in the app but not in the contract")
    for key in sorted(set(c_ops) - set(a_ops)):
        message = f"{key[1]} {key[0]} ({c_ops[key].get('operationId')}): not implemented in the app"
        if partial:
            report.note(message)
        else:
            report.error(message)
    for key in sorted(set(c_ops) & set(a_ops)):
        compare_operation(key, c_ops[key], a_ops[key], contract, app, report)
    return report


# --------------------------------------------------------------------------------------------- CLI


def main(argv: Iterable[str] | None = None, *, app_openapi: Callable[[], Schema] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Compare the app's OpenAPI document with docs/api-contract.yaml")
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT, help="path to api-contract.yaml")
    parser.add_argument(
        "--partial",
        action="store_true",
        help="report contract operations missing from the app as notes instead of errors",
    )
    parser.add_argument("--quiet", action="store_true", help="do not list notes")
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        contract = load_contract(args.contract)
        generated = (app_openapi or build_app_openapi)()
    except (OSError, ValueError, yaml.YAMLError, KeyError) as exc:
        print(f"check_contract: cannot load inputs: {exc}", file=sys.stderr)
        return 2

    report = compare_documents(contract, generated, partial=args.partial)
    implemented = len(set(operations(contract)) & set(operations(generated)))
    total = len(operations(contract))
    if report.notes and not args.quiet:
        print(f"Notes ({len(report.notes)}):")
        for line in report.notes:
            print(f"  ~ {line}")
    if report.errors:
        print(f"Contract drift ({len(report.errors)}):")
        for line in report.errors:
            print(f"  - {line}")
        print(f"FAIL: {implemented}/{total} contract operations implemented; drift found.")
        return 1
    mode = "partial" if args.partial else "strict"
    print(f"OK ({mode}): {implemented}/{total} contract operations implemented, no drift in the implemented ones.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
