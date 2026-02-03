from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json
import uuid
from datetime import datetime

from database import get_supabase
from models import (
    MessageCreate,
    MessageResponse,
    ConversationSummary,
    ConversationDetail,
    MessageOut,
    AVAILABLE_MODELS,
    ModelInfo,
    get_model_info,
)
from providers import GeminiProvider, AnthropicProvider

router = APIRouter(prefix="/api", tags=["chat"])

# Initialize providers lazily
_gemini_provider = None
_anthropic_provider = None


def get_gemini_provider():
    global _gemini_provider
    if _gemini_provider is None:
        _gemini_provider = GeminiProvider()
    return _gemini_provider


def get_anthropic_provider():
    global _anthropic_provider
    if _anthropic_provider is None:
        _anthropic_provider = AnthropicProvider()
    return _anthropic_provider


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    """Get available models."""
    return AVAILABLE_MODELS


@router.post("/chat", response_model=MessageResponse)
async def send_message(request: MessageCreate):
    """Send a message and get AI response."""
    supabase = get_supabase()
    
    # Validate model
    model_info = get_model_info(request.model)
    if not model_info:
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")

    # Get or create conversation
    if request.conversation_id:
        result = supabase.table("conversations").select("*").eq("id", request.conversation_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation = result.data[0]
    else:
        # Create new conversation
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "title": "New Chat",
            "model": request.model,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        supabase.table("conversations").insert(conversation).execute()

    # Add user message
    user_message_id = str(uuid.uuid4())
    user_message = {
        "id": user_message_id,
        "conversation_id": conversation["id"],
        "role": "user",
        "content": request.content,
        "created_at": datetime.utcnow().isoformat(),
    }
    supabase.table("messages").insert(user_message).execute()

    # Build message history for LLM
    messages_result = supabase.table("messages")\
        .select("*")\
        .eq("conversation_id", conversation["id"])\
        .order("created_at")\
        .execute()
    
    message_history = [
        {"role": msg["role"], "content": msg["content"]}
        for msg in messages_result.data
    ]

    # Get response from appropriate provider
    try:
        if model_info.provider == "google":
            provider = get_gemini_provider()
        else:
            provider = get_anthropic_provider()

        response_text = await provider.generate(message_history, request.model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")

    # Store assistant response
    assistant_message_id = str(uuid.uuid4())
    assistant_message = {
        "id": assistant_message_id,
        "conversation_id": conversation["id"],
        "role": "assistant",
        "content": response_text,
        "created_at": datetime.utcnow().isoformat(),
    }
    supabase.table("messages").insert(assistant_message).execute()

    # Update conversation title if it's the first message
    if len(messages_result.data) == 1:
        new_title = request.content[:50] + ("..." if len(request.content) > 50 else "")
        supabase.table("conversations")\
            .update({"title": new_title, "updated_at": datetime.utcnow().isoformat()})\
            .eq("id", conversation["id"])\
            .execute()

    return MessageResponse(
        conversation_id=conversation["id"],
        message_id=assistant_message_id,
        role="assistant",
        content=response_text,
    )


@router.post("/chat/stream")
async def send_message_stream(request: MessageCreate):
    """Stream a message response using SSE."""
    supabase = get_supabase()
    
    # Validate model
    model_info = get_model_info(request.model)
    if not model_info:
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")

    # Get or create conversation
    if request.conversation_id:
        result = supabase.table("conversations").select("*").eq("id", request.conversation_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation = result.data[0]
    else:
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "title": "New Chat",
            "model": request.model,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        supabase.table("conversations").insert(conversation).execute()

    # Add user message
    user_message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation["id"],
        "role": "user",
        "content": request.content,
        "created_at": datetime.utcnow().isoformat(),
    }
    supabase.table("messages").insert(user_message).execute()

    # Build message history
    messages_result = supabase.table("messages")\
        .select("*")\
        .eq("conversation_id", conversation["id"])\
        .order("created_at")\
        .execute()
    
    message_history = [
        {"role": msg["role"], "content": msg["content"]}
        for msg in messages_result.data
    ]

    # Update title if first message
    if len(messages_result.data) == 1:
        new_title = request.content[:50] + ("..." if len(request.content) > 50 else "")
        supabase.table("conversations")\
            .update({"title": new_title, "updated_at": datetime.utcnow().isoformat()})\
            .eq("id", conversation["id"])\
            .execute()

    # Get provider
    if model_info.provider == "google":
        provider = get_gemini_provider()
    else:
        provider = get_anthropic_provider()

    async def generate():
        full_response = []
        try:
            # Send conversation_id first
            yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation['id']})}\n\n"
            
            async for chunk in provider.generate_stream(message_history, request.model):
                full_response.append(chunk.get("content", ""))
                yield f"data: {json.dumps(chunk)}\n\n"
            
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
            # Store the complete response
            assistant_message = {
                "id": str(uuid.uuid4()),
                "conversation_id": conversation["id"],
                "role": "assistant",
                "content": "".join(full_response),
                "created_at": datetime.utcnow().isoformat(),
            }
            supabase.table("messages").insert(assistant_message).execute()
                
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations():
    """List all conversations."""
    supabase = get_supabase()
    result = supabase.table("conversations")\
        .select("*")\
        .order("updated_at", desc=True)\
        .execute()
    
    return [
        ConversationSummary(
            id=conv["id"],
            title=conv["title"],
            model=conv["model"],
            created_at=conv["created_at"],
            updated_at=conv["updated_at"],
        )
        for conv in result.data
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: str):
    """Get a conversation with all messages."""
    supabase = get_supabase()
    
    # Get conversation
    conv_result = supabase.table("conversations").select("*").eq("id", conversation_id).execute()
    if not conv_result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation = conv_result.data[0]
    
    # Get messages
    messages_result = supabase.table("messages")\
        .select("*")\
        .eq("conversation_id", conversation_id)\
        .order("created_at")\
        .execute()

    return ConversationDetail(
        id=conversation["id"],
        title=conversation["title"],
        model=conversation["model"],
        messages=[
            MessageOut(
                id=msg["id"],
                role=msg["role"],
                content=msg["content"],
                created_at=msg["created_at"],
            )
            for msg in messages_result.data
        ],
        created_at=conversation["created_at"],
        updated_at=conversation["updated_at"],
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    supabase = get_supabase()
    
    # Check if exists
    result = supabase.table("conversations").select("id").eq("id", conversation_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete messages first (foreign key)
    supabase.table("messages").delete().eq("conversation_id", conversation_id).execute()
    # Delete conversation
    supabase.table("conversations").delete().eq("id", conversation_id).execute()
    
    return {"status": "deleted"}
