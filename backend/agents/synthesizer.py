"""
Synthesizer Node.
Combines agent results into a final response for the user.
Supports both Google Gemini and Anthropic Claude models with real-time streaming.
"""
import os
from .state import AgentState
from typing import AsyncGenerator
from config import settings

SYNTHESIZER_PROMPT = """You are a helpful assistant. Based on the following agent results and the user's original question, provide a comprehensive and well-formatted response.

Agent Results:
{agent_results}

Original Question: {user_message}

Current Date: {current_date}

Guidelines:
- Synthesize all relevant information from the agent results
- Use markdown formatting for clarity (headers, lists, tables if appropriate)
- CRITICAL: The search results may contain their own citation numbers. IGNORE THEM.
- ONLY use the citation numbers provided in the "References" list below (e.g. [1], [2]).
- Do NOT use citation numbers that exceed the total count of provided references.
- Use inline citations (e.g. [1], [2]) to refer to these specific sources.
- DO NOT list the sources/references at the end of your response. The user interface displays them automatically.
- Be concise but thorough
- If agents returned errors, acknowledge them gracefully
"""


async def synthesizer_node(state: AgentState) -> dict:
    """
    Synthesize agent results into a final user-facing response.
    Returns state update (non-streaming).
    For streaming, use stream_synthesize() instead.
    """
    last_message = state["messages"][-1]
    user_message = last_message.content if hasattr(last_message, 'content') else str(last_message)
    
    agent_results = state.get("agent_results", [])
    
    # If no agent results, this is a direct LLM response (no agents were activated)
    if not agent_results:
        return {"final_response": None, "thinking": None}
    
    # Just return marker that synthesizer was called - actual streaming happens separately
    return {"needs_synthesis": True, "synthesis_prompt": _build_prompt(agent_results, user_message)}


def _build_prompt(agent_results: list, user_message: str) -> str:
    """Build the synthesis prompt from agent results."""
    results_text = ""
    
    # Map URLs to their global citation IDs to ensure consistency
    url_to_id = {}
    citation_counter = 1
    
    for result in agent_results:
        agent_name = result.get("agent", "Unknown")
        
        # New Hierarchical Format
        if "goal" in result and "result" in result:
            results_text += f"\n### {agent_name.upper()} Agent\n"
            results_text += f"Goal: {result['goal']}\n"
            results_text += f"Result: {result['result']}\n"
            
            if "citations" in result and result["citations"]:
                results_text += "References:\n"
                for url in result["citations"]:
                    if url not in url_to_id:
                        url_to_id[url] = citation_counter
                        citation_counter += 1
                    results_text += f"[{url_to_id[url]}] {url}\n"
            
            continue
            
        # Old Format Logic (Fallback)
        status = result.get("status", "unknown")
        results_text += f"\n### {agent_name.upper()} Agent ({status})\n"
        
        if status == "success":
            if "answer" in result:
                results_text += f"Answer: {result['answer']}\n"
            
            if "citations" in result and result["citations"]:
                results_text += "References:\n"
                for url in result["citations"]:
                    if url not in url_to_id:
                        url_to_id[url] = citation_counter
                        citation_counter += 1
                    results_text += f"[{url_to_id[url]}] {url}\n"
                
            if "data" in result:
                import json
                results_text += f"Retrieved {result.get('record_count', 0)} records:\n"
                results_text += f"```json\n{json.dumps(result['data'], indent=2)}\n```\n"
        else:
            results_text += f"Error: {result.get('error', 'Unknown error')}\n"
    
    from datetime import datetime
    current_date = datetime.now().strftime("%A, %B %d, %Y")
    
    return SYNTHESIZER_PROMPT.format(
        agent_results=results_text,
        user_message=user_message,
        current_date=current_date
    )


def _get_provider(model: str) -> str:
    """Determine provider from model name."""
    if "claude" in model.lower():
        return "anthropic"
    return "google"


async def stream_synthesize(
    prompt: str,
    model: str
) -> AsyncGenerator[dict, None]:
    """
    Stream synthesis response in real-time.
    Yields chunks: {'type': 'thinking'|'text', 'content': str}
    Supports both Google Gemini and Anthropic Claude models.
    """
    provider = _get_provider(model)
    
    if provider == "anthropic":
        async for chunk in _stream_anthropic(prompt, model):
            yield chunk
    else:
        async for chunk in _stream_gemini(prompt, model):
            yield chunk


async def _stream_gemini(prompt: str, model: str) -> AsyncGenerator[dict, None]:
    """Stream using Google Gemini API."""
    from google import genai
    from google.genai.types import GenerateContentConfig, ThinkingConfig, ThinkingLevel
    
    api_key = settings.GOOGLE_API_KEY
    client = genai.Client(api_key=api_key)
    
    # Check if model supports thinking
    is_gemini3 = any(m in model.lower() for m in ["gemini-3", "gemini-2.5", "gemini-2.0", "gemini-exp"])
    
    try:
        if is_gemini3:
            config = GenerateContentConfig(
                thinking_config=ThinkingConfig(
                    include_thoughts=True,
                    thinking_level=ThinkingLevel.HIGH if "pro" in model.lower() else ThinkingLevel.LOW
                ),
                response_modalities=["TEXT"]
            )
            
            response_stream = await client.aio.models.generate_content_stream(
                model=model,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config=config
            )
            
            async for response in response_stream:
                if response.candidates:
                    candidate = response.candidates[0]
                    
                    # Extract citations
                    if hasattr(candidate, 'citation_metadata') and candidate.citation_metadata:
                        citations = []
                        for i, source in enumerate(candidate.citation_metadata.citation_sources):
                            if source.uri:
                                citations.append({
                                    "id": str(i + 1),
                                    "title": source.uri,
                                    "uri": source.uri,
                                    "startIndex": source.start_index,
                                    "endIndex": source.end_index
                                })
                        if citations:
                            yield {"type": "citations", "citations": citations}

                    if candidate.content:
                        for part in candidate.content.parts:
                            # Revert to known working logic: part.text when thought is truthy
                            if getattr(part, 'thought', None):
                                yield {"type": "thinking", "content": part.text}
                            elif getattr(part, 'text', None):
                                yield {"type": "text", "content": part.text}
        else:
            response_stream = await client.aio.models.generate_content_stream(
                model=model,
                contents=[{"role": "user", "parts": [{"text": prompt}]}]
            )
            
            async for response in response_stream:
                if response.candidates:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'citation_metadata') and candidate.citation_metadata:
                        citations = []
                        for i, source in enumerate(candidate.citation_metadata.citation_sources):
                            if source.uri:
                                citations.append({"id": str(i+1), "title": source.uri, "uri": source.uri})
                        if citations:
                            yield {"type": "citations", "citations": citations}

                if response.text:
                    yield {"type": "text", "content": response.text}
                    
    except Exception as e:
        yield {"type": "text", "content": f"Error generating response: {str(e)}"}


async def _stream_anthropic(prompt: str, model: str) -> AsyncGenerator[dict, None]:
    """Stream using Anthropic Claude API."""
    import anthropic
    
    api_key = settings.ANTHROPIC_API_KEY
    client = anthropic.AsyncAnthropic(api_key=api_key)
    
    # Check if model supports extended thinking
    is_thinking_model = "thinking" in model.lower()
    
    try:
        if is_thinking_model:
            # Use extended thinking for thinking models
            # Strip "-thinking" suffix for the actual model name
            base_model = model.replace("-thinking", "")
            
            async with client.messages.stream(
                model=base_model,
                max_tokens=16000,
                thinking={
                    "type": "enabled",
                    "budget_tokens": 10000
                },
                messages=[{"role": "user", "content": prompt}]
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_delta":
                        if hasattr(event.delta, 'thinking'):
                            yield {"type": "thinking", "content": event.delta.thinking}
                        elif hasattr(event.delta, 'text'):
                            yield {"type": "text", "content": event.delta.text}
        else:
            # Standard streaming for non-thinking models
            async with client.messages.stream(
                model=model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}]
            ) as stream:
                async for text in stream.text_stream:
                    yield {"type": "text", "content": text}
                    
    except Exception as e:
        yield {"type": "text", "content": f"Error generating response: {str(e)}"}
