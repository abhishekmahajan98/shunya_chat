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

from database import get_supabase

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


class MCPClient:
    """
    Client for interacting with MCP servers via HTTP.
    """
    
    def __init__(self):
        self.servers: dict[str, MCPServerConfig] = {}
        self.refresh_servers()
    
    def refresh_servers(self):
        """Fetch latest server configuration from database."""
        try:
            supabase = get_supabase()
            result = supabase.table("agents").select("*").execute()
            agents_data = result.data or []
            
            new_servers = {}
            for agent in agents_data:
                server = MCPServerConfig(
                    id=agent["id"],
                    name=agent["name"],
                    icon=agent["icon"],
                    description=agent["description"],
                    category=agent["category"],
                    url=agent["url"],
                    capabilities=agent.get("capabilities", []),
                    has_access=agent.get("has_access", True)
                )
                new_servers[server.id] = server
            
            self.servers = new_servers
        except Exception as e:
            print(f"Failed to refresh MCP servers: {e}")
            # Keep existing servers if refresh fails
    
    def get_all_agents(self) -> list[dict]:
        """
        Get all registered agents for the marketplace UI.
        Returns agent metadata including category.
        """
        self.refresh_servers()  # Ensure we have latest data
        agents = []
        for server in self.servers.values():
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
        # Always refresh to ensure we have the latest agent configs (especially new ones)
        self.refresh_servers()
        
        tools = []
        for server in self.servers.values():
            # If active_agent_ids is provided, only include those
            # This is CRITICAL for preventing context pollution
            if active_agent_ids is not None and server.id not in active_agent_ids:
                continue
            
            # Only include agents with access enabled
            if not server.has_access:
                continue

            tools.append({
                "name": server.id,
                "description": server.description,
                "capabilities": server.capabilities
            })
        return tools
    
    def get_server_by_id(self, server_id: str) -> MCPServerConfig | None:
        """Get a server by its ID."""
        # Check if we have it locally first, otherwise try to refresh
        if server_id not in self.servers:
            self.refresh_servers()
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
        server = self.get_server_by_id(server_id)
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



    async def get_langchain_tools(self, server_id: str):
        """
        Connect to an MCP server, list its tools, and wrap them as LangChain StructuredTools.
        This enables a ReAct agent to use them dynamically.
        """
        from langchain_core.tools import StructuredTool
        from pydantic import BaseModel, Field

        server = self.get_server_by_id(server_id)
        if not server:
            return []

        try:
            # We must connect to discover tools
            # Note: This is an expensive operation per-step. In production, we should cache tool definitions.
            transport = SSETransport(url=f"{server.url}/sse")
            
            # Use 'async with' to manage connection lifecycle for discovery
            async with Client(transport) as client:
                tools_list = await client.list_tools()
                
                langchain_tools = []
                
                if not tools_list:
                    return []

                for tool_def in tools_list:
                    # Capture closure variables for the wrapper
                    t_name = tool_def.name
                    t_desc = tool_def.description or f"Tool: {t_name}"

                    # Define the async wrapper function
                    # We use a closure factory to bind the name correctly
                    def make_wrapper(s_id, t_n):
                        async def _wrapper(query: str):
                            # Call the consolidated invoke_tool method
                            result = await self.invoke_tool(s_id, t_n, {"query": query})
                            if "error" in result:
                                return f"Error: {result['error']}"
                            return json.dumps(result)
                        return _wrapper

                    # Create the Pydantic input model
                    # Currently assuming single string input "query" for compatibility
                    class ToolInput(BaseModel):
                        query: str = Field(description="The input query or data for this tool")

                    langchain_tools.append(
                        StructuredTool.from_function(
                            coroutine=make_wrapper(server_id, t_name),
                            name=t_name,
                            description=t_desc,
                            args_schema=ToolInput
                        )
                    )
                return langchain_tools

        except Exception as e:
            print(f"Error fetching tools for {server_id}: {e}")
            return []


# Singleton instance
_mcp_client: MCPClient | None = None


def get_mcp_client() -> MCPClient:
    """Get or create the MCP client singleton."""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPClient()
    return _mcp_client
