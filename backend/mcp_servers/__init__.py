"""MCP sample agents mounted at /mcp/{agent_id}."""

from mcp_servers.calculator.server import mcp as calculator_mcp
from mcp_servers.datetime_agent.server import mcp as datetime_mcp
from mcp_servers.search.server import mcp as search_mcp
from mcp_servers.weather.server import mcp as weather_mcp

# agent_id -> FastMCP instance (same ids as UI /active_agents)
MCP_SERVERS = {
    "search": search_mcp,
    "calculator": calculator_mcp,
    "weather": weather_mcp,
    "datetime": datetime_mcp,
}

AGENT_CATALOG = [
    {
        "id": "search",
        "name": "Perplexity",
        "description": "Web search via Perplexity (docs & current info)",
    },
    {
        "id": "calculator",
        "name": "Calculator",
        "description": "Math and expression evaluation",
    },
    {
        "id": "weather",
        "name": "Weather",
        "description": "Current weather for a city",
    },
    {
        "id": "datetime",
        "name": "Date & Time",
        "description": "Current date/time and simple conversions",
    },
]

# Optional skill dir per agent: backend/skills/{id}/SKILL.md
# Loaded automatically when that agent is selected (see agents/skills_loader.py).
