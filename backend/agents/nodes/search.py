"""
Perplexity Search Agent Node.
Searches the web using Perplexity API.
"""
import os
import httpx
from dotenv import load_dotenv
from ..state import AgentState

load_dotenv()

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")


async def search_node(state: AgentState) -> dict:
    """
    Search the web using Perplexity API.
    Returns structured search results to be added to agent_results.
    """
    # Get the user's query from the last message
    last_message = state["messages"][-1]
    query = last_message.content if hasattr(last_message, 'content') else str(last_message)
    
    if not PERPLEXITY_API_KEY:
        return {
            "agent_results": [{
                "agent": "search",
                "status": "error",
                "error": "PERPLEXITY_API_KEY not configured"
            }]
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-sonar-small-128k-online",
                    "messages": [
                        {"role": "system", "content": "You are a helpful search assistant. Provide concise, factual answers with sources."},
                        {"role": "user", "content": query}
                    ]
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                answer = data["choices"][0]["message"]["content"]
                citations = data.get("citations", [])
                
                return {
                    "agent_results": [{
                        "agent": "search",
                        "status": "success",
                        "query": query,
                        "answer": answer,
                        "citations": citations
                    }]
                }
            else:
                return {
                    "agent_results": [{
                        "agent": "search",
                        "status": "error",
                        "error": f"API error: {response.status_code}"
                    }]
                }
                
    except Exception as e:
        return {
            "agent_results": [{
                "agent": "search",
                "status": "error",
                "error": str(e)
            }]
        }
