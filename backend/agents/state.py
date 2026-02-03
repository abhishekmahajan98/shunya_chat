"""
Shared state schema for the LangGraph agent system.
"""
from typing import TypedDict, Literal, Optional, Annotated
from langgraph.graph import MessagesState
from operator import add


class AgentState(MessagesState):
    """Extended state for multi-agent orchestration."""
    
    # Core conversation context
    conversation_id: str
    current_model: str
    
    # Agent orchestration
    active_agents: list[str]  # ["search", "data", "email"]
    execution_mode: Literal["sequential", "parallel", "single"]
    
    # Agent results (accumulated using reducer)
    agent_results: Annotated[list[dict], add]
    
    # Final synthesized response
    final_response: Optional[str]


# Agent registry - maps agent names to their descriptions
AGENT_REGISTRY = {
    "search": {
        "name": "Web Search",
        "description": "Search the internet for current information using Perplexity",
        "triggers": ["search", "find", "look up", "what is", "who is", "current", "latest", "news"]
    },
    "data": {
        "name": "Data Query",
        "description": "Query internal database for sample product/customer data",
        "triggers": ["data", "database", "products", "customers", "sales", "inventory", "records"]
    },
    "email": {
        "name": "Email Sender",
        "description": "Send the results via email (mock - doesn't actually send)",
        "triggers": ["email", "send", "mail", "notify"]
    }
}
