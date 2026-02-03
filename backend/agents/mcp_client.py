"""
MCP Client for Shunya Chat.
Connects to MCP servers via HTTP SSE, discovers tools, and invokes them.
"""
import os
import json
from typing import Any
from dataclasses import dataclass, field
from fastmcp import Client
from fastmcp.client.transports import SSETransport
from dotenv import load_dotenv

load_dotenv()

# Get the backend directory for absolute paths
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@dataclass
class MCPServerConfig:
    """Configuration for an MCP server."""
    id: str
    name: str
    icon: str
    description: str
    category: str  # research | compliance | finance | automation
    url: str  # HTTP endpoint e.g., "http://localhost:8001"
    capabilities: list[str] = field(default_factory=list)
    has_access: bool = True


# Registry of available MCP servers
MCP_SERVERS: list[MCPServerConfig] = [
    MCPServerConfig(
        id="search",
        name="Quick Search",
        icon="search",
        description="Fast web lookup for instant answers using Perplexity",
        category="research",
        url="http://localhost:8001",
        capabilities=["search", "web", "lookup", "find", "research"],
        has_access=True
    ),
]


class MCPClient:
    """
    Client for interacting with MCP servers via HTTP.
    """
    
    def __init__(self):
        self.servers = {s.id: s for s in MCP_SERVERS}
    
    def get_all_agents(self) -> list[dict]:
        """
        Get all registered agents for the marketplace UI.
        Returns agent metadata including category.
        """
        agents = []
        for server in MCP_SERVERS:
            agents.append({
                "id": server.id,
                "name": server.name,
                "icon": server.icon,
                "description": server.description,
                "category": server.category,
                "url": server.url,
                "hasAccess": server.has_access,
            })
        return agents
    
    def get_available_tools(self, active_agent_ids: list[str] | None = None) -> list[dict]:
        """
        Get list of available tools, optionally filtered by active agents.
        """
        tools = []
        for server in MCP_SERVERS:
            # If active_agent_ids is provided, only include those
            if active_agent_ids is not None and server.id not in active_agent_ids:
                continue
            tools.append({
                "name": server.id,
                "description": server.description,
                "capabilities": server.capabilities
            })
        return tools
    
    def get_server_by_id(self, server_id: str) -> MCPServerConfig | None:
        """Get a server by its ID."""
        return self.servers.get(server_id)
    
    async def invoke_tool(self, server_id: str, tool_name: str, arguments: dict[str, Any]) -> dict:
        """
        Invoke a tool on an MCP server via HTTP.
        
        Args:
            server_id: ID of the MCP server
            tool_name: Name of the tool to invoke
            arguments: Arguments to pass to the tool
            
        Returns:
            Tool result as a dict
        """
        server = self.servers.get(server_id)
        if not server:
            return {"status": "error", "error": f"Unknown server: {server_id}"}
        
        try:
            # Use SSE transport to connect to the MCP server
            transport = SSETransport(url=f"{server.url}/sse")
            
            async with Client(transport) as client:
                result = await client.call_tool(tool_name, arguments)
                
                # FastMCP returns a CallToolResult object with a 'content' attribute
                if result is not None:
                    if hasattr(result, 'content') and result.content:
                        content_list = result.content
                        if len(content_list) > 0:
                            content = content_list[0]
                            if hasattr(content, 'text'):
                                try:
                                    return json.loads(content.text)
                                except json.JSONDecodeError:
                                    return {"status": "success", "answer": content.text, "citations": []}
                            return {"status": "success", "result": str(content)}
                    
                return {"status": "error", "error": "Empty response from tool"}
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"status": "error", "error": str(e)}


# Singleton instance
_mcp_client: MCPClient | None = None


def get_mcp_client() -> MCPClient:
    """Get or create the MCP client singleton."""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPClient()
    return _mcp_client
