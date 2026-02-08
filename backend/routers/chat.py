from fastapi import APIRouter, HTTPException, Header, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from config import settings, AVAILABLE_MODELS, ModelInfo, get_model_info, AgentModels
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
    """Generate a short title using the configured model."""
    try:
        # Select provider based on config
        if AgentModels.TITLE_PROVIDER == "google":
            provider = get_gemini_provider()
        else:
            provider = get_anthropic_provider()
            
        prompt = [
            {"role": "user", "content": f"Summarize the following message into a short, concise title (max 5-6 words) for a chat history. Do not use quotes:\n\n{content}"}
        ]
        
        # Use title generation model from config
        title = await provider.generate(prompt, AgentModels.TITLE_MODEL)
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

@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    skip: int = 0, 
    limit: int = 20, 
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """List conversations with pagination."""
    supabase = get_supabase()
    
    query = supabase.table("conversations")\
        .select("*")\
        .order("updated_at", desc=True)\
        .range(skip, skip + limit - 1)
        
    if user_id:
        query = query.eq("user_id", user_id)
        
    result = query.execute()
    return result.data


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: str, user_id: Optional[str] = Depends(get_optional_user_id)):
    """Get conversation details with messages."""
    supabase = get_supabase()
    
    # Get conversation
    result = supabase.table("conversations").select("*").eq("id", conversation_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation = result.data[0]
    
    # Check ownership if user_id is provided
    # if user_id and conversation.get("user_id") and conversation["user_id"] != user_id:
    #     raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get messages
    messages_result = supabase.table("messages")\
        .select("*")\
        .eq("conversation_id", conversation_id)\
        .order("created_at")\
        .execute()
        
    return {**conversation, "messages": messages_result.data}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user_id: Optional[str] = Depends(get_optional_user_id)):
    """Delete a conversation."""
    supabase = get_supabase()
    
    # Check existence
    result = supabase.table("conversations").select("*").eq("id", conversation_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Delete (cascading delete handled by DB usually, but we delete explicitly if needed)
    supabase.table("conversations").delete().eq("id", conversation_id).execute()
    
    return {"status": "success"}
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
    """
    Unified streaming chat endpoint.
    Routes to LangGraph agent system if active_agents are present,
    otherwise uses standard LLM streaming.
    """
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

    # Check if we should use Agents
    use_agents = request.active_agents and len(request.active_agents) > 0

    if use_agents:
        # --- AGENT FLOW ---
        from langchain_core.messages import HumanMessage
        from agents.graph import get_agent_graph
        
        # Fetch conversation history for context
        from langchain_core.messages import HumanMessage, AIMessage
        history_result = supabase.table("messages")\
            .select("*")\
            .eq("conversation_id", conversation["id"])\
            .order("created_at", desc=True)\
            .limit(15)\
            .execute()
        
        # Reverse to get chronological order
        history_data = reversed(history_result.data)
        lc_messages = []
        for msg in history_data:
            if msg["role"] == "user":
                lc_messages.append(HumanMessage(content=msg["content"]))
            else:
                lc_messages.append(AIMessage(content=msg.get("content", "")))

        # Build initial agent state
        initial_state = {
            "messages": lc_messages,
            "conversation_id": conversation["id"],
            "current_model": request.model,
            "user_active_agents": request.active_agents,
            "active_agents": [],
            "execution_mode": "sequential",
            "agent_results": [],
            "final_response": None
        }

        async def generate_agent_stream():
            import asyncio
            stream_queue = asyncio.queue() if hasattr(asyncio, 'queue') else asyncio.Queue()
            citation_counter = 1 # Sequential ID for citations

            async def run_graph_background(): 
                try:
                    graph = get_agent_graph()
                    async for event in graph.astream(initial_state, stream_mode="updates", config={"configurable": {"queue": stream_queue}}):
                         for node_name, node_output in event.items():
                            if node_output is None:
                                continue
                            
                            if node_name == "router":
                                active_agents = node_output.get("active_agents", [])
                                if active_agents:
                                    await stream_queue.put({"type": "plan_created", "plan": active_agents})
                                    from agents.mcp_client import get_mcp_client
                                    mcp_client = get_mcp_client()
                                    for step in active_agents:
                                        agent_id = step.get("agent", "unknown")
                                        server_config = mcp_client.get_server_by_id(agent_id)
                                        agent_name = server_config.name if server_config else agent_id
                                        await stream_queue.put({
                                            "type": "agent_status",
                                            "id": step.get("id") or f"agent-{agent_id}",
                                            "agent": agent_id,
                                            "name": agent_name,
                                            "goal": step.get('goal'),
                                            "status": "pending"
                                        })
                                else:
                                    # Emit empty plan to close the "Analyzing..." step in UI
                                    await stream_queue.put({"type": "plan_created", "plan": []})

                            elif node_name == "executor":
                                results = node_output.get("agent_results", [])
                                for result in results:
                                    # SKIP sending agent_result here because it was already streamed by mcp_executor_node
                                    # to the queue. Sending it again causes duplication in frontend.
                                    
                                    if result.get('citations'):
                                        citation_list = []
                                        nonlocal citation_counter
                                        for url in result['citations']:
                                            citation_list.append({"id": str(citation_counter), "title": url, "url": url})
                                            citation_counter += 1
                                        await stream_queue.put({"type": "citations", "citations": citation_list})

                            elif node_name == "synthesizer":
                                if node_output.get("needs_synthesis", False):
                                    from agents.synthesizer import stream_synthesize
                                    async for chunk in stream_synthesize(node_output.get("synthesis_prompt"), request.model):
                                        await stream_queue.put(chunk)
                                        if chunk["type"] == "text":
                                           await stream_queue.put({"type": "internal_accumulate", "content": chunk["content"]})
                                        elif chunk["type"] == "thinking":
                                           await stream_queue.put({"type": "internal_accumulate_thinking", "content": chunk["content"]})

                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    await stream_queue.put({"type": "error", "content": f"Graph Error: {str(e)}"})
                finally:
                    await stream_queue.put(None)

            asyncio.create_task(run_graph_background())
            yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation['id']})}\n\n"
            
            thinking_content = ""
            final_response = ""
            collected_results = []
            reasoning_steps = []

            try:
                while True:
                    item = await stream_queue.get()
                    if item is None:
                        break
                    
                    if item.get("type") == "internal_accumulate":
                        final_response += item.get("content", "")
                        continue
                    elif item.get("type") == "internal_accumulate_thinking":
                        thinking_content += item.get("content", "")
                        continue
                    
                    item_type = item.get("type")
                    if item_type == "plan_created":
                        for plan_item in item.get("plan", []):
                            reasoning_steps.append({
                                "id": plan_item.get("id") or f"agent-{plan_item.get('agent')}",
                                "text": f"{plan_item.get('agent')}: {plan_item.get('goal')}",
                                "status": "pending"
                            })
                    elif item_type == "tool_start":
                        tool_run_id = item.get("tool_run_id")
                        # Create unique ID for the tool step
                        tool_id = f"tool-{tool_run_id}" if tool_run_id else f"tool-{uuid.uuid4()}"
                        tool_name = item.get("tool_name", "Tool")
                        input_val = item.get("input", "")
                        text = f"Using {tool_name}: {input_val}"
                        
                        tool_step = {"id": tool_id, "text": text, "status": "running"}
                        parent_id = item.get("parent_id")
                        
                        if parent_id:
                            try:
                                # Find parent index
                                parent_idx = next(i for i, s in enumerate(reasoning_steps) if s["id"] == parent_id)
                                # Insert after parent and any existing tool children
                                insert_idx = parent_idx + 1
                                while insert_idx < len(reasoning_steps) and reasoning_steps[insert_idx]["id"].startswith("tool-"):
                                    insert_idx += 1
                                reasoning_steps.insert(insert_idx, tool_step)
                            except StopIteration:
                                # Parent not found, append
                                reasoning_steps.append(tool_step)
                        else:
                             reasoning_steps.append(tool_step)

                    elif item_type == "tool_end":
                         tool_run_id = item.get("tool_run_id")
                         target_id = f"tool-{tool_run_id}" if tool_run_id else None
                         output = item.get("output")
                         
                         if target_id:
                             for s in reasoning_steps:
                                 if s["id"] == target_id:
                                     s["status"] = "complete"
                                     if output: s["text"] += f" -> {output}"
                                     break
                    
                    elif item_type == "tool_error":
                         tool_run_id = item.get("tool_run_id")
                         target_id = f"tool-{tool_run_id}" if tool_run_id else None
                         error = item.get("error")
                         
                         if target_id:
                             for s in reasoning_steps:
                                 if s["id"] == target_id:
                                     s["status"] = "failed"
                                     if error: s["text"] += f" (Error: {error})"
                                     break

                    elif item_type == "agent_status":
                        # Only handles AGENT status updates (running -> complete/failed)
                        # No tool logic here anymore.
                        goal = item.get("goal", "")
                        status = item.get("status")
                        agent_id = item.get("agent")
                        name = item.get("name") or agent_id
                        
                        # Use same ID format as plan_created
                        unique_id = item.get("id") or f"agent-{agent_id}"

                        for s in reasoning_steps:
                            if s["id"] == unique_id:
                                if status: s["status"] = status
                                if goal and not goal.startswith("Using"):
                                    s["text"] = f"{name}: {goal}"
                                break
                    elif item_type == "agent_result":
                        collected_results.append(item)
                        # CRITICAL: Match plan ID
                        unique_id = item.get("id") or f"agent-{item.get('agent')}"
                        for s in reasoning_steps:
                            if s["id"] == unique_id:
                                s["status"] = "complete"
                                if item.get("data"):
                                    s["text"] += " ✓"
                                break
                    
                    yield f"data: {json.dumps(item)}\n\n"
                
                if not collected_results and not final_response:
                     messages_result = supabase.table("messages").select("*").eq("conversation_id", conversation["id"]).order("created_at").execute()
                     message_history = [{"role": msg["role"], "content": msg["content"], "attachments": msg.get("attachments")} for msg in messages_result.data]
                     if model_info.provider == "google": provider = get_gemini_provider()
                     else: provider = get_anthropic_provider()
                     async for chunk in provider.generate_stream(message_history, request.model):
                        if chunk.get("type") == "text": final_response += chunk.get("content", "")
                        elif chunk.get("type") == "thinking": thinking_content += chunk.get("content", "")
                        yield f"data: {json.dumps(chunk)}\n\n"

            except Exception as e:
                import traceback
                print(f"Error in stream processing loop: {e}")
                traceback.print_exc()
                yield f"data: {json.dumps({'type': 'error', 'content': f'Internal Processing Error: {str(e)}'})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

            if final_response:
                if thinking_content:
                    reasoning_steps.append({"id": "thinking", "text": thinking_content, "status": "complete"})
                reasoning_data = {"steps": reasoning_steps, "isExpanded": True} if reasoning_steps else None
                assistant_message = {
                    "id": str(uuid.uuid4()),
                    "conversation_id": conversation["id"],
                    "role": "assistant",
                    "content": final_response,
                    "created_at": datetime.utcnow().isoformat(),
                    "reasoning": reasoning_data,
                }
                supabase.table("messages").insert(assistant_message).execute()

                # Update title if first message
                if len(history_result.data) == 1:
                    background_tasks.add_task(generate_title, conversation["id"], request.content)
                
        return StreamingResponse(
            generate_agent_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    else:
        # --- STANDARD FLOW ---
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

        async def generate_standard_stream():
            full_response = []
            thinking_content = ""
            try:
                # Send conversation_id first
                yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation['id']})}\n\n"
                
                async for chunk in provider.generate_stream(message_history, request.model):
                    if chunk.get("type") == "text":
                        full_response.append(chunk.get("content", ""))
                    elif chunk.get("type") == "thinking":
                        thinking_content += chunk.get("content", "")
                        
                    yield f"data: {json.dumps(chunk)}\n\n"
                
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                
                # Store the complete response
                reasoning_data = {
                    "steps": [{
                        "id": "thinking",
                        "text": thinking_content,
                        "status": "complete"
                    }] 
                } if thinking_content else None
                
                assistant_message = {
                    "id": str(uuid.uuid4()),
                    "conversation_id": conversation["id"],
                    "role": "assistant",
                    "content": "".join(full_response),
                    "created_at": datetime.utcnow().isoformat(),
                    "reasoning": reasoning_data,
                }
                supabase.table("messages").insert(assistant_message).execute()
                    
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

        return StreamingResponse(
            generate_standard_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

