"""Human-friendly labels/summaries for tool activity shown in the chat UI."""

from __future__ import annotations

import json
import re
from pathlib import PurePosixPath
from typing import Any, Optional


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


def _short(text: str, n: int = 72) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if len(text) <= n:
        return text
    return text[: n - 1] + "…"


def _agent_display_name(agent_id: str) -> str:
    try:
        from mcp_servers import AGENT_CATALOG

        for row in AGENT_CATALOG:
            if row["id"] == agent_id:
                return row["name"]
    except Exception:
        pass
    return agent_id


def _skill_name_from_path(path: str) -> Optional[str]:
    # /skills/search/SKILL.md → search
    try:
        parts = PurePosixPath(path.replace("\\", "/")).parts
        if "skills" in parts:
            i = parts.index("skills")
            if i + 1 < len(parts):
                return parts[i + 1]
    except Exception:
        pass
    return None


def describe_tool_start(name: str, tool_input: Any) -> dict[str, str]:
    """Return label/detail/category for a tool_start event."""
    inp = _as_dict(tool_input)
    raw = tool_input if isinstance(tool_input, str) else ""

    if name == "write_todos":
        todos = inp.get("todos") if isinstance(inp.get("todos"), list) else []
        n = len(todos)
        return {
            "category": "plan",
            "label": "Updating plan",
            "detail": f"{n} step{'s' if n != 1 else ''}" if n else "Organizing work",
        }

    if name == "task":
        sub = str(
            inp.get("subagent_type")
            or inp.get("agent")
            or inp.get("name")
            or ""
        ).strip()
        desc = _short(str(inp.get("description") or ""), 60)
        if sub in {"gatherer", "researcher"}:
            return {
                "category": "subagent",
                "label": "Gathering evidence",
                "detail": desc or "Using enabled agents",
            }
        if sub == "verifier":
            return {
                "category": "subagent",
                "label": "Verifying",
                "detail": desc or "Checking claims",
            }
        if sub == "general-purpose":
            return {
                "category": "subagent",
                "label": "Running subagent",
                "detail": desc or "general-purpose",
            }
        return {
            "category": "subagent",
            "label": f"Delegating to {sub}" if sub else "Running subagent",
            "detail": desc,
        }

    # DeepAgents filesystem / skill reads
    if name in {"read_file", "read_file_tool", "ReadFile"} or name.endswith("read_file"):
        path = str(inp.get("file_path") or inp.get("path") or inp.get("file") or raw or "")
        skill = _skill_name_from_path(path)
        if skill or "/skills/" in path or "SKILL.md" in path:
            agent = _agent_display_name(skill) if skill else "agent"
            if skill == "research":
                agent = "Research"
            return {
                "category": "skill",
                "label": f"Loading SKILLS for {agent}",
                "detail": agent,
            }
        return {
            "category": "files",
            "label": "Reading a file",
            "detail": _short(path) if path else "",
        }

    if name in {"ls", "list_files", "glob"} or name.endswith("__ls"):
        return {"category": "files", "label": "Checking files", "detail": ""}

    if name in {"write_file", "edit_file"}:
        return {"category": "files", "label": "Updating a file", "detail": ""}

    # MCP agents: agent__tool
    if "__" in name:
        agent, tool = name.split("__", 1)
        if agent == "search" or tool == "search":
            q = str(inp.get("query") or raw or "")
            return {
                "category": "search",
                "label": "Searching the web",
                "detail": _short(q, 80) if q else "Looking up current information",
            }
        if agent == "calculator":
            expr = str(
                inp.get("expression")
                or inp.get("a", "")
                or raw
                or tool.replace("_", " ")
            )
            return {
                "category": "calculator",
                "label": "Calculating",
                "detail": _short(str(expr)) if expr else tool.replace("_", " "),
            }
        if agent == "weather":
            city = str(inp.get("city") or raw or "")
            return {
                "category": "weather",
                "label": "Checking weather",
                "detail": city or "Looking up conditions",
            }
        if agent == "datetime":
            return {
                "category": "datetime",
                "label": "Checking date & time",
                "detail": tool.replace("_", " "),
            }
        return {
            "category": "tool",
            "label": f"Using {agent}",
            "detail": tool.replace("_", " "),
        }

    # fallbacks
    if "search" in name.lower():
        q = str(inp.get("query") or "")
        return {"category": "search", "label": "Searching the web", "detail": _short(q)}

    return {
        "category": "tool",
        "label": "Working",
        "detail": name.replace("_", " "),
    }


def describe_tool_end(name: str, tool_input: Any, output: Any) -> dict[str, str]:
    """Return friendly completion label/summary — never dump raw payloads."""
    start = describe_tool_start(name, tool_input)
    out_text = output if isinstance(output, str) else json.dumps(output, default=str)
    out_dict = _as_dict(output)

    if start["category"] == "plan":
        return {**start, "label": "Updated plan", "summary": start.get("detail") or ""}

    if start["category"] == "subagent":
        label = start["label"]
        if label == "Gathering evidence":
            done = "Gathered evidence"
        elif label == "Verifying":
            done = "Verified"
        elif label == "Running subagent":
            done = "Subagent finished"
        elif label.startswith("Delegating"):
            done = "Delegated"
        elif label.endswith("ing"):
            done = label[:-3] + "ed"
        else:
            done = label
        return {**start, "label": done, "summary": ""}

    if start["category"] == "skill":
        agent = start.get("detail") or "agent"
        return {
            **start,
            "label": f"Loaded SKILLS for {agent}",
            "summary": "",
        }

    if start["category"] == "search":
        if out_dict.get("status") == "error" or out_text.startswith('{"status": "error"'):
            err = out_dict.get("error") or "Search failed"
            return {**start, "label": "Search failed", "summary": _short(str(err), 100)}
        cites = out_dict.get("citations") or []
        n = len(cites) if isinstance(cites, list) else 0
        summary = f"Found {n} source{'s' if n != 1 else ''}" if n else "Got an answer"
        return {**start, "label": "Searched the web", "summary": summary}

    if start["category"] == "calculator":
        if isinstance(out_dict, dict) and "error" in str(out_text).lower()[:40]:
            return {**start, "label": "Calculation failed", "summary": "Couldn't evaluate that"}
        # Prefer a short numeric/result peek without dumping
        preview = _short(out_text, 40)
        if preview.startswith("{") or preview.startswith("["):
            preview = "Got a result"
        return {**start, "label": "Calculated", "summary": preview}

    if start["category"] == "weather":
        return {**start, "label": "Got weather", "summary": _short(out_text, 60) or "Updated"}

    if start["category"] == "datetime":
        return {**start, "label": "Got date & time", "summary": "Updated"}

    if start["category"] == "files":
        return {**start, "label": start["label"].replace("Reading", "Read").replace("Checking", "Checked"), "summary": ""}

    return {**start, "label": "Done", "summary": ""}
