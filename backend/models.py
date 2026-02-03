from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class MessageCreate(BaseModel):
    """Request to send a new chat message."""
    conversation_id: Optional[str] = None
    model: str
    content: str
    active_agents: Optional[list[str]] = None  # List of activated agent IDs


class MessageResponse(BaseModel):
    """Response from a chat message."""
    conversation_id: str
    message_id: str
    role: Literal["assistant"]
    content: str


class ConversationSummary(BaseModel):
    """Summary of a conversation for listing."""
    id: str
    title: str
    model: str
    created_at: datetime
    updated_at: datetime


class MessageOut(BaseModel):
    """A message in conversation history."""
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ConversationDetail(BaseModel):
    """Full conversation with messages."""
    id: str
    title: str
    model: str
    messages: list[MessageOut]
    created_at: datetime
    updated_at: datetime


class ModelInfo(BaseModel):
    """Information about an available model."""
    id: str
    name: str
    provider: Literal["google", "anthropic"]
    description: str


# Available models configuration
AVAILABLE_MODELS: list[ModelInfo] = [
    ModelInfo(
        id="gemini-3-flash-preview",
        name="Gemini 3 Flash",
        provider="google",
        description="Fast with thinking"
    ),
    ModelInfo(
        id="gemini-3-pro-preview",
        name="Gemini 3 Pro",
        provider="google",
        description="Deep reasoning"
    ),
    ModelInfo(
        id="claude-sonnet-4-5-20250929",
        name="Claude Sonnet 4.5",
        provider="anthropic",
        description="Balanced performance"
    ),
    ModelInfo(
        id="claude-sonnet-4-5-20250929-thinking",
        name="Claude Sonnet 4.5 Thinking",
        provider="anthropic",
        description="Extended reasoning"
    ),
]


def get_model_info(model_id: str) -> Optional[ModelInfo]:
    """Get model info by ID."""
    for model in AVAILABLE_MODELS:
        if model.id == model_id:
            return model
    return None
