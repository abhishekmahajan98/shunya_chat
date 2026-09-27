"""
MCP Search Server (Perplexity).
Mounted at /mcp/search
"""
from __future__ import annotations

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastmcp import FastMCP

# Prefer backend/.env, fall back to this folder's .env
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
load_dotenv(Path(__file__).parent / ".env")

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
PERPLEXITY_MODEL = os.getenv("PERPLEXITY_MODEL", "sonar")

mcp = FastMCP("search")


@mcp.tool()
async def search(query: str) -> dict:
    """Search the web using Perplexity. Use for current events, docs, and factual lookups.

    Args:
        query: The search query to look up
    """
    if not PERPLEXITY_API_KEY:
        return {"status": "error", "error": "PERPLEXITY_API_KEY not configured"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": PERPLEXITY_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a helpful search assistant. "
                                "Provide concise, factual answers with sources."
                            ),
                        },
                        {"role": "user", "content": query},
                    ],
                },
                timeout=90.0,
            )

            if response.status_code != 200:
                return {
                    "status": "error",
                    "error": f"API error {response.status_code}: {response.text[:500]}",
                }

            data = response.json()
            answer = data["choices"][0]["message"]["content"]
            citations = data.get("citations", [])
            return {
                "status": "success",
                "query": query,
                "answer": answer,
                "citations": citations,
            }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=8001)
