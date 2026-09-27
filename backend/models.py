from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class Attachment(BaseModel):
    id: str
    name: str
    type: str
    url: str
    size: int


class MessageCreate(BaseModel):
    """Stream a chat turn through the agent harness."""
    content: str
    model: str
    conversation_id: Optional[str] = None  # alias for thread_id (frontend compat)
    thread_id: Optional[str] = None
    assistant_id: Optional[str] = None  # ignored — graph chosen from active_agents
    active_agents: list[str] = Field(default_factory=list)
    model_base_url: Optional[str] = None
    attachments: Optional[list[Attachment]] = None


class AssistantCreate(BaseModel):
    name: str
    description: Optional[str] = None
    graph_id: Literal["basic_agent", "deep_agent"] = "basic_agent"
    system_prompt: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AssistantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    graph_id: Optional[Literal["basic_agent", "deep_agent"]] = None
    system_prompt: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None


class ThreadCreate(BaseModel):
    assistant_id: str
    title: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ThreadUpdate(BaseModel):
    title: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class ConversationSummary(BaseModel):
    id: str
    title: str
    model: str = ""
    created_at: datetime | str
    updated_at: datetime | str
    assistant_id: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    role: Literal["user", "assistant", "tool", "system"]
    content: str
    created_at: datetime | str
    attachments: Optional[list[Attachment]] = None
    reasoning: Optional[dict] = None
    citations: Optional[list[dict]] = None
    agents: Optional[list[str]] = None
    tool_calls: Optional[Any] = None
    additional_kwargs: Optional[dict] = None


class ConversationDetail(BaseModel):
    id: str
    title: str
    model: str = ""
    messages: list[MessageOut]
    created_at: datetime | str
    updated_at: datetime | str
    assistant_id: Optional[str] = None
    compactions: list[dict] = Field(default_factory=list)
