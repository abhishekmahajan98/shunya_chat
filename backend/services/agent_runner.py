"""Run a LangChain / DeepAgents graph and stream UI-friendly SSE events."""

from __future__ import annotations

import json
import uuid
from typing import Any, AsyncIterator, Optional

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from agents.model import Context
from agents.registry import get_graph
from config import settings
from db import get_store


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


async def stream_chat(
    *,
    user_id: str,
    content: str,
    model: str,
    assistant_id: Optional[str] = None,
    thread_id: Optional[str] = None,
    model_base_url: Optional[str] = None,
) -> AsyncIterator[str]:
    store = get_store()
    assistants = store.ensure_default_assistants(user_id)

    if assistant_id:
        assistant = store.get_assistant(assistant_id, user_id)
        if not assistant:
            yield _sse({"type": "error", "content": "Assistant not found"})
            return
    else:
        assistant = assistants[0]

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
                },
            }
        )

    thread_id = thread["id"]
    yield _sse({"type": "meta", "conversation_id": thread_id, "thread_id": thread_id, "assistant_id": assistant["id"]})

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
    graph = get_graph(assistant["graph_id"])
    config = {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": 50,
    }

    # Warm checkpointer → only the new turn. Cold (restart) → rebuild from DB.
    try:
        state = await graph.aget_state(config)
        has_state = bool(state and state.values and state.values.get("messages"))
    except Exception:
        has_state = False

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

    try:
        async for event in graph.astream_events(
            lc_input,
            config=config,
            context=ctx,
            version="v2",
        ):
            kind = event.get("event")
            data = event.get("data") or {}

            if kind == "on_chat_model_stream":
                chunk = data.get("chunk")
                if chunk is None:
                    continue
                text = _content_to_text(getattr(chunk, "content", None))
                if text:
                    assistant_text += text
                    yield _sse({"type": "text", "content": text})

            elif kind == "on_tool_start":
                run_id = str(event.get("run_id") or uuid.uuid4())
                name = event.get("name") or "tool"
                tool_input = data.get("input")
                tool_buffers[run_id] = {"name": name, "input": tool_input}
                yield _sse(
                    {
                        "type": "tool_start",
                        "tool_run_id": run_id,
                        "tool_name": name,
                        "name": name,
                        "input": json.dumps(tool_input, default=str) if not isinstance(tool_input, str) else tool_input,
                    }
                )

            elif kind == "on_tool_end":
                run_id = str(event.get("run_id") or "")
                output = data.get("output")
                output_text = _content_to_text(getattr(output, "content", output))
                meta = tool_buffers.get(run_id, {})
                yield _sse(
                    {
                        "type": "tool_end",
                        "tool_run_id": run_id,
                        "tool_name": meta.get("name") or event.get("name"),
                        "output": output_text,
                    }
                )
                store.append_message(
                    {
                        "thread_id": thread_id,
                        "role": "tool",
                        "content": output_text,
                        "tool_call_id": run_id,
                        "additional_kwargs": {"tool_name": meta.get("name") or event.get("name")},
                    }
                )

            elif kind == "on_chat_model_end":
                output = data.get("output")
                if isinstance(output, AIMessage) and getattr(output, "tool_calls", None):
                    yield _sse(
                        {
                            "type": "status",
                            "content": f"Calling tools: {', '.join(tc.get('name', '?') for tc in output.tool_calls)}",
                        }
                    )

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
                "additional_kwargs": {"model_id": model, "error": True},
            }
        )
        yield _sse({"type": "done", "conversation_id": thread_id, "thread_id": thread_id})
        return

    message_id = str(uuid.uuid4())
    store.append_message(
        {
            "id": message_id,
            "thread_id": thread_id,
            "role": "assistant",
            "content": assistant_text,
            "additional_kwargs": {"model_id": model},
        }
    )
    yield _sse(
        {
            "type": "done",
            "conversation_id": thread_id,
            "thread_id": thread_id,
            "message_id": message_id,
        }
    )
