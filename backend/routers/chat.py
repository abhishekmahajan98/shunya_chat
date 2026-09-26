"""
Chat router: models list, file upload, conversation history, and a dummy stream endpoint.
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
from models import (
    MessageCreate,
    ConversationSummary,
    ConversationDetail,
)

router = APIRouter(prefix="/api", tags=["chat"])


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


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    """Get available models."""
    return AVAILABLE_MODELS


@router.post("/upload")
async def upload_file(file: UploadFile, user_id: Optional[str] = Depends(get_optional_user_id)):
    """Upload a file to Supabase storage (chat attachments)."""
    supabase = get_supabase()
    file_content = await file.read()

    file_ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "bin"
    file_path = f"{uuid.uuid4()}.{file_ext}"

    try:
        supabase.storage.from_("chat-attachments").upload(
            file_path,
            file_content,
            {"content-type": file.content_type or "application/octet-stream"},
        )
        public_url = supabase.storage.from_("chat-attachments").get_public_url(file_path)
        return {
            "url": public_url,
            "path": file_path,
            "name": file.filename,
            "type": file.content_type,
            "size": len(file_content),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    skip: int = 0,
    limit: int = 20,
    offset: Optional[int] = None,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """List conversations with pagination."""
    supabase = get_supabase()
    start = offset if offset is not None else skip

    query = (
        supabase.table("conversations")
        .select("*")
        .order("updated_at", desc=True)
        .range(start, start + limit - 1)
    )

    if user_id:
        query = query.eq("user_id", user_id)

    result = query.execute()
    return result.data


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """Get conversation details with messages."""
    supabase = get_supabase()

    result = supabase.table("conversations").select("*").eq("id", conversation_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation = result.data[0]
    if user_id and conversation.get("user_id") and conversation["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    messages_result = (
        supabase.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )

    return {**conversation, "messages": messages_result.data}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """Delete a conversation and its messages."""
    supabase = get_supabase()

    result = supabase.table("conversations").select("*").eq("id", conversation_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation = result.data[0]
    if user_id and conversation.get("user_id") and conversation["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    supabase.table("messages").delete().eq("conversation_id", conversation_id).execute()
    supabase.table("conversations").delete().eq("id", conversation_id).execute()
    return {"status": "deleted"}


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
        f"**(Stub response)** Backend agent loop was removed.\n\n"
        f"You said:\n\n> {preview or '*(empty message)*'}\n\n"
        f"_Model selected: `{model}`. Replace `/api/chat/stream` when you rebuild the agentic loop._"
    )


@router.post("/chat/stream")
async def send_message_stream(
    request: MessageCreate,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Dummy streaming chat endpoint.
    Persists user + assistant messages and streams a stub reply as SSE.
    """
    if not get_model_info(request.model):
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")

    supabase = get_supabase()
    now = datetime.utcnow().isoformat()

    if request.conversation_id:
        result = (
            supabase.table("conversations")
            .select("*")
            .eq("id", request.conversation_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation = result.data[0]
    else:
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "title": _title_from_content(request.content),
            "model": request.model,
            "user_id": user_id,
            "created_at": now,
            "updated_at": now,
        }
        supabase.table("conversations").insert(conversation).execute()

    user_message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation["id"],
        "role": "user",
        "content": request.content,
        "created_at": now,
        "attachments": [a.model_dump() for a in request.attachments] if request.attachments else [],
    }
    supabase.table("messages").insert(user_message).execute()

    reply_text = _dummy_reply(request.content, request.model)
    assistant_message_id = str(uuid.uuid4())

    async def event_stream():
        yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation['id']})}\n\n"
        await asyncio.sleep(0.05)

        # Stream in small chunks so the frontend typewriter path still works
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
            "created_at": datetime.utcnow().isoformat(),
        }
        try:
            supabase.table("messages").insert(assistant_message).execute()
            supabase.table("conversations").update(
                {"updated_at": datetime.utcnow().isoformat(), "model": request.model}
            ).eq("id", conversation["id"]).execute()
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation['id'], 'message_id': assistant_message_id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
