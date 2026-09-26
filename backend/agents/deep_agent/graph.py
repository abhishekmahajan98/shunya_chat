"""Deep agent — DeepAgents create_deep_agent harness (LangChain underneath)."""

from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

from agents.deep_agent.tools import TOOLS
from agents.model import Context, configurable_model, dynamic_system_prompt

_SYSTEM_PROMPT = """You are a helpful AI assistant."""


def build_deep_agent(checkpointer: MemorySaver | None = None):
    return create_deep_agent(
        model="anthropic:claude-sonnet-4-5-20250929",
        tools=TOOLS,
        system_prompt=_SYSTEM_PROMPT,
        context_schema=Context,
        middleware=[configurable_model, dynamic_system_prompt],
        name="deep_agent",
        checkpointer=checkpointer,
    )
