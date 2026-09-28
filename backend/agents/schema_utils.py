"""Shared helpers for wrapping MCP tool schemas as LangChain tools."""

from __future__ import annotations

from typing import Any

from pydantic import Field


def _normalize_json_type(raw: Any) -> str | None:
    """Resolve JSON Schema `type` which may be a string or a union list."""
    if isinstance(raw, list):
        for item in raw:
            if item and item != "null":
                return str(item)
        return None
    if isinstance(raw, str):
        return raw
    return None


def json_schema_to_fields(schema: dict[str, Any] | None) -> dict[str, Any]:
    """Convert a JSON Schema object into pydantic `create_model` field kwargs."""
    props = (schema or {}).get("properties") or {}
    required_raw = (schema or {}).get("required") or []
    required = set(required_raw) if isinstance(required_raw, (list, tuple, set)) else set()
    fields: dict[str, Any] = {}
    type_map = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list,
        "object": dict,
    }
    for name, prop in props.items():
        if not isinstance(prop, dict):
            prop = {}
        type_key = _normalize_json_type(prop.get("type"))
        py_type = type_map.get(type_key, Any) if type_key else Any
        default = ... if name in required else None
        fields[name] = (
            py_type | None if default is None and py_type is not Any else py_type,
            Field(default=default, description=prop.get("description") or name),
        )
    return fields
