"""
Router/Supervisor Node.
Uses LLM to decide which agents to activate based on user intent.
"""
import json
import os
from google import genai
from dotenv import load_dotenv
from .state import AgentState, AGENT_REGISTRY

load_dotenv()

ROUTER_PROMPT = """You are a task router for a multi-agent system. Analyze the user's message and decide which agents to activate.

Available Agents:
{agent_descriptions}

Rules:
1. You can activate multiple agents if the task requires it
2. Choose "parallel" mode if agents are independent, "sequential" if one depends on another
3. If no special agents are needed, return an empty list (base LLM will handle it)
4. The "email" agent should typically come last if selected

Respond with ONLY valid JSON in this format:
{{"agents": ["agent1", "agent2"], "mode": "parallel" | "sequential"}}

User Message: {user_message}
"""


def _build_agent_descriptions() -> str:
    """Build agent descriptions for the router prompt."""
    lines = []
    for agent_id, info in AGENT_REGISTRY.items():
        lines.append(f"- {agent_id}: {info['description']}")
        lines.append(f"  Triggers: {', '.join(info['triggers'])}")
    return "\n".join(lines)


async def router_node(state: AgentState) -> dict:
    """
    Use LLM to decide which agents to activate.
    Returns the list of agents and execution mode.
    """
    last_message = state["messages"][-1]
    user_message = last_message.content if hasattr(last_message, 'content') else str(last_message)
    
    # Build the prompt
    prompt = ROUTER_PROMPT.format(
        agent_descriptions=_build_agent_descriptions(),
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
        
        return {
            "active_agents": decision.get("agents", []),
            "execution_mode": decision.get("mode", "sequential")
        }
        
    except Exception as e:
        # Fallback: no agents, let base LLM handle it
        print(f"Router error: {e}")
        return {
            "active_agents": [],
            "execution_mode": "sequential"
        }
