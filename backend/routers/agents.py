"""
Agent Registry API.
Provides endpoints for listing agents and managing favorites.
Uses Supabase DB for persistence.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from database import get_supabase
from routers.auth import get_current_user

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


class RegisterAgentRequest(BaseModel):
    """Schema for registering a new agent."""
    id: str
    name: str
    icon: str
    description: str
    category: str  # research | compliance | finance | automation
    url: str


def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Get user if authenticated, otherwise return None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization.replace("Bearer ", "")
    supabase = get_supabase()
    
    try:
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return {
                "id": user_response.user.id,
                "email": user_response.user.email,
            }
    except Exception:
        pass
    
    return None


@router.get("")
async def list_agents(user: Optional[dict] = Depends(get_optional_user)) -> list[dict]:
    """
    List all registered agents with their metadata.
    Used by the agent marketplace UI.
    """
    supabase = get_supabase()
    
    # Get all agents from DB
    result = supabase.table("agents").select("*").execute()
    agents = result.data or []
    
    # Get user favorites if authenticated
    favorites = set()
    if user:
        favs_result = supabase.table("user_favorites").select("agent_id").eq("user_id", user["id"]).execute()
        favorites = {f["agent_id"] for f in (favs_result.data or [])}
    
    # Transform to response format
    response = []
    for agent in agents:
        response.append({
            "id": agent["id"],
            "name": agent["name"],
            "icon": agent["icon"],
            "description": agent["description"],
            "category": agent["category"],
            "url": agent["url"],
            "hasAccess": agent.get("has_access", True),
            "isFavorite": agent["id"] in favorites,
        })
    
    return response


@router.post("")
async def register_agent(request: RegisterAgentRequest, user: dict = Depends(get_current_user)) -> dict:
    """
    Register a new agent in the system.
    Requires authentication.
    """
    supabase = get_supabase()
    
    # Check if agent ID already exists
    existing = supabase.table("agents").select("id").eq("id", request.id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail=f"Agent ID '{request.id}' already exists")
    
    # Insert new agent
    new_agent = {
        "id": request.id,
        "name": request.name,
        "icon": request.icon,
        "description": request.description,
        "category": request.category,
        "url": request.url,
        "has_access": True,  # Default to true for now
    }
    
    try:
        supabase.table("agents").insert(new_agent).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return {
        "id": request.id,
        "status": "created"
    }


@router.get("/favorites")
async def list_favorites(user: dict = Depends(get_current_user)) -> list[dict]:
    """
    List user's favorite agents.
    Requires authentication.
    """
    supabase = get_supabase()
    
    # Get user's favorite agent IDs
    favs_result = supabase.table("user_favorites").select("agent_id").eq("user_id", user["id"]).execute()
    favorite_ids = {f["agent_id"] for f in (favs_result.data or [])}
    
    if not favorite_ids:
        return []
    
    # Get agent details for favorites
    result = supabase.table("agents").select("*").in_("id", list(favorite_ids)).execute()
    agents = result.data or []
    
    # Transform to response format
    return [{
        "id": agent["id"],
        "name": agent["name"],
        "icon": agent["icon"],
        "description": agent["description"],
        "category": agent["category"],
        "url": agent["url"],
        "hasAccess": agent.get("has_access", True),
        "isFavorite": True,
    } for agent in agents]


@router.put("/{agent_id}/favorite")
async def toggle_favorite(agent_id: str, user: dict = Depends(get_current_user)) -> dict:
    """
    Toggle favorite status for an agent.
    Requires authentication.
    Returns the new favorite state.
    """
    supabase = get_supabase()
    
    # Check if agent exists
    agent_result = supabase.table("agents").select("id").eq("id", agent_id).execute()
    if not agent_result.data:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")
    
    # Check if already favorited
    existing = supabase.table("user_favorites").select("id").eq("user_id", user["id"]).eq("agent_id", agent_id).execute()
    
    if existing.data:
        # Remove favorite
        supabase.table("user_favorites").delete().eq("user_id", user["id"]).eq("agent_id", agent_id).execute()
        is_favorite = False
    else:
        # Add favorite
        supabase.table("user_favorites").insert({
            "user_id": user["id"],
            "agent_id": agent_id
        }).execute()
        is_favorite = True
    
    return {
        "id": agent_id,
        "isFavorite": is_favorite
    }
