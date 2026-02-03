"""
Simplified Agent Graph using MCP.
Orchestrates MCP tool calls and synthesis.
"""
from langgraph.graph import StateGraph, START, END
from .state import AgentState
from .router import router_node
from .synthesizer import synthesizer_node
from .mcp_client import get_mcp_client


async def mcp_executor_node(state: AgentState) -> dict:
    """
    Execute MCP tools based on active_agents list.
    Collects results from all activated tools.
    """
    active_agents = state.get("active_agents", [])
    mcp_client = get_mcp_client()
    
    if not active_agents:
        return {"agent_results": []}
    
    results = []
    
    for agent_name in active_agents:
        # Get the user's query
        last_message = state["messages"][-1]
        query = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        # Invoke the MCP tool
        result = await mcp_client.invoke_tool(
            server_id=agent_name,
            tool_name=agent_name,  # Tool name matches server name for now
            arguments={"query": query}
        )
        
        # Add agent identifier to result
        result["agent"] = agent_name
        results.append(result)
    
    return {"agent_results": results}


def route_after_router(state: AgentState) -> str:
    """
    Determine next step after router.
    If agents are active, go to executor. Otherwise, skip to synthesizer.
    """
    if state.get("active_agents"):
        return "executor"
    return "synthesizer"


def build_agent_graph():
    """
    Build and compile the simplified agent graph.
    
    Flow:
    START -> router -> [executor if agents] -> synthesizer -> END
    """
    graph = StateGraph(AgentState)
    
    # Add nodes
    graph.add_node("router", router_node)
    graph.add_node("executor", mcp_executor_node)
    graph.add_node("synthesizer", synthesizer_node)
    
    # Entry point
    graph.add_edge(START, "router")
    
    # Conditional routing after router
    graph.add_conditional_edges(
        "router",
        route_after_router,
        {
            "executor": "executor",
            "synthesizer": "synthesizer"
        }
    )
    
    # Executor always goes to synthesizer
    graph.add_edge("executor", "synthesizer")
    
    # Synthesizer ends the graph
    graph.add_edge("synthesizer", END)
    
    return graph.compile()


# Singleton graph instance
_agent_graph = None


def get_agent_graph():
    """Get or create the agent graph singleton."""
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = build_agent_graph()
    return _agent_graph
