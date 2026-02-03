"""
MCP Search Server using FastMCP.
Exposes a search tool that uses Perplexity API.
Runs as an HTTP server on port 8001.
"""
import os
from pathlib import Path
import httpx
from fastmcp import FastMCP
from dotenv import load_dotenv

# Load .env from this directory (mcp_servers/search/.env)
load_dotenv(Path(__file__).parent / ".env")

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")

# Create FastMCP server with HTTP transport
mcp = FastMCP(
    "search",
    host="0.0.0.0",
    port=8001,
)


@mcp.tool()
async def search(query: str) -> dict:
    """
    Search the web using Perplexity API.
    
    Args:
        query: The search query to look up
        
    Returns:
        A dict with 'answer' (the search result) and 'citations' (list of sources)
    """
    if not PERPLEXITY_API_KEY:
        return {
            "status": "error",
            "error": "PERPLEXITY_API_KEY not configured"
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
                    "model": "sonar-reasoning-pro",
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
                    "status": "success",
                    "query": query,
                    "answer": answer,
                    "citations": citations
                }
            else:
                error_body = response.text[:500] if response.text else "No response body"
                return {
                    "status": "error",
                    "error": f"API error {response.status_code}: {error_body}"
                }
                
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


if __name__ == "__main__":
    # Run with SSE transport on port 8001
    mcp.run(transport="sse")
