from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class Attachment(BaseModel):
    """File attachment in a message."""
    id: str
    name: str
    type: str
    url: str
    size: int


class MessageCreate(BaseModel):
    """Request to send a new chat message."""
    conversation_id: Optional[str] = None
    model: str
    content: str
    attachments: Optional[list[Attachment]] = None


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
    attachments: Optional[list[Attachment]] = None
    reasoning: Optional[dict] = None
    citations: Optional[list[dict]] = None
    agents: Optional[list[str]] = None


class ConversationDetail(BaseModel):
    """Full conversation with messages."""
    id: str
    title: str
    model: str
    messages: list[MessageOut]
    created_at: datetime
    updated_at: datetime
