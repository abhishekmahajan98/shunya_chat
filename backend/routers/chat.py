from fastapi import APIRouter, HTTPException, Header, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
import json
import uuid
from datetime import datetime
from typing import Optional

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


async def generate_title(conversation_id: str, content: str):
    """Generate a short title using Gemini Flash."""
    try:
        provider = get_gemini_provider()
        prompt = [
            {"role": "user", "content": f"Summarize the following message into a short, concise title (max 5-6 words) for a chat history. Do not use quotes:\n\n{content}"}
        ]
        
        # Use Gemini Flash for speed
        title = await provider.generate(prompt, "gemini-3-flash-preview")
        title = title.strip().strip('"').strip("'")
        
        supabase = get_supabase()
        supabase.table("conversations").update({"title": title, "updated_at": datetime.utcnow().isoformat()}).eq("id", conversation_id).execute()
    except Exception as e:
        print(f"Failed to generate title: {str(e)}")


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    """Get available models."""
    return AVAILABLE_MODELS


@router.post("/upload")
async def upload_file(file: UploadFile, user_id: Optional[str] = Depends(get_optional_user_id)):
    """Upload a file to Supabase storage."""
    # if not user_id:
    #     raise HTTPException(status_code=401, detail="Not authenticated")
    
    supabase = get_supabase()
    file_content = await file.read()
    
    # Generate unique path
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'bin'
    file_path = f"{uuid.uuid4()}.{file_ext}"
    
    try:
        # Upload to 'chat-attachments' bucket
        supabase.storage.from_("chat-attachments").upload(
            file_path,
            file_content,
            {"content-type": file.content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_("chat-attachments").get_public_url(file_path)
        
        return {
            "url": public_url,
            "path": file_path,
            "name": file.filename,
            "type": file.content_type,
            "size": len(file_content)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/chat", response_model=MessageResponse)
async def send_message(request: MessageCreate, background_tasks: BackgroundTasks, user_id: Optional[str] = Depends(get_optional_user_id)):
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
            "user_id": user_id,
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
        "attachments": [a.model_dump() for a in request.attachments] if request.attachments else []
    }
    supabase.table("messages").insert(user_message).execute()

    # Build message history for LLM
    messages_result = supabase.table("messages")\
        .select("*")\
        .eq("conversation_id", conversation["id"])\
        .order("created_at")\
        .execute()
    
    # Pass full message objects including attachments to provider
    message_history = []
    for msg in messages_result.data:
        history_msg = {"role": msg["role"], "content": msg["content"]}
        if msg.get("attachments"):
            history_msg["attachments"] = msg["attachments"]
        message_history.append(history_msg)

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
        background_tasks.add_task(generate_title, conversation["id"], request.content)

    return MessageResponse(
        conversation_id=conversation["id"],
        message_id=assistant_message_id,
        role="assistant",
        content=response_text,
    )


@router.post("/chat/stream")
async def send_message_stream(request: MessageCreate, background_tasks: BackgroundTasks, user_id: Optional[str] = Depends(get_optional_user_id)):
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
            "user_id": user_id,
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
        "attachments": [a.model_dump() for a in request.attachments] if request.attachments else []
    }
    supabase.table("messages").insert(user_message).execute()

    # Build message history
    messages_result = supabase.table("messages")\
        .select("*")\
        .eq("conversation_id", conversation["id"])\
        .order("created_at")\
        .execute()
    
    message_history = []
    for msg in messages_result.data:
        history_msg = {"role": msg["role"], "content": msg["content"]}
        if msg.get("attachments"):
            history_msg["attachments"] = msg["attachments"]
        message_history.append(history_msg)

    # Update title if first message
    if len(messages_result.data) == 1:
        background_tasks.add_task(generate_title, conversation["id"], request.content)

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
async def list_conversations(
    user_id: Optional[str] = Depends(get_optional_user_id),
    limit: int = 20,
    offset: int = 0
):
    """List conversations for the authenticated user with pagination."""
    if not user_id:
        return []
        
    supabase = get_supabase()
    result = supabase.table("conversations")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("updated_at", desc=True)\
        .range(offset, offset + limit - 1)\
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
async def get_conversation(conversation_id: str, user_id: Optional[str] = Depends(get_optional_user_id)):
    """Get a conversation with all messages."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    supabase = get_supabase()
    
    # Get conversation
    conv_result = supabase.table("conversations").select("*").eq("id", conversation_id).eq("user_id", user_id).execute()
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
                attachments=msg.get("attachments"),
                reasoning=msg.get("reasoning")
            )
            for msg in messages_result.data
        ],
        created_at=conversation["created_at"],
        updated_at=conversation["updated_at"],
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user_id: Optional[str] = Depends(get_optional_user_id)):
    """Delete a conversation."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    supabase = get_supabase()
    
    # Check if exists and belongs to user
    result = supabase.table("conversations").select("id").eq("id", conversation_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete messages first (foreign key)
    supabase.table("messages").delete().eq("conversation_id", conversation_id).execute()
    # Delete conversation
    supabase.table("conversations").delete().eq("id", conversation_id).execute()
    
    return {"status": "deleted"}


@router.post("/chat/agent")
async def send_message_with_agents(request: MessageCreate, background_tasks: BackgroundTasks, user_id: Optional[str] = Depends(get_optional_user_id)):
    """
    Stream a message response using the LangGraph agent system.
    Agents are automatically activated based on user intent.
    """
    from langchain_core.messages import HumanMessage
    from agents.graph import get_agent_graph
    from agents.state import AGENT_REGISTRY
    
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
        # Create title from first 30 chars of message
        title = request.content[:30].strip()
        if len(request.content) > 30:
            title += "..."
        conversation = {
            "id": conversation_id,
            "title": title,
            "model": request.model,
            "user_id": user_id,
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
        "attachments": [a.model_dump() for a in request.attachments] if request.attachments else []
    }
    supabase.table("messages").insert(user_message).execute()

    # Build initial agent state
    initial_state = {
        "messages": [HumanMessage(content=request.content)],
        "conversation_id": conversation["id"],
        "current_model": request.model,
        "user_active_agents": request.active_agents,  # From frontend toggle
        "active_agents": [],
        "execution_mode": "sequential",
        "agent_results": [],
        "final_response": None
    }

    async def generate():
        try:
            # Send conversation_id first
            yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation['id']})}\n\n"
            
            # Get the agent graph
            graph = get_agent_graph()
            
            # Stream through the graph
            final_response = ""
            active_agents = []
            collected_results = []
            
            async for event in graph.astream(initial_state, stream_mode="updates"):
                for node_name, node_output in event.items():
                    # Skip if node output is None
                    if node_output is None:
                        continue
                    
                    # Send agent status updates
                    if node_name == "router":
                        active_agents = node_output.get("active_agents", [])
                        if active_agents:
                            for agent in active_agents:
                                agent_info = AGENT_REGISTRY.get(agent, {"name": agent})
                                yield f"data: {json.dumps({'type': 'agent_status', 'agent': agent, 'name': agent_info['name'], 'status': 'starting'})}\n\n"
                    
                    elif node_name == "executor":
                        # MCP executor completed - collect all results
                        results = node_output.get("agent_results", [])
                        for result in results:
                            collected_results.append(result)
                            yield f"data: {json.dumps({'type': 'agent_result', 'agent': result.get('agent', 'unknown'), 'status': result.get('status', 'unknown'), 'data': result})}\n\n"
                    
                    elif node_name == "synthesizer":
                        # Check if synthesis is needed
                        needs_synthesis = node_output.get("needs_synthesis", False)
                        if needs_synthesis:
                            synthesis_prompt = node_output.get("synthesis_prompt", "")
            
            # Stream the synthesis response in real-time
            thinking_content = ""
            if collected_results:
                from agents.synthesizer import stream_synthesize
                
                # Build prompt from collected results
                from agents.synthesizer import _build_prompt
                user_msg = request.content
                prompt = _build_prompt(collected_results, user_msg)
                
                # Stream thinking and text in real-time
                async for chunk in stream_synthesize(prompt, request.model):
                    yield f"data: {json.dumps(chunk)}\n\n"
                    if chunk["type"] == "text":
                        final_response += chunk["content"]
                    elif chunk["type"] == "thinking":
                        thinking_content += chunk["content"]
                
                # Extract and stream citations
                citations = []
                for result in collected_results:
                    if result.get("agent") == "search" and "citations" in result:
                        citations.extend(result["citations"])
                
                if citations:
                    # Format citations for frontend
                    formatted_citations = [{"id": str(i+1), "title": c, "page": None} for i, c in enumerate(citations)]
                    yield f"data: {json.dumps({'type': 'citations', 'citations': formatted_citations})}\n\n"
            else:
                # No agents activated - use direct LLM
                if model_info.provider == "google":
                    provider = get_gemini_provider()
                else:
                    provider = get_anthropic_provider()
                
                # Fetch message history for context
                messages_result = supabase.table("messages")\
                    .select("*")\
                    .eq("conversation_id", conversation["id"])\
                    .order("created_at")\
                    .execute()
                
                message_history = []
                for msg in messages_result.data:
                    history_msg = {"role": msg["role"], "content": msg["content"]}
                    if msg.get("attachments"):
                        history_msg["attachments"] = msg["attachments"]
                    message_history.append(history_msg)
                
                full_response = []
                final_response = ""
                async for chunk in provider.generate_stream(message_history, request.model):
                    yield f"data: {json.dumps(chunk)}\n\n"
                    if chunk.get("type") == "text":
                        content = chunk.get("content", "")
                        final_response += content
                    elif chunk.get("type") == "thinking":
                        thinking_content += chunk.get("content", "")

            
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
            # Store the complete response
            if final_response:
                reasoning_data = {
                    "steps": [{
                        "id": "1",
                        "text": thinking_content,
                        "status": "complete"
                    }] 
                } if thinking_content else None

                assistant_message = {
                    "id": str(uuid.uuid4()),
                    "conversation_id": conversation["id"],
                    "role": "assistant",
                    "content": final_response,
                    "created_at": datetime.utcnow().isoformat(),
                    "reasoning": reasoning_data,
                }
                supabase.table("messages").insert(assistant_message).execute()
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

