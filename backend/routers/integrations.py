"""OAuth MCP / API-key integrations — driven by DB agent auth type."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from auth import DummyUser, get_current_user
from db.agents import OAUTH_AUTH_TYPES, get_agent
from integrations.service import (
    disconnect,
    finish_connect,
    list_integration_status,
    save_api_key,
    start_connect,
)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


class ApiKeyBody(BaseModel):
    api_key: str = Field(min_length=1)


@router.get("")
async def list_integrations(user: DummyUser = Depends(get_current_user)):
    return list_integration_status(user.id)


@router.get("/{agent_id}/connect")
async def connect_agent(agent_id: str, user: DummyUser = Depends(get_current_user)):
    agent = get_agent(agent_id)
    if not agent or agent.auth not in OAUTH_AUTH_TYPES:
        raise HTTPException(status_code=404, detail=f"OAuth agent not found: {agent_id}")
    try:
        url = await start_connect(user.id, agent_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return RedirectResponse(url, status_code=302)


@router.get("/{agent_id}/callback")
async def oauth_callback(
    agent_id: str,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    error_description: str | None = Query(None),
):
    if error:
        from integrations.service import frontend_redirect

        return RedirectResponse(
            frontend_redirect(agent_id, "error", error_description or error),
            status_code=302,
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")
    redirect_url = await finish_connect(agent_id, code=code, state=state)
    return RedirectResponse(redirect_url, status_code=302)


@router.put("/{agent_id}/api-key")
async def put_api_key(
    agent_id: str,
    body: ApiKeyBody,
    user: DummyUser = Depends(get_current_user),
):
    agent = get_agent(agent_id)
    if not agent or agent.auth != "user_api_key":
        raise HTTPException(status_code=404, detail=f"API-key agent not found: {agent_id}")
    try:
        await save_api_key(user.id, agent_id, body.api_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "agent_id": agent_id, "connected": True}


@router.delete("/{agent_id}")
async def disconnect_agent(agent_id: str, user: DummyUser = Depends(get_current_user)):
    agent = get_agent(agent_id)
    if not agent or not agent.needs_user_credential:
        raise HTTPException(status_code=404, detail=f"Unknown integration agent: {agent_id}")
    ok = await disconnect(user.id, agent_id)
    return {"ok": ok, "agent_id": agent_id, "connected": False}
