"""Load LangChain tools from remote OAuth MCP servers (Streamable HTTP + Bearer)."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from fastmcp import Client
from langchain_core.tools import StructuredTool
from pydantic import create_model

from agents.schema_utils import json_schema_to_fields
from db.agents import get_agent
from integrations.service import get_access_token, is_connected

logger = logging.getLogger("uvicorn.error")

# Per remote MCP call (session open + tool). Prevents indefinite UI hangs.
_REMOTE_MCP_TIMEOUT_S = 45.0

# Cache tool *schemas* by agent id (not callables — tokens are per-user)
_SCHEMA_CACHE: dict[str, list[dict[str, Any]]] = {}


def _result_to_text(result: Any) -> str:
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


async def _list_tool_defs(
    mcp_url: str, access_token: Optional[str] = None
) -> list[dict[str, Any]]:
    kwargs: dict[str, Any] = {"timeout": _REMOTE_MCP_TIMEOUT_S}
    if access_token:
        kwargs["auth"] = access_token
    async with Client(mcp_url, **kwargs) as client:
        listed = await asyncio.wait_for(
            client.list_tools(), timeout=_REMOTE_MCP_TIMEOUT_S
        )
    out: list[dict[str, Any]] = []
    for tool_def in listed:
        out.append(
            {
                "name": tool_def.name,
                "description": tool_def.description or tool_def.name,
                "inputSchema": tool_def.inputSchema
                or {"type": "object", "properties": {}},
            }
        )
    return out


def _clean_mcp_args(arguments: dict[str, Any]) -> dict[str, Any]:
    """Omit null/empty optionals — many remote MCP servers reject explicit nulls."""
    out: dict[str, Any] = {}
    for key, value in (arguments or {}).items():
        if value is None:
            continue
        if value == "":
            continue
        out[key] = value
    return out


async def _call_remote_tool(
    *,
    mcp_url: str,
    access_token: Optional[str],
    tool_name: str,
    arguments: dict[str, Any],
) -> Any:
    cleaned = _clean_mcp_args(arguments)
    kwargs: dict[str, Any] = {"timeout": _REMOTE_MCP_TIMEOUT_S}
    if access_token:
        kwargs["auth"] = access_token
    async with Client(mcp_url, **kwargs) as c:
        return await asyncio.wait_for(
            c.call_tool(tool_name, cleaned),
            timeout=_REMOTE_MCP_TIMEOUT_S,
        )


async def load_remote_mcp_tools(
    agent_ids: list[str],
    user_id: str,
    *,
    skipped: Optional[list[str]] = None,
) -> list:
    """Return LangChain tools for selected remote HTTP MCP agents."""
    tools: list = []

    for agent_id in agent_ids:
        agent = get_agent(agent_id)
        if not agent or agent.is_in_process or not agent.mcp_url:
            continue

        token: Optional[str] = None
        if agent.needs_user_credential:
            if not is_connected(user_id, agent_id):
                if skipped is not None:
                    skipped.append(agent_id)
                logger.info("Skipping MCP %s — not connected for user", agent_id)
                continue
            token = await get_access_token(user_id, agent_id)
            if not token:
                if skipped is not None:
                    skipped.append(agent_id)
                continue

        try:
            defs = _SCHEMA_CACHE.get(agent_id)
            if defs is None:
                defs = await _list_tool_defs(agent.mcp_url, token)
                _SCHEMA_CACHE[agent_id] = defs
        except Exception:
            logger.exception("Failed to list tools for remote MCP %s", agent_id)
            _SCHEMA_CACHE.pop(agent_id, None)
            if skipped is not None:
                skipped.append(agent_id)
            continue

        for tool_def in defs:
            raw_name = tool_def["name"]
            tool_name = f"{agent_id}__{raw_name}"
            description = f"[{agent_id}] {tool_def['description']}".strip()
            schema = tool_def["inputSchema"]
            fields = json_schema_to_fields(schema)
            args_model = (
                create_model(f"{tool_name}_Args", **fields)
                if fields
                else create_model(f"{tool_name}_Args")
            )

            def _make_coroutine(
                pid: str,
                mcp_url: str,
                t_name: str,
                uid: str,
                needs_auth: bool,
            ):
                async def _call(**kwargs):
                    access: Optional[str] = None
                    if needs_auth:
                        access = await get_access_token(uid, pid)
                        if not access:
                            return json.dumps(
                                {
                                    "status": "error",
                                    "error": f"{pid} is not connected. Connect it in Agents.",
                                }
                            )
                    try:
                        logger.info("remote_mcp call %s__%s", pid, t_name)
                        result = await _call_remote_tool(
                            mcp_url=mcp_url,
                            access_token=access,
                            tool_name=t_name,
                            arguments=kwargs,
                        )
                        logger.info("remote_mcp done %s__%s", pid, t_name)
                        return _result_to_text(result)
                    except asyncio.TimeoutError:
                        logger.warning(
                            "remote_mcp timeout %s__%s after %.0fs",
                            pid,
                            t_name,
                            _REMOTE_MCP_TIMEOUT_S,
                        )
                        return json.dumps(
                            {
                                "status": "error",
                                "error": (
                                    f"{pid}__{t_name} timed out after "
                                    f"{int(_REMOTE_MCP_TIMEOUT_S)}s. Try a narrower query."
                                ),
                            }
                        )
                    except Exception as exc:
                        msg = str(exc).lower()
                        if "401" in msg or "unauthorized" in msg:
                            _SCHEMA_CACHE.pop(pid, None)
                        logger.warning("remote_mcp error %s__%s: %s", pid, t_name, exc)
                        hint = ""
                        if "received null" in msg or "expected string" in msg:
                            hint = (
                                " Hint: omit unused optional parameters entirely — "
                                "do not pass null or empty strings."
                            )
                        return json.dumps(
                            {
                                "status": "error",
                                "error": str(exc) + hint,
                            }
                        )

                return _call

            tools.append(
                StructuredTool.from_function(
                    coroutine=_make_coroutine(
                        agent_id,
                        agent.mcp_url,
                        raw_name,
                        user_id,
                        agent.needs_user_credential,
                    ),
                    name=tool_name,
                    description=description,
                    args_schema=args_model,
                )
            )

    return tools


def clear_remote_schema_cache(agent_id: str | None = None) -> None:
    if agent_id:
        _SCHEMA_CACHE.pop(agent_id, None)
    else:
        _SCHEMA_CACHE.clear()
