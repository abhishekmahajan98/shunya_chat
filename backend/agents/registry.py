"""Lazy graph registry shared across requests."""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Optional, Sequence

from langgraph.checkpoint.memory import MemorySaver

from agents.basic_agent import build_basic_agent
from agents.deep_agent import build_deep_agent

GRAPH_IDS = ("basic_agent", "deep_agent")

_checkpointer = MemorySaver()
_deep_graph_cache: dict[tuple, Any] = {}


@lru_cache(maxsize=1)
def _basic_graph():
    return build_basic_agent(_checkpointer)


def get_graph(
    graph_id: str,
    tools: Optional[list] = None,
    skills: Optional[Sequence[str]] = None,
):
    if graph_id == "basic_agent":
        return _basic_graph()
    if graph_id == "deep_agent":
        tool_names = tuple(
            sorted(getattr(t, "name", "") or "" for t in (tools or []))
        )
        skill_key = tuple(skills or ())
        cache_key = (tool_names, skill_key)
        cached = _deep_graph_cache.get(cache_key)
        if cached is not None:
            return cached
        graph = build_deep_agent(
            _checkpointer,
            tools=tools,
            skills=skills,
        )
        _deep_graph_cache[cache_key] = graph
        return graph
    raise KeyError(f"Unknown graph_id: {graph_id}")
