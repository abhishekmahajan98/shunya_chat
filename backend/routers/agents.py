"""
Agent Registry API.
Provides endpoints for listing agents and managing favorites.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from agents.mcp_client import get_mcp_client

router = APIRouter(prefix="/api/agents", tags=["agents"])


class AgentResponse(BaseModel):
    """Agent response schema for frontend."""
    id: str
    name: str
    icon: str
    description: str
    category: str  # research | compliance | finance | automation
    url: str
    hasAccess: bool


# In-memory storage for user favorites (would be in DB in production)
# Key: user_id (hardcoded to "default" for now), Value: set of agent IDs
_user_favorites: dict[str, set[str]] = {
    "default": set()
}


def get_user_favorites(user_id: str = "default") -> set[str]:
    """Get favorites for a user."""
    return _user_favorites.get(user_id, set())


def toggle_user_favorite(user_id: str, agent_id: str) -> bool:
    """Toggle favorite status, returns new state."""
    if user_id not in _user_favorites:
        _user_favorites[user_id] = set()
    
    if agent_id in _user_favorites[user_id]:
        _user_favorites[user_id].remove(agent_id)
        return False
    else:
        _user_favorites[user_id].add(agent_id)
        return True


@router.get("")
async def list_agents() -> list[dict]:
    """
    List all registered agents with their metadata.
    Used by the agent marketplace UI.
    """
    mcp_client = get_mcp_client()
    agents = mcp_client.get_all_agents()
    
    # Add isFavorite status
    favorites = get_user_favorites()
    for agent in agents:
        agent["isFavorite"] = agent["id"] in favorites
    
    return agents


@router.get("/favorites")
async def list_favorites() -> list[dict]:
    """
    List user's favorite agents.
    """
    mcp_client = get_mcp_client()
    all_agents = mcp_client.get_all_agents()
    favorites = get_user_favorites()
    
    favorite_agents = [
        {**agent, "isFavorite": True}
        for agent in all_agents
        if agent["id"] in favorites
    ]
    
    return favorite_agents


@router.put("/{agent_id}/favorite")
async def toggle_favorite(agent_id: str) -> dict:
    """
    Toggle favorite status for an agent.
    Returns the new favorite state.
    """
    mcp_client = get_mcp_client()
    server = mcp_client.get_server_by_id(agent_id)
    
    if not server:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")
    
    is_favorite = toggle_user_favorite("default", agent_id)
    
    return {
        "id": agent_id,
        "isFavorite": is_favorite
    }
