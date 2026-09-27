"""Format tool activity for the chat UI — tool name + params, with subagent labels."""

from __future__ import annotations

import json
from typing import Any


def _as_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _format_params(tool_input: Any, *, max_len: int = 240) -> str:
    """Compact params string for the timeline (no tool output)."""
    if tool_input is None:
        return ""
    if isinstance(tool_input, str):
        text = tool_input.strip()
        return text if len(text) <= max_len else text[: max_len - 1] + "…"
    inp = _as_dict(tool_input)
    if not inp:
        try:
            text = json.dumps(tool_input, default=str, ensure_ascii=False)
        except Exception:
            text = str(tool_input)
        text = text.strip()
        return text if len(text) <= max_len else text[: max_len - 1] + "…"
    try:
        text = json.dumps(inp, default=str, ensure_ascii=False, separators=(",", ": "))
    except Exception:
        text = str(inp)
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def _task_subagent_type(tool_input: Any) -> str:
    inp = _as_dict(tool_input)
    # LangChain sometimes nests args under "input" / "args"
    nested = _as_dict(inp.get("input") or inp.get("args") or {})
    sub = (
        inp.get("subagent_type")
        or inp.get("agent")
        or nested.get("subagent_type")
        or nested.get("agent")
        or inp.get("name")
        or ""
    )
    return str(sub).strip().lower()


def _task_description(tool_input: Any) -> str:
    inp = _as_dict(tool_input)
    nested = _as_dict(inp.get("input") or inp.get("args") or {})
    return str(
        inp.get("description") or nested.get("description") or ""
    ).strip()


_SUBAGENT_LABELS = {
    "verifier": "Verifier",
    "gatherer": "Gatherer",
}


def describe_tool_start(name: str, tool_input: Any) -> dict[str, str]:
    """label/detail/category for a tool_start event."""
    if name == "task":
        sub = _task_subagent_type(tool_input)
        desc = _task_description(tool_input)
        if sub in _SUBAGENT_LABELS:
            return {
                "category": sub,
                "label": _SUBAGENT_LABELS[sub],
                "detail": desc,
                "subagent": sub,
            }
        return {
            "category": "subagent",
            "label": (sub or "subagent").replace("_", " ").title(),
            "detail": desc,
            "subagent": sub or "subagent",
        }

    return {
        "category": "tool",
        "label": name or "tool",
        "detail": _format_params(tool_input),
    }


def describe_tool_end(name: str, tool_input: Any, output: Any = None) -> dict[str, str]:
    """Same as start — do not surface tool response on the timeline."""
    start = describe_tool_start(name, tool_input)
    return {**start, "summary": ""}
