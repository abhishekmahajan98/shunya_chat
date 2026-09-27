"""Format tool activity for the chat UI — tool name + params, Sub agent N labels."""

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


def _task_description(tool_input: Any) -> str:
    inp = _as_dict(tool_input)
    nested = _as_dict(inp.get("input") or inp.get("args") or {})
    return str(
        inp.get("description") or nested.get("description") or ""
    ).strip()


def describe_tool_start(
    name: str,
    tool_input: Any,
    *,
    subagent_index: int | None = None,
) -> dict[str, str]:
    """label/detail/category for a tool_start event.

    For task tools, pass subagent_index (1-based) so the UI shows
    \"Sub agent 1\", \"Sub agent 2\", …
    """
    if name == "task":
        n = int(subagent_index or 1)
        label = f"Sub agent {n}"
        via_key = f"sub agent {n}"
        return {
            "category": "subagent",
            "label": label,
            "detail": _task_description(tool_input),
            "subagent": via_key,
            "via_label": via_key,
        }

    if name == "load_skill":
        inp = _as_dict(tool_input)
        skill = str(inp.get("name") or "").strip()
        return {
            "category": "tool",
            "label": f"load_skill · {skill}" if skill else "load_skill",
            "detail": _format_params(tool_input),
        }

    return {
        "category": "tool",
        "label": name or "tool",
        "detail": _format_params(tool_input),
    }


def describe_tool_end(
    name: str,
    tool_input: Any,
    output: Any = None,
    *,
    subagent_index: int | None = None,
) -> dict[str, str]:
    """Same as start — do not surface tool response on the timeline."""
    start = describe_tool_start(name, tool_input, subagent_index=subagent_index)
    return {**start, "summary": ""}
