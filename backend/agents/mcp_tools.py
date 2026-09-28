"""Load LangChain tools from mounted MCP agent servers (in-process FastMCP Client)."""

from __future__ import annotations

import json

from fastmcp import Client
from langchain_core.tools import StructuredTool
from pydantic import create_model

from agents.schema_utils import json_schema_to_fields
from mcp_servers import MCP_SERVERS

# list_tools is identical across requests — cache by module set
_MCP_TOOL_CACHE: dict[tuple[str, ...], list] = {}


async def load_mcp_tools(module_ids: list[str]) -> list:
    """Return LangChain tools for local FastMCP modules (keyed like MCP_SERVERS)."""
    key = tuple(a for a in module_ids if a in MCP_SERVERS)
    cached = _MCP_TOOL_CACHE.get(key)
    if cached is not None:
        return list(cached)

    tools: list = []
    for agent_id in key:
        mcp = MCP_SERVERS.get(agent_id)
        if mcp is None:
            continue

        async with Client(mcp) as client:
            listed = await client.list_tools()

        for tool_def in listed:
            raw_name = tool_def.name
            tool_name = f"{agent_id}__{raw_name}"
            description = (
                f"[{agent_id}] {tool_def.description or raw_name}"
            ).strip()
            schema = tool_def.inputSchema or {"type": "object", "properties": {}}
            fields = json_schema_to_fields(schema)
            args_model = create_model(f"{tool_name}_Args", **fields) if fields else create_model(
                f"{tool_name}_Args"
            )

            def _make_coroutine(server, t_name: str):
                async def _call(**kwargs):
                    cleaned = {
                        k: v for k, v in kwargs.items() if v is not None and v != ""
                    }
                    async with Client(server) as c:
                        result = await c.call_tool(t_name, cleaned)
                    if getattr(result, "is_error", False):
                        return json.dumps({"status": "error", "error": str(result)})
                    data = getattr(result, "data", None)
                    if data is not None:
                        return json.dumps(data, default=str)
                    content = getattr(result, "content", None) or []
                    texts = []
                    for block in content:
                        text = getattr(block, "text", None)
                        if text is not None:
                            texts.append(text)
                    return "\n".join(texts) if texts else json.dumps(result, default=str)

                return _call

            tools.append(
                StructuredTool.from_function(
                    coroutine=_make_coroutine(mcp, raw_name),
                    name=tool_name,
                    description=description,
                    args_schema=args_model,
                )
            )

    _MCP_TOOL_CACHE[key] = tools
    return list(tools)


async def load_tools_for_agents(
    agent_ids: list[str],
    user_id: str,
    *,
    skipped_remote: list[str] | None = None,
) -> list:
    """Load tools for selected agents (in-process if local_module, else HTTP mcp_url)."""
    from db.agents import get_agent
    from integrations.remote_tools import load_remote_mcp_tools
    from integrations.service import agent_ready_for_user

    local_modules: list[str] = []
    http_ids: list[str] = []

    for agent_id in agent_ids:
        agent = get_agent(agent_id)
        if not agent:
            continue
        ready, reason = agent_ready_for_user(user_id, agent)
        if not ready:
            if skipped_remote is not None:
                skipped_remote.append(agent_id if reason != "missing_env" else f"{agent_id}(env)")
            continue
        if agent.is_in_process:
            local_modules.append(agent.module_key)
        else:
            http_ids.append(agent.id)

    tools = await load_mcp_tools(local_modules)
    if http_ids:
        tools.extend(
            await load_remote_mcp_tools(
                http_ids, user_id, skipped=skipped_remote
            )
        )
    return tools
