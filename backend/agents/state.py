"""
Shared state schema for the agent system.
Now uses MCP-based tool registry.
"""
from typing import TypedDict, Literal, Optional, Annotated
from langgraph.graph import MessagesState
from operator import add



class AgentGoal(TypedDict):
    """A goal for a specific agent."""
    id: str     # Unique ID for this step (e.g. 'step-1')
    agent: str  # The ID of the agent (e.g., 'search', 'finance')
    goal: str   # The high-level instruction for the worker agent

class AgentState(MessagesState):
    """Extended state for multi-agent orchestration."""
    
    # Core conversation context
    conversation_id: str
    current_model: str
    
    # User-activated agents (from frontend toggle)
    user_active_agents: Optional[list[str]]  # Agents user has enabled in UI
    
    # Agent orchestration - now a list of goals
    active_agents: list[AgentGoal]  # [{"agent": "search", "goal": "Find price"}, ...]
    execution_mode: Literal["sequential", "parallel", "single"]
    
    # Agent results (accumulated using reducer)
    agent_results: Annotated[list[dict], add]
    
    # Final synthesized response
    final_response: Optional[str]
    
    # Synthesis control
    needs_synthesis: bool
    synthesis_prompt: str


# MCP Tool Registry - maps tool names to their descriptions (for routing)
# This is now dynamically populated from MCP servers via MCPClient
AGENT_REGISTRY = {}
