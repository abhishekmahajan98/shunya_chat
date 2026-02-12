from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class SpaceCreate(BaseModel):
    """Request to create a new space."""
    name: str
    description: Optional[str] = None
    is_public: bool = False
    type: Literal["personal", "shared"] = "shared"


class FolderCreate(BaseModel):
    """Request to create a new folder."""
    name: str
    parent_id: Optional[str] = None


class SpaceResponse(BaseModel):
    """Summary of a space."""
    id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    is_public: bool
    type: str
    metadata: Optional[dict] = None
    created_at: datetime


class DocumentResponse(BaseModel):
    """Summary of a document."""
    id: str
    space_id: str
    parent_id: Optional[str] = None
    name: str
    type: str = "document"
    storage_path: Optional[str] = None
    status: str
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    created_at: datetime


class SpaceDetail(SpaceResponse):
    """Full detail of a space with its documents."""
    documents: list[DocumentResponse]


class Attachment(BaseModel):
    """File attachment in a message."""
    id: str
    name: str
    type: str  # mime type
    url: str
    size: int


class MessageCreate(BaseModel):
    """Request to send a new chat message."""
    conversation_id: Optional[str] = None
    model: str
    content: str
    active_agents: Optional[list[str]] = None  # List of activated agent IDs
    attachments: Optional[list[Attachment]] = None
    selected_spaces: Optional[list[str]] = None  # List of space IDs for RAG
    selected_documents: Optional[list[str]] = None  # List of specific document IDs for RAG


class Citation(BaseModel):
    """Citation for a message."""
    id: str
    title: str
    url: Optional[str] = None
    page: Optional[int] = None


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
    citations: Optional[list[Citation]] = None
    agents: Optional[list[str]] = None


class ConversationDetail(BaseModel):
    """Full conversation with messages."""
    id: str
    title: str
    model: str
    messages: list[MessageOut]
    created_at: datetime
    updated_at: datetime



