"""
LangGraph Agent Graph Construction.
Builds the multi-agent orchestration graph.
"""
from langgraph.graph import StateGraph, START, END
from .state import AgentState
from .router import router_node
from .synthesizer import synthesizer_node
from .nodes import search_node, data_node, email_node


def route_to_agents(state: AgentState) -> list[str]:
    """
    Conditional edge function: determine next nodes based on active_agents.
    Returns list of node names to execute.
    """
    active_agents = state.get("active_agents", [])
    
    if not active_agents:
        # No agents needed, go directly to synthesizer (which will return None)
        return ["synthesizer"]
    
    # Map agent IDs to node names
    return active_agents


def build_agent_graph():
    """
    Build and compile the agent graph.
    
    Flow:
    START -> router -> [agents in parallel/sequential] -> synthesizer -> END
    """
    graph = StateGraph(AgentState)
    
    # Add all nodes
    graph.add_node("router", router_node)
    graph.add_node("search", search_node)
    graph.add_node("data", data_node)
    graph.add_node("email", email_node)
    graph.add_node("synthesizer", synthesizer_node)
    
    # Entry point: always start with router
    graph.add_edge(START, "router")
    
    # Conditional routing from router to agents
    # Using send() for parallel execution when needed
    graph.add_conditional_edges(
        "router",
        route_to_agents,
        {
            "search": "search",
            "data": "data", 
            "email": "email",
            "synthesizer": "synthesizer"
        }
    )
    
    # All agents converge to synthesizer
    graph.add_edge("search", "synthesizer")
    graph.add_edge("data", "synthesizer")
    graph.add_edge("email", "synthesizer")
    
    # Synthesizer ends the graph
    graph.add_edge("synthesizer", END)
    
    # Compile without checkpointer for now (can add later)
    return graph.compile()


# Create a singleton graph instance
_agent_graph = None


def get_agent_graph():
    """Get or create the agent graph singleton."""
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = build_agent_graph()
    return _agent_graph
