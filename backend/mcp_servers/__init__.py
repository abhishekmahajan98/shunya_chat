"""Local FastMCP server instances (implementations). Catalog/auth live in DB agents."""

from mcp_servers.calculator.server import mcp as calculator_mcp
from mcp_servers.datetime_agent.server import mcp as datetime_mcp
from mcp_servers.search.server import mcp as search_mcp
from mcp_servers.weather.server import mcp as weather_mcp

# agent local_module / id -> FastMCP instance
MCP_SERVERS = {
    "search": search_mcp,
    "calculator": calculator_mcp,
    "weather": weather_mcp,
    "datetime": datetime_mcp,
}
