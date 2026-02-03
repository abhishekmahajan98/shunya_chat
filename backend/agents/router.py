"""
Router/Supervisor Node.
Uses LLM to decide which MCP tools to activate based on user intent.
Only considers agents that user has explicitly activated.
"""
import json
import os
from google import genai
from dotenv import load_dotenv
from .state import AgentState, AGENT_REGISTRY
from .mcp_client import get_mcp_client

load_dotenv()

ROUTER_PROMPT = """You are a task router for a multi-agent system. Analyze the user's message and decide which tools to activate.

Available Tools (these are the only tools you can use):
{tool_descriptions}

Rules:
1. You can activate multiple tools if the task requires it
2. Choose "parallel" mode if tools are independent, "sequential" if one depends on another
3. If no special tools are needed, return an empty list (base LLM will handle it)
4. Only select tools that are clearly relevant to the user's request
5. You can ONLY select from the available tools listed above

Respond with ONLY valid JSON in this format:
{{"tools": ["tool1", "tool2"], "mode": "parallel" | "sequential"}}

User Message: {user_message}
"""


def _build_tool_descriptions(active_agent_ids: list[str] | None = None) -> str:
    """Build tool descriptions for the router prompt, filtered by active agents."""
    mcp_client = get_mcp_client()
    # Only get tools that user has activated
    tools = mcp_client.get_available_tools(active_agent_ids)
    
    if not tools:
        return "No tools available. The base LLM will handle this request."
    
    lines = []
    for tool in tools:
        lines.append(f"- {tool['name']}: {tool['description']}")
        lines.append(f"  Capabilities: {', '.join(tool['capabilities'])}")
    
    return "\n".join(lines)


async def router_node(state: AgentState) -> dict:
    """
    Use LLM to decide which MCP tools to activate.
    Only considers tools that user has activated.
    Returns the list of tools and execution mode.
    """
    last_message = state["messages"][-1]
    user_message = last_message.content if hasattr(last_message, 'content') else str(last_message)
    
    # Get user-activated agents from state (passed from frontend)
    user_active_agents = state.get("user_active_agents", None)
    
    # Build tool descriptions filtered by user's active agents
    tool_descriptions = _build_tool_descriptions(user_active_agents)
    
    # If no tools available (user hasn't activated any), skip routing
    if user_active_agents is not None and len(user_active_agents) == 0:
        return {
            "active_agents": [],
            "execution_mode": "sequential"
        }
    
    # Build the prompt
    prompt = ROUTER_PROMPT.format(
        tool_descriptions=tool_descriptions,
        user_message=user_message
    )
    
    try:
        # Use Gemini Flash for fast routing decisions
        api_key = os.getenv("GOOGLE_API_KEY")
        client = genai.Client(api_key=api_key)
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}]
        )
        
        # Parse JSON response
        response_text = response.text.strip()
        # Handle markdown code blocks
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        decision = json.loads(response_text)
        
        # Filter to only include agents that were actually activated by user
        requested_tools = decision.get("tools", decision.get("agents", []))
        if user_active_agents is not None:
            requested_tools = [t for t in requested_tools if t in user_active_agents]
        
        return {
            "active_agents": requested_tools,
            "execution_mode": decision.get("mode", "sequential")
        }
        
    except Exception as e:
        # Fallback: no tools, let base LLM handle it
        print(f"Router error: {e}")
        return {
            "active_agents": [],
            "execution_mode": "sequential"
        }
