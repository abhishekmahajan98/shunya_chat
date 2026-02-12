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
from database import get_supabase

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
    system_prompt: str = ""
    has_access: bool = True
    is_internal: bool = True


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
                    system_prompt=agent.get("system_prompt", ""),
                    has_access=agent.get("has_access", True),
                    is_internal=agent.get("is_internal", True)
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
                "systemPrompt": server.system_prompt,
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
                    final_result = {"status": "success", "results": []}
                    
                    # Handle metadata if present (e.g. _meta.ui for interactive apps)
                    # Safe check for common metadata patterns in MCP
                    msg_meta = getattr(result, "_meta", None) or getattr(result, "meta", None)
                    if msg_meta:
                        final_result["_meta"] = msg_meta

                    if hasattr(result, 'content') and result.content:
                        for content in result.content:
                            if hasattr(content, 'type') and content.type == "text" or hasattr(content, 'text'):
                                text_val = getattr(content, 'text', "")
                                try:
                                    parsed = json.loads(text_val)
                                    final_result["results"].append(parsed)
                                except (json.JSONDecodeError, TypeError):
                                    final_result["results"].append(text_val)
                            elif hasattr(content, 'type') and content.type == "image" or hasattr(content, 'data'):
                                # Handle binary/image data as best we can for text-based context
                                data_val = getattr(content, 'data', "")
                                final_result["results"].append({
                                    "type": "binary_data",
                                    "format": getattr(content, 'mime_type', 'unknown'),
                                    "label": "Asset Data (truncated)",
                                    "preview": str(data_val)[:100] + "..." if data_val else ""
                                })
                            else:
                                final_result["results"].append(str(content))
                        
                        # Backward compatibility: if only one result, provide it directly at top level
                        # to avoid breaking simple downstream synthesis that expects 'answer' or dict
                        if len(final_result["results"]) == 1:
                            item = final_result["results"][0]
                            if isinstance(item, dict):
                                # Merge into final_result
                                for k, v in item.items():
                                    if k not in final_result:
                                        final_result[k] = v
                            else:
                                final_result["answer"] = item
                        
                        return final_result
                    
                return {"status": "error", "error": "No content returned from tool"}
                
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
                    t_schema = tool_def.inputSchema

                    # Define the async wrapper function
                    # We use a closure factory to bind the name correctly
                    def make_wrapper(s_id, t_n):
                        async def _wrapper(callbacks=None, **kwargs):
                            # Call the consolidated invoke_tool method
                            # Removed hardcoded {"query": query}
                            result = await self.invoke_tool(s_id, t_n, kwargs)
                            
                            # Check for errors in result
                            if "error" in result:
                                error_msg = result['error']
                                
                                # Manually trigger on_tool_error
                                if callbacks:
                                    try:
                                        from backend.agents.callbacks import AgentCallbackHandler
                                        for callback in callbacks:
                                            if isinstance(callback, AgentCallbackHandler):
                                                await callback.manual_tool_error(t_n, Exception(error_msg))
                                                break
                                    except Exception:
                                         pass
                                
                                # Short delay to ensure event is emitted
                                import asyncio
                                await asyncio.sleep(0.05)
                                
                                # Crash the request/step by raising exception
                                raise Exception(f"Tool execution failed: {error_msg}")

                            # Success case: Manually trigger on_tool_end
                            if callbacks:
                                try:
                                    # Local import to avoid any potential circular dependency issues during module load
                                    from backend.agents.callbacks import AgentCallbackHandler
                                    for callback in callbacks:
                                        if isinstance(callback, AgentCallbackHandler):
                                            await callback.manual_tool_end(t_n, result)
                                            break
                                        # Fallback for generic handlers
                                        elif hasattr(callback, "on_tool_end"):
                                            # We generally skip generic handlers here to avoid duplication if they ARE working
                                            pass
                                except Exception:
                                    pass
                            
                            return json.dumps(result)
                        return _wrapper

                    # Dynamically create the Pydantic input model from JSON Schema
                    from pydantic import create_model, Field
                    from typing import Optional, Any, List, Dict
                    
                    properties = t_schema.get("properties", {})
                    required = t_schema.get("required", [])
                    
                    fields = {}
                    for prop_name, prop_info in properties.items():
                        prop_type = prop_info.get("type", "string")
                        prop_desc = prop_info.get("description", "")
                        
                        # Map JSON schema types to Python types
                        type_map = {
                            "string": str,
                            "number": float,
                            "integer": int,
                            "boolean": bool,
                            "array": list,
                            "object": dict
                        }
                        python_type = type_map.get(prop_type, Any)
                        
                        # If not required, wrap in Optional
                        if prop_name not in required:
                            python_type = Optional[python_type]
                            default = None
                        else:
                            default = ... 
                            
                        fields[prop_name] = (python_type, Field(default=default, description=prop_desc))
                    
                    # Create the model class
                    ToolInputModel = create_model(f"{t_name}Input", **fields)

                    langchain_tools.append(
                        StructuredTool.from_function(
                            coroutine=make_wrapper(server_id, t_name),
                            name=t_name,
                            description=t_desc,
                            args_schema=ToolInputModel
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
