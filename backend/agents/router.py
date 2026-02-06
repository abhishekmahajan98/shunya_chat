"""
Router/Supervisor Node.
Uses LLM to decide which MCP tools to activate and assigns high-level goals.
Acts as a Supervisor that delegates tasks to worker agents.
"""
import json
import os
from .state import AgentState, AgentGoal
from .mcp_client import get_mcp_client
from config import settings, AgentModels

SUPERVISOR_PROMPT = """You are a Supervisor for a multi-agent system.
Your job is to break down the user's request into high-level tasks for your available Agents.

Available Agents:
{tool_descriptions}

Rules:
1. DELEGATE: Assign tasks to agents that are best suited for them.
2. BE SPECIFIC: Give each agent a clear, high-level goal (e.g., "Search for Tesla's latest stock price" or "Plot the data provided").
3. DEPENDENCIES: If tasks depend on each other (e.g., Search before Plot), order them logically.
4. If NO special agents are valid/needed, return an empty list.
5. ONLY select from the Available Agents listed above.

Respond with ONLY valid JSON in this format:
{{
  "plan": [
    {{"agent": "agent_name", "goal": "clear instruction"}},
    {{"agent": "another_agent", "goal": "another instruction"}}
  ],
  "mode": "sequential"
}}

User Message: {user_message}
"""


def _build_tool_descriptions(active_agent_ids: list[str] | None = None) -> str:
    """Build tool descriptions for the router prompt, filtered by active agents."""
    mcp_client = get_mcp_client()
    # Only get tools that user has activated
    tools = mcp_client.get_available_tools(active_agent_ids)
    
    if not tools:
        return "No agents available. The base LLM will handle this request."
    
    lines = []
    for tool in tools:
        lines.append(f"- ID: {tool['name']}")
        lines.append(f"  Description: {tool['description']}")
        lines.append(f"  Capabilities: {', '.join(tool['capabilities'])}")
        lines.append("")
    
    return "\n".join(lines)


def _format_history(messages: list) -> str:
    """Format message history into a string for the prompt."""
    formatted = []
    for msg in messages:
        # Check if it's a LangChain message or dict
        role = "User" if (hasattr(msg, 'type') and msg.type == "human") else "Assistant"
        content = msg.content if hasattr(msg, 'content') else str(msg)
        formatted.append(f"{role}: {content}")
    return "\n".join(formatted)


async def supervisor_node(state: AgentState) -> dict:
    """
    Supervisor Node (formerly Router).
    Decides which agents to use and gives them specific goals.
    """
    # Use full history to resolve context
    chat_history = _format_history(state["messages"])
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
    
    # Build the prompt with history
    prompt = SUPERVISOR_PROMPT.format(
        tool_descriptions=tool_descriptions,
        user_message=user_message
    )
    
    # Prepend history to prompt to give context
    full_prompt = f"Chat History:\n{chat_history}\n\n{prompt}"
    
    try:
        if AgentModels.SUPERVISOR_PROVIDER == "google":
            from google import genai
            api_key = settings.GOOGLE_API_KEY
            client = genai.Client(api_key=api_key)
            
            response = client.models.generate_content(
                model=AgentModels.SUPERVISOR_MODEL,
                contents=[{"role": "user", "parts": [{"text": full_prompt}]}]
            )
            raw_content = response.text
        elif AgentModels.SUPERVISOR_PROVIDER == "anthropic":
            import anthropic
            api_key = settings.ANTHROPIC_API_KEY
            client = anthropic.Anthropic(api_key=api_key)
            
            response = client.messages.create(
                model=AgentModels.SUPERVISOR_MODEL,
                max_tokens=4096,
                messages=[{"role": "user", "content": full_prompt}]
            )
            raw_content = response.content[0].text
        else:
            raise ValueError(f"Unsupported supervisor provider: {AgentModels.SUPERVISOR_PROVIDER}")
        
        # Clean up Markdown formatting if present
        json_str = raw_content.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()
        
        plan_data = json.loads(json_str)
        
        plan = plan_data.get("plan", [])
        
        # Filter: Ensure we only use agents the user actually activated
        # This prevents the LLM from hallucinating agents or bypassing user settings
        valid_plan = []
        if user_active_agents is not None:
             for step in plan:
                 if step["agent"] in user_active_agents:
                     valid_plan.append(step)
        else:
            valid_plan = plan

        return {
            "active_agents": valid_plan,
            "execution_mode": plan_data.get("mode", "sequential")
        }
        
    except Exception as e:
        # Fallback: no tools, let base LLM handle it
        print(f"Supervisor error: {e}")
        return {
            "active_agents": [],
            "execution_mode": "sequential"
        }
