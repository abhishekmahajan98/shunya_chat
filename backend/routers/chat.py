"""
Chat router: models list, in-memory conversation history, and a dummy stream endpoint.

No auth, no SQL schema. Everything is ephemeral so concepts can be redesigned.
"""
import asyncio
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from config import AVAILABLE_MODELS, ModelInfo, get_model_info
from models import MessageCreate, ConversationSummary, ConversationDetail

router = APIRouter(prefix="/api", tags=["chat"])

# Ephemeral store: { conversation_id: { meta..., messages: [...] } }
_STORE: dict[str, dict] = {}


def _now() -> str:
    return datetime.utcnow().isoformat()


def _title_from_content(content: str) -> str:
    text = (content or "").strip().replace("\n", " ")
    if not text:
        return "New Chat"
    return text[:48] + ("…" if len(text) > 48 else "")


def _dummy_reply(content: str, model: str) -> str:
    preview = (content or "").strip()
    if len(preview) > 280:
        preview = preview[:280] + "…"
    return (
        f"**(Stub response)** No auth or DB yet — history is in-memory only.\n\n"
        f"You said:\n\n> {preview or '*(empty message)*'}\n\n"
        f"_Model selected: `{model}`._"
    )


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    """Get available models."""
    return AVAILABLE_MODELS


@router.post("/upload")
async def upload_file(file: UploadFile):
    """Stub upload — placeholder URL, no storage backend."""
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
async def list_conversations(skip: int = 0, limit: int = 20, offset: int | None = None):
    """List in-memory conversations (newest first)."""
    start = offset if offset is not None else skip
    items = list(_STORE.values())
    items.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    page = items[start : start + limit]
    return [
        {
            "id": c["id"],
            "title": c["title"],
            "model": c["model"],
            "created_at": c["created_at"],
            "updated_at": c["updated_at"],
        }
        for c in page
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: str):
    """Get an in-memory conversation with messages."""
    conversation = _STORE.get(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "id": conversation["id"],
        "title": conversation["title"],
        "model": conversation["model"],
        "created_at": conversation["created_at"],
        "updated_at": conversation["updated_at"],
        "messages": conversation["messages"],
    }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete an in-memory conversation."""
    if conversation_id not in _STORE:
        raise HTTPException(status_code=404, detail="Conversation not found")
    del _STORE[conversation_id]
    return {"status": "deleted"}


@router.post("/chat/stream")
async def send_message_stream(request: MessageCreate):
    """Dummy streaming chat endpoint with in-memory persistence."""
    if not get_model_info(request.model):
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")

    now = _now()

    if request.conversation_id:
        conversation = _STORE.get(request.conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation["updated_at"] = now
        conversation["model"] = request.model
    else:
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "title": _title_from_content(request.content),
            "model": request.model,
            "created_at": now,
            "updated_at": now,
            "messages": [],
        }
        _STORE[conversation_id] = conversation

    user_message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation["id"],
        "role": "user",
        "content": request.content,
        "created_at": now,
        "attachments": [a.model_dump() for a in request.attachments] if request.attachments else [],
    }
    conversation["messages"].append(user_message)

    reply_text = _dummy_reply(request.content, request.model)
    assistant_message_id = str(uuid.uuid4())

    async def event_stream():
        yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation['id']})}\n\n"
        await asyncio.sleep(0.05)

        chunk_size = 24
        for i in range(0, len(reply_text), chunk_size):
            piece = reply_text[i : i + chunk_size]
            yield f"data: {json.dumps({'type': 'text', 'content': piece})}\n\n"
            await asyncio.sleep(0.02)

        assistant_message = {
            "id": assistant_message_id,
            "conversation_id": conversation["id"],
            "role": "assistant",
            "content": reply_text,
            "created_at": _now(),
        }
        conversation["messages"].append(assistant_message)
        conversation["updated_at"] = _now()

        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation['id'], 'message_id': assistant_message_id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
