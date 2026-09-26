"""Assistant CRUD — configured instances of basic_agent / deep_agent graphs."""

from fastapi import APIRouter, Depends, HTTPException

from auth import DummyUser, get_current_user
from db import get_store
from models import AssistantCreate, AssistantUpdate

router = APIRouter(prefix="/api/assistants", tags=["assistants"])


@router.get("")
async def list_assistants(user: DummyUser = Depends(get_current_user)):
    store = get_store()
    return store.ensure_default_assistants(user.id)


@router.post("")
async def create_assistant(body: AssistantCreate, user: DummyUser = Depends(get_current_user)):
    store = get_store()
    return store.create_assistant(
        {
            "user_id": user.id,
            "name": body.name,
            "description": body.description,
            "graph_id": body.graph_id,
            "system_prompt": body.system_prompt,
            "config": body.config,
            "metadata": body.metadata,
        }
    )


@router.get("/{assistant_id}")
async def get_assistant(assistant_id: str, user: DummyUser = Depends(get_current_user)):
    store = get_store()
    row = store.get_assistant(assistant_id, user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Assistant not found")
    return row


@router.patch("/{assistant_id}")
async def update_assistant(
    assistant_id: str,
    body: AssistantUpdate,
    user: DummyUser = Depends(get_current_user),
):
    store = get_store()
    row = store.update_assistant(assistant_id, user.id, body.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Assistant not found")
    return row


@router.delete("/{assistant_id}")
async def delete_assistant(assistant_id: str, user: DummyUser = Depends(get_current_user)):
    store = get_store()
    if not store.delete_assistant(assistant_id, user.id):
        raise HTTPException(status_code=404, detail="Assistant not found")
    return {"status": "deleted"}
