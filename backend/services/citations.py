"""Citation helpers — model-driven sources, plus optional structured tool fields.

Most agents do not return a `citations` key. The model should call `cite_sources`
to record what to show in the UI. We only auto-pick up citations when a tool
explicitly returns `citations` / `sources` / `references` (or clear URL lists).
"""

from __future__ import annotations

import json
import re
from typing import Any, Optional
from urllib.parse import urlparse

from langchain_core.tools import tool
from pydantic import BaseModel, Field


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


def _content_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str)
    content = getattr(value, "content", None)
    if content is not None and content is not value:
        return _content_text(content)
    return str(value)


def _looks_like_url(text: str) -> bool:
    text = (text or "").strip()
    return text.startswith("http://") or text.startswith("https://")


def _title_from_url(url: str) -> str:
    try:
        host = urlparse(url).netloc or url
        return host.removeprefix("www.")
    except Exception:
        return url


def _agent_from_tool(name: str) -> str:
    if "__" in name:
        return name.split("__", 1)[0]
    return name


def normalize_citation_items(
    items: list[Any],
    *,
    default_agent: str | None = None,
    start_index: int = 1,
) -> list[dict]:
    """Normalize free-form model/tool citation items into UI dicts."""
    found: list[dict] = []
    for item in items or []:
        if isinstance(item, str):
            text = item.strip()
            if not text:
                continue
            if _looks_like_url(text):
                found.append(
                    {
                        "title": text,
                        "url": text,
                        "agent": default_agent,
                    }
                )
            else:
                found.append({"title": text, "agent": default_agent})
        elif isinstance(item, dict):
            url = item.get("url") or item.get("href") or item.get("link")
            title = (
                item.get("title")
                or item.get("name")
                or item.get("label")
                or (str(url) if url else None)
            )
            if not title:
                continue
            entry: dict = {"title": str(title)}
            agent = item.get("agent") or item.get("source") or default_agent
            if agent:
                entry["agent"] = str(agent)
            if url and _looks_like_url(str(url)):
                entry["url"] = str(url)
            detail = item.get("detail") or item.get("snippet") or item.get("description")
            if detail:
                entry["detail"] = str(detail)
            found.append(entry)

    citations: list[dict] = []
    for i, item in enumerate(found):
        entry = {
            "id": str(start_index + i),
            "title": item["title"],
        }
        if item.get("agent"):
            entry["agent"] = item["agent"]
        if item.get("url"):
            entry["url"] = item["url"]
        if item.get("detail"):
            entry["detail"] = item["detail"]
        citations.append(entry)
    return citations


def citations_from_tool(
    tool_name: str,
    tool_input: Any,
    tool_output: Any,
    *,
    start_index: int = 1,
) -> list[dict]:
    """Auto-extract ONLY when the tool output already carries citation structure.

    Does not invent sources for calculator/weather/etc. — the model should call
    `cite_sources` for those.
    """
    name = tool_name or "tool"
    if name in {"cite_sources", "write_todos", "task"}:
        return []

    out_text = _content_text(tool_output)
    out = _as_dict(tool_output) or _as_dict(out_text)
    agent = _agent_from_tool(name)

    raw_cites = out.get("citations") or out.get("sources") or out.get("references")
    if isinstance(raw_cites, list) and raw_cites:
        return normalize_citation_items(
            raw_cites, default_agent=agent, start_index=start_index
        )

    # cite_sources tool input path (handled separately, but safe here)
    if name == "cite_sources":
        inp = _as_dict(tool_input)
        items = inp.get("sources") or inp.get("citations") or []
        if isinstance(items, list):
            return normalize_citation_items(items, start_index=start_index)

    return []


def citations_from_cite_sources_input(tool_input: Any, *, start_index: int = 1) -> list[dict]:
    inp = _as_dict(tool_input)
    items = inp.get("sources") or inp.get("citations") or []
    if not isinstance(items, list):
        return []
    return normalize_citation_items(items, start_index=start_index)


def merge_citations(existing: list[dict], new_items: list[dict]) -> list[dict]:
    """Dedupe by url or (agent, title); renumber ids 1..n."""
    seen: set[str] = set()
    merged: list[dict] = []

    def key(c: dict) -> str:
        if c.get("url"):
            return f"url:{c['url']}"
        return f"{c.get('agent')}:{c.get('title')}"

    for c in list(existing) + list(new_items):
        k = key(c)
        if k in seen:
            continue
        seen.add(k)
        merged.append(dict(c))

    for i, c in enumerate(merged, start=1):
        c["id"] = str(i)
    return merged


class CiteSourceItem(BaseModel):
    title: str = Field(description="Short label for the source (page title, 'Calculator result', etc.)")
    url: Optional[str] = Field(
        default=None,
        description="Optional URL if this is a web source",
    )
    agent: Optional[str] = Field(
        default=None,
        description="Which agent/tool this came from (search, calculator, weather, …)",
    )
    detail: Optional[str] = Field(
        default=None,
        description="Optional short note (query, result snippet, timestamp, …)",
    )


class CiteSourcesInput(BaseModel):
    sources: list[CiteSourceItem] = Field(
        description=(
            "Sources that support your answer. Include web URLs when you have them, "
            "or non-web sources (calculator results, weather readings, etc.). "
            "You decide what is worth citing — tools often do not return a citations field."
        )
    )


@tool("cite_sources", args_schema=CiteSourcesInput)
def cite_sources(sources: list[CiteSourceItem]) -> str:
    """Record sources for the user-facing Sources panel.

    Call this when your answer relies on tool results or external facts.
    Most tools do NOT return a citations key — you must choose what to cite.
    Mix web URLs and non-web sources as needed (calculator, weather, datetime, …).
    """
    n = len(sources or [])
    return f"Recorded {n} source{'s' if n != 1 else ''} for the reply."
