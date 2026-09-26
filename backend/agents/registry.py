"""Lazy graph registry shared across requests."""

from __future__ import annotations

from functools import lru_cache

from langgraph.checkpoint.memory import MemorySaver

from agents.basic_agent import build_basic_agent
from agents.deep_agent import build_deep_agent

GRAPH_IDS = ("basic_agent", "deep_agent")

_checkpointer = MemorySaver()


@lru_cache(maxsize=1)
def _graphs():
    return {
        "basic_agent": build_basic_agent(_checkpointer),
        "deep_agent": build_deep_agent(_checkpointer),
    }


def get_graph(graph_id: str):
    graphs = _graphs()
    if graph_id not in graphs:
        raise KeyError(f"Unknown graph_id: {graph_id}")
    return graphs[graph_id]
