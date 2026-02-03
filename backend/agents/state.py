"""
Shared state schema for the agent system.
Now uses MCP-based tool registry.
"""
from typing import TypedDict, Literal, Optional, Annotated
from langgraph.graph import MessagesState
from operator import add


class AgentState(MessagesState):
    """Extended state for multi-agent orchestration."""
    
    # Core conversation context
    conversation_id: str
    current_model: str
    
    # User-activated agents (from frontend toggle)
    user_active_agents: Optional[list[str]]  # Agents user has enabled in UI
    
    # Agent orchestration
    active_agents: list[str]  # [\"search\", \"data\", etc.] - decided by router
    execution_mode: Literal["sequential", "parallel", "single"]
    
    # Agent results (accumulated using reducer)
    agent_results: Annotated[list[dict], add]
    
    # Final synthesized response
    final_response: Optional[str]


# MCP Tool Registry - maps tool names to their descriptions (for routing)
# This is now dynamically populated from MCP servers
AGENT_REGISTRY = {
    "search": {
        "name": "Web Search",
        "description": "Search the internet for current information using Perplexity",
        "triggers": ["search", "find", "look up", "what is", "who is", "current", "latest", "news", "research"]
    },
}
