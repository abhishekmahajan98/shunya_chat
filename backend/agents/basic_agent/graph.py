"""Basic ReAct agent — LangChain create_agent harness."""

from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver

from agents.basic_agent.tools import TOOLS
from agents.model import Context, configurable_model, dynamic_system_prompt

_SYSTEM_PROMPT = """You are a helpful AI assistant."""


def build_basic_agent(checkpointer: MemorySaver | None = None):
    return create_agent(
        model="anthropic:claude-sonnet-4-5-20250929",
        tools=TOOLS,
        system_prompt=_SYSTEM_PROMPT,
        context_schema=Context,
        middleware=[configurable_model, dynamic_system_prompt],
        name="basic_agent",
        checkpointer=checkpointer,
    )
