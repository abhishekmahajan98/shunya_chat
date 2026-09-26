"""
Chat router: models list, in-memory conversation history, and a dummy stream endpoint.

No SQL schema / Supabase tables. Persistence is intentionally ephemeral so the
data model can be redesigned from scratch.
"""
import asyncio
import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from config import AVAILABLE_MODELS, ModelInfo, get_model_info
from database import get_supabase
from models import MessageCreate, ConversationSummary, ConversationDetail

router = APIRouter(prefix="/api", tags=["chat"])

# Ephemeral store: { conversation_id: { meta..., messages: [...] } }
_STORE: dict[str, dict] = {}


def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Get user ID from auth token if provided."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.replace("Bearer ", "")
    supabase = get_supabase()

    try:
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return user_response.user.id
    except Exception:
        pass

    return None


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
        f"**(Stub response)** No DB schema yet — history is in-memory only.\n\n"
        f"You said:\n\n> {preview or '*(empty message)*'}\n\n"
        f"_Model selected: `{model}`._"
    )


def _owned(conversation: dict, user_id: Optional[str]) -> bool:
    if not user_id:
        return True
    owner = conversation.get("user_id")
    return owner is None or owner == user_id


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    """Get available models."""
    return AVAILABLE_MODELS


@router.post("/upload")
async def upload_file(file: UploadFile, user_id: Optional[str] = Depends(get_optional_user_id)):
    """
    Stub upload — returns a placeholder URL without writing to storage.
    Replace when the new document/attachment model exists.
    """
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
async def list_conversations(
    skip: int = 0,
    limit: int = 20,
    offset: Optional[int] = None,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """List in-memory conversations (newest first)."""
    start = offset if offset is not None else skip
    items = list(_STORE.values())
    if user_id:
        items = [c for c in items if c.get("user_id") == user_id]
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
async def get_conversation(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """Get an in-memory conversation with messages."""
    conversation = _STORE.get(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not _owned(conversation, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "id": conversation["id"],
        "title": conversation["title"],
        "model": conversation["model"],
        "created_at": conversation["created_at"],
        "updated_at": conversation["updated_at"],
        "messages": conversation["messages"],
    }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """Delete an in-memory conversation."""
    conversation = _STORE.get(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not _owned(conversation, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    del _STORE[conversation_id]
    return {"status": "deleted"}


@router.post("/chat/stream")
async def send_message_stream(
    request: MessageCreate,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Dummy streaming chat endpoint.
    Stores user + assistant messages in process memory and streams a stub reply.
    """
    if not get_model_info(request.model):
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")

    now = _now()

    if request.conversation_id:
        conversation = _STORE.get(request.conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if not _owned(conversation, user_id):
            raise HTTPException(status_code=403, detail="Not authorized")
        conversation["updated_at"] = now
        conversation["model"] = request.model
    else:
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "title": _title_from_content(request.content),
            "model": request.model,
            "user_id": user_id,
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
