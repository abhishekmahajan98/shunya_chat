"""Run a LangChain / DeepAgents graph and stream UI-friendly SSE events."""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any, AsyncIterator, Optional

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from agents.model import Context
from agents.registry import get_graph
from config import settings
from db import get_store
from services.citations import (
    citations_from_cite_sources_input,
    citations_from_tool,
    merge_citations,
)
from services.tool_ui import describe_tool_end, describe_tool_start

logger = logging.getLogger("uvicorn.error")


def _title_from_content(content: str) -> str:
    text = (content or "").strip().replace("\n", " ")
    if not text:
        return "New Chat"
    return text[:48] + ("…" if len(text) > 48 else "")


def _content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text") or "")
            elif hasattr(block, "text"):
                parts.append(getattr(block, "text") or "")
        return "".join(parts)
    return str(content)


def _db_messages_to_lc(rows: list[dict]) -> list:
    out = []
    for row in rows:
        role = row.get("role")
        content = row.get("content") or ""
        if role == "user":
            out.append(HumanMessage(content=content, id=row.get("id")))
        elif role == "assistant":
            kwargs = dict(row.get("additional_kwargs") or {})
            tool_calls = row.get("tool_calls") or kwargs.get("tool_calls")
            msg = AIMessage(content=content, id=row.get("id"), additional_kwargs=kwargs)
            if tool_calls:
                msg.tool_calls = tool_calls
            out.append(msg)
        elif role == "tool":
            out.append(
                ToolMessage(
                    content=content,
                    tool_call_id=row.get("tool_call_id") or "",
                    id=row.get("id"),
                )
            )
    return out


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


def _event_subagent_name(event: dict) -> str:
    """Best-effort: which subagent owns this astream event (gatherer/verifier)."""
    md = event.get("metadata") or {}
    for key in ("lc_agent_name", "agent_name", "name"):
        val = str(md.get(key) or "").strip().lower()
        if val in {"gatherer", "verifier"}:
            return val
    ns = str(md.get("langgraph_checkpoint_ns") or "").lower()
    if "verifier" in ns:
        return "verifier"
    if "gatherer" in ns:
        return "gatherer"
    run_name = str(event.get("name") or md.get("langgraph_node") or "").strip().lower()
    if run_name in {"gatherer", "verifier"}:
        return run_name
    for tag in event.get("tags") or []:
        t = str(tag).strip().lower()
        if t in {"gatherer", "verifier"}:
            return t
    return ""


def _last_final_ai_text(messages: list) -> str:
    """Last parent-facing AI text that is not a pure tool-call turn."""
    for msg in reversed(messages or []):
        if not isinstance(msg, AIMessage):
            # duck-typed
            role = getattr(msg, "type", None) or getattr(msg, "role", None)
            if role not in {"ai", "assistant"} and not isinstance(msg, AIMessage):
                continue
        tool_calls = getattr(msg, "tool_calls", None) or []
        text = _content_to_text(getattr(msg, "content", None)).strip()
        if text and not tool_calls:
            return text
        # Some providers put text alongside tool_calls — prefer pure text turns
        if text and tool_calls and len(text) > 80:
            # Likely not the final answer if it's mid-tooling; keep looking
            continue
    # Fallback: last AI message with any text
    for msg in reversed(messages or []):
        if isinstance(msg, ToolMessage):
            continue
        text = _content_to_text(getattr(msg, "content", None)).strip()
        tool_calls = getattr(msg, "tool_calls", None) or []
        if text and not tool_calls:
            return text
    return ""


async def _flush() -> None:
    """Let ASGI write the previous yield before more sync/await work."""
    await asyncio.sleep(0)


async def stream_chat(
    *,
    user_id: str,
    content: str,
    model: str,
    active_agents: Optional[list[str]] = None,
    thread_id: Optional[str] = None,
    model_base_url: Optional[str] = None,
) -> AsyncIterator[str]:
    t0 = time.perf_counter()

    def _lap(label: str) -> None:
        logger.info("stream_chat +%.2fs %s", time.perf_counter() - t0, label)

    store = get_store()
    assistants = store.ensure_default_assistants(user_id)
    _lap("assistants ready")

    # Selected agents → MCP tools. Chat always runs the deep agent (plan + RSV).
    enabled = [a for a in (active_agents or []) if a]
    tool_agents = list(enabled)

    graph_id = "deep_agent"
    assistant = next((a for a in assistants if a.get("graph_id") == graph_id), None)
    if not assistant:
        yield _sse({"type": "error", "content": f"No assistant seeded for {graph_id}"})
        return

    if thread_id:
        thread = store.get_thread(thread_id, user_id)
        if not thread:
            yield _sse({"type": "error", "content": "Thread not found"})
            return
    else:
        thread = store.create_thread(
            {
                "user_id": user_id,
                "assistant_id": assistant["id"],
                "title": _title_from_content(content),
                "metadata": {
                    "thread_assistant_id": assistant["id"],
                    "thread_model": model,
                    "thread_model_base_url": model_base_url,
                    "thread_active_agents": enabled,
                    "thread_graph_id": graph_id,
                },
            }
        )
    _lap("thread ready")

    thread_id = thread["id"]
    yield _sse(
        {
            "type": "meta",
            "conversation_id": thread_id,
            "thread_id": thread_id,
            "assistant_id": assistant["id"],
            "graph_id": graph_id,
            "agents": enabled,
        }
    )
    await _flush()

    # Immediate UI feedback before heavier prep / first LLM call
    yield _sse(
        {
            "type": "tool_start",
            "tool_run_id": "planning",
            "tool_name": "planning",
            "name": "planning",
            "label": "Planning",
            "detail": "Building the todo plan",
            "category": "plan",
        }
    )
    await _flush()

    store.append_message(
        {
            "thread_id": thread_id,
            "role": "user",
            "content": content,
        }
    )

    # Name thread from first user message if still default
    if thread.get("title") in (None, "", "New Chat"):
        store.update_thread(thread_id, user_id, {"title": _title_from_content(content)})

    history_rows = store.list_messages(thread_id)
    _lap("history loaded")

    extra_tools = None
    skill_sources: list[str] = []
    latest_todos: list[dict] = []
    if graph_id == "deep_agent":
        from agents.mcp_tools import load_mcp_tools
        from agents.skills_loader import skill_sources_for_agents, skill_status_label

        try:
            if tool_agents:
                extra_tools = await load_mcp_tools(tool_agents)
            else:
                extra_tools = []
            _lap(f"mcp tools loaded n={len(extra_tools or [])}")

            skill_sources = skill_sources_for_agents(tool_agents)

            skill_label, skill_detail = skill_status_label(tool_agents)
            agents_part = ", ".join(tool_agents) if tool_agents else ""
            if tool_agents or skill_label:
                detail_bits = [b for b in [agents_part, skill_detail] if b]
                yield _sse(
                    {
                        "type": "status",
                        "step_id": "prep",
                        "label": (
                            "Loaded agents & skills into the context"
                            if tool_agents and skill_label
                            else (
                                "Loaded agents into the context"
                                if tool_agents
                                else "Loaded skills into the context"
                            )
                        ),
                        "detail": " · ".join(detail_bits) if detail_bits else "",
                        "content": "prep",
                        "category": "prep",
                    }
                )
                await _flush()
        except Exception as exc:
            yield _sse({"type": "error", "content": f"Failed to load MCP tools: {exc}"})
            await _flush()
            extra_tools = []

    graph = get_graph(
        graph_id,
        tools=extra_tools,
        skills=skill_sources or None,
    )
    _lap("graph ready")
    config = {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": 80,
    }

    # Warm checkpointer → only the new turn. Cold (restart) → rebuild from DB.
    try:
        state = await graph.aget_state(config)
        has_state = bool(state and state.values and state.values.get("messages"))
    except Exception:
        has_state = False
    _lap(f"checkpointer warm={has_state}")

    if has_state:
        lc_input = {"messages": [HumanMessage(content=content)]}
    else:
        lc_input = {"messages": _db_messages_to_lc(history_rows)}

    ctx = Context(
        model=model or settings.MODEL,
        model_base_url=model_base_url or (settings.MODEL_BASE_URL or None),
        system_prompt=assistant.get("system_prompt"),
    )

    assistant_text = ""
    tool_buffers: dict[str, dict] = {}
    collected_citations: list[dict] = []
    first_model_event = True
    planning_open = True
    # Stack of open task→subagent runs so nested tools can be tagged (via=verifier)
    active_subagents: list[dict] = []
    # Do not stream gatherer/verifier briefs (or mid-plan chatter) into the bubble.
    # Final answer streams only after verifier (deep_agent) or immediately (basic).
    answer_mode = graph_id != "deep_agent"
    held_text = ""
    draft_text = ""  # preserved across tool calls for post-verifier fallback

    async def _emit_todos(todos: list[dict]):
        nonlocal latest_todos, planning_open
        latest_todos = todos
        if planning_open:
            planning_open = False
            yield _sse(
                {
                    "type": "tool_end",
                    "tool_run_id": "planning",
                    "tool_name": "planning",
                    "label": "Planned",
                    "detail": f"{len(todos)} step{'s' if len(todos) != 1 else ''}",
                    "summary": "",
                    "category": "plan",
                }
            )
            await _flush()
        yield _sse({"type": "todos", "todos": todos})
        await _flush()

    def _hold_or_stream_text(text: str):
        """Yield SSE text only in answer_mode; otherwise park it (may be discarded)."""
        nonlocal assistant_text, held_text
        if not text:
            return None
        if active_subagents:
            # Nested gatherer/verifier tokens — never show in the chat bubble
            return None
        if answer_mode:
            assistant_text += text
            return _sse({"type": "text", "content": text})
        held_text += text
        return None

    def _current_via(event: dict) -> str:
        tagged = _event_subagent_name(event)
        if tagged:
            return tagged
        if active_subagents:
            return str(active_subagents[-1].get("type") or "")
        return ""

    try:
        async for event in graph.astream_events(
            lc_input,
            config=config,
            context=ctx,
            version="v2",
        ):
            kind = event.get("event")
            data = event.get("data") or {}

            if first_model_event and kind in {
                "on_chat_model_start",
                "on_chat_model_stream",
                "on_tool_start",
            }:
                _lap(f"first graph event {kind}")
                first_model_event = False

            if kind == "on_chat_model_stream":
                chunk = data.get("chunk")
                if chunk is None:
                    continue
                # Nested subagent streams also have lc_agent_name — suppress even
                # if our stack briefly drifted.
                if _event_subagent_name(event) or active_subagents:
                    continue
                text = _content_to_text(getattr(chunk, "content", None))
                payload = _hold_or_stream_text(text)
                if payload is not None:
                    yield payload

            elif kind == "on_tool_start":
                run_id = str(event.get("run_id") or uuid.uuid4())
                name = event.get("name") or "tool"
                tool_input = data.get("input")
                # Preserve synthesize draft; drop ephemeral pre-tool chatter
                if held_text.strip():
                    draft_text = held_text.strip()
                held_text = ""

                # Plan updates go to the Plan panel only — not execution steps
                if name == "write_todos":
                    todos = _extract_todos(tool_input)
                    if todos is not None:
                        async for chunk in _emit_todos(todos):
                            yield chunk
                    continue

                # Model-declared sources → Sources panel (not a noisy step)
                if name == "cite_sources":
                    new_cites = citations_from_cite_sources_input(
                        tool_input,
                        start_index=len(collected_citations) + 1,
                    )
                    if new_cites:
                        collected_citations = merge_citations(
                            collected_citations, new_cites
                        )
                        yield _sse(
                            {
                                "type": "citations",
                                "citations": collected_citations,
                            }
                        )
                        await _flush()
                    continue

                ui = describe_tool_start(name, tool_input)
                via = _current_via(event)
                if name == "task":
                    sub = (
                        ui.get("subagent")
                        or ui.get("category")
                        or _event_subagent_name(event)
                        or "subagent"
                    )
                    active_subagents.append({"run_id": run_id, "type": sub})
                    via = ""  # the subagent step itself is not "via" itself

                tool_buffers[run_id] = {
                    "name": name,
                    "input": tool_input,
                    "via": via,
                    "is_subagent": name == "task",
                    "subagent": (ui.get("subagent") or "") if name == "task" else "",
                }

                logger.info(
                    "stream_chat tool_start %s%s",
                    name,
                    f" via={via}" if via else "",
                )
                payload = {
                    "type": "tool_start",
                    "tool_run_id": run_id,
                    "tool_name": name,
                    "name": name,
                    "label": ui["label"],
                    "detail": ui.get("detail") or "",
                    "category": ui.get("category") or "tool",
                }
                if via:
                    payload["via"] = via
                yield _sse(payload)
                await _flush()

            elif kind == "on_tool_end":
                run_id = str(event.get("run_id") or "")
                output = data.get("output")
                try:
                    output_text = _content_to_text(getattr(output, "content", output))
                except Exception:
                    output_text = ""
                meta = tool_buffers.get(run_id, {})
                name = meta.get("name") or event.get("name") or "tool"
                tool_input = meta.get("input")

                # Subagents (task) sometimes end with a mismatched run_id —
                # only fall back among STILL-OPEN task buffers (never a closed one).
                if not meta and name == "task":
                    open_ids = {s["run_id"] for s in active_subagents}
                    for rid, buf in reversed(list(tool_buffers.items())):
                        if buf.get("name") == "task" and rid in open_ids:
                            run_id = rid
                            meta = buf
                            tool_input = buf.get("input")
                            name = "task"
                            break
                elif not meta and name:
                    for rid, buf in reversed(list(tool_buffers.items())):
                        if buf.get("name") == name:
                            run_id = rid
                            meta = buf
                            tool_input = buf.get("input")
                            break
                if not run_id:
                    run_id = str(uuid.uuid4())

                if name == "write_todos":
                    # Prefer end payload — start events often have empty args
                    end_input = data.get("input") or tool_input
                    todos = (
                        _extract_todos(end_input)
                        or _extract_todos_from_output(output)
                    )
                    if todos is not None:
                        async for chunk in _emit_todos(todos):
                            yield chunk
                    tool_buffers.pop(run_id, None)
                    continue

                if name == "cite_sources":
                    # Input may only be complete at end in some runtimes
                    end_input = data.get("input") or tool_input
                    new_cites = citations_from_cite_sources_input(
                        end_input,
                        start_index=len(collected_citations) + 1,
                    )
                    if new_cites:
                        collected_citations = merge_citations(
                            collected_citations, new_cites
                        )
                        yield _sse(
                            {
                                "type": "citations",
                                "citations": collected_citations,
                            }
                        )
                        await _flush()
                    tool_buffers.pop(run_id, None)
                    continue

                # Prefer end-event input when start args were empty (common)
                if data.get("input"):
                    tool_input = data.get("input")

                # Only auto-ingest when a tool already returned a citations/sources field
                if name not in {
                    "write_todos",
                    "cite_sources",
                    "task",
                    "ls",
                    "read_file",
                    "write_file",
                    "edit_file",
                    "glob",
                    "grep",
                    "execute",
                }:
                    new_cites = citations_from_tool(
                        name,
                        tool_input,
                        output,
                        start_index=len(collected_citations) + 1,
                    )
                    if new_cites:
                        collected_citations = merge_citations(
                            collected_citations, new_cites
                        )
                        yield _sse(
                            {
                                "type": "citations",
                                "citations": collected_citations,
                            }
                        )
                        await _flush()

                ui = describe_tool_end(name, tool_input, output_text)
                via = meta.get("via") or _event_subagent_name(event) or ""
                if name == "task":
                    sub = (
                        meta.get("subagent")
                        or ui.get("subagent")
                        or ui.get("category")
                        or ""
                    )
                    # Only pop the matching open subagent — never the "latest" on
                    # a mismatched run_id (that prematurely untagged nested tools).
                    closed = False
                    for i in range(len(active_subagents) - 1, -1, -1):
                        if active_subagents[i]["run_id"] == run_id:
                            sub = active_subagents[i].get("type") or sub
                            active_subagents.pop(i)
                            closed = True
                            break
                    if not closed and len(active_subagents) == 1:
                        # Single open task + unmatched id → still close it
                        sub = active_subagents[0].get("type") or sub
                        active_subagents.pop()
                        closed = True
                    via = ""
                    # After verifier, subsequent parent tokens are the user-facing answer
                    if str(sub).lower() == "verifier":
                        answer_mode = True
                        held_text = ""

                end_payload = {
                    "type": "tool_end",
                    "tool_run_id": run_id,
                    "tool_name": name,
                    "label": ui["label"],
                    "detail": ui.get("detail") or "",
                    "summary": ui.get("summary") or "",
                    "category": ui.get("category") or "tool",
                }
                if via:
                    end_payload["via"] = via
                yield _sse(end_payload)
                await _flush()
                tool_buffers.pop(run_id, None)
                try:
                    store.append_message(
                        {
                            "thread_id": thread_id,
                            "role": "tool",
                            "content": (output_text or "")[:4000],
                            "tool_call_id": run_id,
                            "additional_kwargs": {
                                "tool_name": name,
                                "label": ui["label"],
                                "category": ui.get("category"),
                            },
                        }
                    )
                except Exception:
                    logger.exception("failed to persist tool message for %s", name)

            elif kind == "on_chat_model_end":
                # Capture write_todos / cite_sources from tool_call args when
                # tool events arrive with empty input (common with some providers).
                chunk = data.get("output") or data.get("result")
                msgs = chunk if isinstance(chunk, list) else [chunk]
                for msg in msgs:
                    for tc in getattr(msg, "tool_calls", None) or []:
                        tc_name = (
                            tc.get("name")
                            if isinstance(tc, dict)
                            else getattr(tc, "name", "")
                        )
                        tc_args = (
                            tc.get("args")
                            if isinstance(tc, dict)
                            else getattr(tc, "args", {})
                        )
                        if tc_name == "write_todos":
                            todos = _extract_todos(tc_args)
                            if todos is not None:
                                async for chunk in _emit_todos(todos):
                                    yield chunk
                        elif tc_name == "cite_sources":
                            new_cites = citations_from_cite_sources_input(
                                tc_args,
                                start_index=len(collected_citations) + 1,
                            )
                            if new_cites:
                                collected_citations = merge_citations(
                                    collected_citations, new_cites
                                )
                                yield _sse(
                                    {
                                        "type": "citations",
                                        "citations": collected_citations,
                                    }
                                )
                                await _flush()

        # Fallback: read todos from compiled state after the run
        try:
            final_state = await graph.aget_state(config)
            values = (final_state.values or {}) if final_state else {}
            state_todos = values.get("todos")
            if state_todos:
                parsed = _extract_todos({"todos": state_todos})
                if parsed:
                    async for chunk in _emit_todos(parsed):
                        yield chunk
            # Recover answer if streaming gates dropped it (common after verifier)
            if not assistant_text.strip():
                recovered = (
                    held_text.strip()
                    or draft_text.strip()
                    or _last_final_ai_text(values.get("messages") or [])
                )
                if recovered:
                    assistant_text = recovered
                    yield _sse({"type": "text", "content": recovered})
                    await _flush()
        except Exception:
            if not assistant_text.strip() and (held_text.strip() or draft_text.strip()):
                assistant_text = held_text.strip() or draft_text.strip()
                yield _sse({"type": "text", "content": assistant_text})
                await _flush()

        held_text = ""

    except Exception as exc:
        err = str(exc)
        yield _sse({"type": "error", "content": err})
        if not assistant_text:
            assistant_text = f"Error: {err}"
        store.append_message(
            {
                "thread_id": thread_id,
                "role": "assistant",
                "content": assistant_text,
                "additional_kwargs": {
                    "model_id": model,
                    "error": True,
                    "active_agents": enabled,
                    "graph_id": graph_id,
                    "todos": latest_todos or None,
                    "citations": collected_citations or None,
                },
            }
        )
        yield _sse(
            {
                "type": "done",
                "conversation_id": thread_id,
                "thread_id": thread_id,
                "agents": enabled,
                "citations": collected_citations or None,
            }
        )
        return

    message_id = str(uuid.uuid4())
    store.append_message(
        {
            "id": message_id,
            "thread_id": thread_id,
            "role": "assistant",
            "content": assistant_text,
            "additional_kwargs": {
                "model_id": model,
                "active_agents": enabled,
                "graph_id": graph_id,
                "todos": latest_todos or None,
                "citations": collected_citations or None,
            },
        }
    )
    yield _sse(
        {
            "type": "done",
            "conversation_id": thread_id,
            "thread_id": thread_id,
            "message_id": message_id,
            "agents": enabled,
            "graph_id": graph_id,
            "todos": latest_todos or None,
            "citations": collected_citations or None,
        }
    )


def _extract_todos(tool_input: Any) -> Optional[list[dict]]:
    """Pull todos list from write_todos tool input."""
    if tool_input is None:
        return None
    if isinstance(tool_input, dict):
        todos = tool_input.get("todos")
        if isinstance(todos, list):
            out: list[dict] = []
            for t in todos:
                if isinstance(t, dict):
                    out.append(
                        {
                            "content": str(t.get("content") or ""),
                            "status": str(t.get("status") or "pending"),
                        }
                    )
                else:
                    # pydantic / TypedDict-ish objects
                    content = getattr(t, "content", None) or getattr(t, "get", lambda *_: None)("content")
                    status = getattr(t, "status", None) or "pending"
                    if content:
                        out.append({"content": str(content), "status": str(status)})
            return out or None
        return None
    if isinstance(tool_input, str):
        raw = tool_input.strip()
        try:
            parsed = json.loads(raw)
        except Exception:
            # Sometimes providers double-encode
            try:
                parsed = json.loads(json.loads(f'"{raw}"'))
            except Exception:
                return None
        return _extract_todos(parsed)
    return None


def _extract_todos_from_output(output: Any) -> Optional[list[dict]]:
    """Pull todos from write_todos Command / ToolMessage output."""
    update = getattr(output, "update", None)
    if isinstance(update, dict) and "todos" in update:
        return _extract_todos({"todos": update["todos"]})
    if isinstance(output, dict) and "todos" in output:
        return _extract_todos(output)
    text = _content_to_text(getattr(output, "content", output))
    # "Updated todo list to [{...}]"
    if "Updated todo list to " in text:
        raw = text.split("Updated todo list to ", 1)[-1].strip()
        try:
            parsed = json.loads(raw.replace("'", '"'))
        except Exception:
            try:
                import ast

                parsed = ast.literal_eval(raw)
            except Exception:
                return None
        return _extract_todos({"todos": parsed})
    return None
