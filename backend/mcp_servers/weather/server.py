"""
Weather MCP Server.
Mounted at /mcp/weather
"""
from __future__ import annotations

import urllib.parse
import urllib.request

from fastmcp import FastMCP

mcp = FastMCP("weather")


@mcp.tool()
def get_weather(city: str) -> str:
    """Return the current weather for a city.

    Args:
        city: City name, e.g. 'San Francisco' or 'London'
    """
    url = f"https://wttr.in/{urllib.parse.quote(city)}?format=3"
    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            return response.read().decode().strip()
    except Exception as exc:
        return f"Error: {exc}"


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=8003)
