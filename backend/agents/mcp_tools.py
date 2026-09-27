"""Load LangChain tools from mounted MCP agent servers (in-process FastMCP Client)."""

from __future__ import annotations

import json
from typing import Any

from fastmcp import Client
from langchain_core.tools import StructuredTool
from pydantic import Field, create_model

from mcp_servers import MCP_SERVERS

# list_tools is identical across requests — cache by agent set
_MCP_TOOL_CACHE: dict[tuple[str, ...], list] = {}


def _json_schema_to_fields(schema: dict[str, Any]) -> dict[str, Any]:
    props = (schema or {}).get("properties") or {}
    required = set((schema or {}).get("required") or [])
    fields: dict[str, Any] = {}
    type_map = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list,
        "object": dict,
    }
    for name, prop in props.items():
        py_type = type_map.get(prop.get("type"), Any)
        default = ... if name in required else None
        fields[name] = (
            py_type | None if default is None and py_type is not Any else py_type,
            Field(default=default, description=prop.get("description") or name),
        )
    return fields


async def load_mcp_tools(agent_ids: list[str]) -> list:
    """Return LangChain tools for the selected MCP agents."""
    key = tuple(a for a in agent_ids if a in MCP_SERVERS)
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
            # Prefix with agent id so multiple agents never collide
            tool_name = f"{agent_id}__{raw_name}"
            description = (
                f"[{agent_id}] {tool_def.description or raw_name}"
            ).strip()
            schema = tool_def.inputSchema or {"type": "object", "properties": {}}
            fields = _json_schema_to_fields(schema)
            args_model = create_model(f"{tool_name}_Args", **fields) if fields else create_model(
                f"{tool_name}_Args"
            )

            def _make_coroutine(server, t_name: str):
                async def _call(**kwargs):
                    async with Client(server) as c:
                        result = await c.call_tool(t_name, kwargs)
                    if getattr(result, "is_error", False):
                        return json.dumps({"status": "error", "error": str(result)})
                    # Prefer structured / data when present
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
