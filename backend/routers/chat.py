"""Chat + thread history + models for the Shunya agent harness."""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from auth import DummyUser, get_current_user
from config import AVAILABLE_MODELS, AgentInfo, ModelInfo, get_available_agents, get_model_info, settings
from db import get_store
from models import ConversationDetail, ConversationSummary, MessageCreate, MessageOut
from services.agent_runner import stream_chat

router = APIRouter(prefix="/api", tags=["chat"])


@router.get("/me")
async def me(user: DummyUser = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "name": user.name}


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    return AVAILABLE_MODELS


@router.get("/agents", response_model=list[AgentInfo])
async def list_agents():
    """Capability agents the UI can toggle. Any selected → deep_agent + /mcp/{id} tools."""
    return get_available_agents()


@router.post("/upload")
async def upload_file(file: UploadFile, user: DummyUser = Depends(get_current_user)):
    content = await file.read()
    file_id = str(uuid.uuid4())
    return {
        "url": f"memory://attachments/{file_id}/{file.filename or 'file'}",
        "path": file_id,
        "name": file.filename or "file",
        "type": file.content_type or "application/octet-stream",
        "size": len(content),
    }


@router.get("/conversations", response_model=list[ConversationSummary])
@router.get("/threads", response_model=list[ConversationSummary])
async def list_threads(
    skip: int = 0,
    limit: int = 20,
    offset: Optional[int] = None,
    assistant_id: Optional[str] = None,
    user: DummyUser = Depends(get_current_user),
):
    store = get_store()
    store.ensure_default_assistants(user.id)
    start = offset if offset is not None else skip
    threads = store.list_threads(user.id, assistant_id=assistant_id, limit=limit, offset=start)
    return [
        {
            "id": t["id"],
            "title": t.get("title") or "New Chat",
            "model": (t.get("metadata") or {}).get("thread_model") or settings.MODEL,
            "created_at": t["created_at"],
            "updated_at": t["updated_at"],
            "assistant_id": t.get("assistant_id"),
        }
        for t in threads
    ]


@router.get("/conversations/{thread_id}", response_model=ConversationDetail)
@router.get("/threads/{thread_id}", response_model=ConversationDetail)
async def get_thread(thread_id: str, user: DummyUser = Depends(get_current_user)):
    store = get_store()
    thread = store.get_thread(thread_id, user.id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    messages = store.list_messages(thread_id)
    # UI currently expects user/assistant; hide raw tool rows from the transcript
    visible = [m for m in messages if m["role"] in ("user", "assistant")]
    return {
        "id": thread["id"],
        "title": thread.get("title") or "New Chat",
        "model": (thread.get("metadata") or {}).get("thread_model") or settings.MODEL,
        "created_at": thread["created_at"],
        "updated_at": thread["updated_at"],
        "assistant_id": thread.get("assistant_id"),
        "messages": [
            MessageOut(
                id=m["id"],
                role=m["role"],
                content=m.get("content") or "",
                created_at=m["created_at"],
                additional_kwargs=m.get("additional_kwargs"),
                tool_calls=m.get("tool_calls"),
                agents=(m.get("additional_kwargs") or {}).get("active_agents"),
            )
            for m in visible
        ],
    }


@router.delete("/conversations/{thread_id}")
@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str, user: DummyUser = Depends(get_current_user)):
    store = get_store()
    if not store.delete_thread(thread_id, user.id):
        raise HTTPException(status_code=404, detail="Thread not found")
    return {"status": "deleted"}


@router.post("/chat/stream")
async def chat_stream(request: MessageCreate, user: DummyUser = Depends(get_current_user)):
    if not get_model_info(request.model):
        # Allow any model string (provider:model) even if not in the catalogue
        if ":" not in request.model and "/" not in request.model:
            raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")

    thread_id = request.thread_id or request.conversation_id
    generator = stream_chat(
        user_id=user.id,
        content=request.content,
        model=request.model,
        active_agents=request.active_agents,
        thread_id=thread_id,
        model_base_url=request.model_base_url,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
