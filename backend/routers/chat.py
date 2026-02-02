from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db, async_session
from db_models import Conversation, Message
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
async def send_message(
    request: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """Send a message and get AI response."""
    # Validate model
    model_info = get_model_info(request.model)
    if not model_info:
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")

    # Get or create conversation
    if request.conversation_id:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.id == request.conversation_id)
            .options(selectinload(Conversation.messages))
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        # Create new conversation
        conversation = Conversation(model=request.model)
        db.add(conversation)
        await db.flush()

    # Add user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=request.content,
    )
    db.add(user_message)
    await db.flush()

    # Build message history for LLM
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
    )
    all_messages = result.scalars().all()
    
    message_history = [
        {"role": msg.role, "content": msg.content}
        for msg in all_messages
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
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=response_text,
    )
    db.add(assistant_message)

    # Update conversation title if it's the first message
    if len(all_messages) == 1:
        # Use first ~50 chars of user message as title
        conversation.title = request.content[:50] + ("..." if len(request.content) > 50 else "")

    await db.commit()

    return MessageResponse(
        conversation_id=conversation.id,
        message_id=assistant_message.id,
        role="assistant",
        content=response_text,
    )


@router.post("/chat/stream")
async def send_message_stream(
    request: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """Stream a message response using SSE."""
    from fastapi.responses import StreamingResponse
    import json

    # Validate model
    model_info = get_model_info(request.model)
    if not model_info:
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")

    # Get or create conversation
    if request.conversation_id:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.id == request.conversation_id)
            .options(selectinload(Conversation.messages))
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = Conversation(model=request.model)
        db.add(conversation)
        await db.flush()

    # Add user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=request.content,
    )
    db.add(user_message)
    await db.flush()

    # Build message history
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
    )
    all_messages = result.scalars().all()
    message_history = [
        {"role": msg.role, "content": msg.content}
        for msg in all_messages
    ]

    # Update title if first message
    if len(all_messages) == 1:
        conversation.title = request.content[:50] + ("..." if len(request.content) > 50 else "")
    
    await db.commit()

    # Get provider
    if model_info.provider == "google":
        provider = get_gemini_provider()
    else:
        provider = get_anthropic_provider()

    async def generate():
        full_response = []
        try:
            # Send conversation_id first
            yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation.id})}\n\n"
            
            async for chunk in provider.generate_stream(message_history, request.model):
                full_response.append(chunk.get("content", ""))
                yield f"data: {json.dumps(chunk)}\n\n"
            
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
            # Store the complete response
            async with async_session() as save_db:
                assistant_message = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content="".join(full_response),
                )
                save_db.add(assistant_message)
                await save_db.commit()
                
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
async def list_conversations(db: AsyncSession = Depends(get_db)):
    """List all conversations."""
    result = await db.execute(
        select(Conversation).order_by(Conversation.updated_at.desc())
    )
    conversations = result.scalars().all()
    
    return [
        ConversationSummary(
            id=conv.id,
            title=conv.title,
            model=conv.model,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        )
        for conv in conversations
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a conversation with all messages."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        model=conversation.model,
        messages=[
            MessageOut(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                created_at=msg.created_at,
            )
            for msg in conversation.messages
        ],
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conversation)
    await db.commit()
    
    return {"status": "deleted"}
