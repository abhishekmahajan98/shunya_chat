from typing import Literal, Optional

from pydantic import BaseModel


class ModelInfo(BaseModel):
    """Information about an available model."""
    id: str  # provider:model for init_chat_model
    name: str
    provider: Literal["google", "anthropic", "openai"]
    description: str


class ModelRegistry:
    """Registry of user-facing AI models."""

    AVAILABLE_MODELS: list[ModelInfo] = [
        ModelInfo(
            id="google_genai:gemini-3.8-flash",
            name="Gemini 3.8 Flash",
            provider="google",
            description="Default — most intelligent Flash, for agents",
        ),
        ModelInfo(
            id="google_genai:gemini-3.5-flash",
            name="Gemini 3.5 Flash",
            provider="google",
            description="Legacy Flash — baseline high-throughput",
        ),
        ModelInfo(
            id="google_genai:gemini-3-flash-preview",
            name="Gemini 3 Flash (preview)",
            provider="google",
            description="Previous Gemini 3 Flash preview",
        ),
        ModelInfo(
            id="anthropic:claude-sonnet-4-5-20250929",
            name="Claude Sonnet 4.5",
            provider="anthropic",
            description="Balanced Anthropic model",
        ),
        ModelInfo(
            id="openai:gpt-4o",
            name="GPT-4o",
            provider="openai",
            description="OpenAI flagship",
        ),
    ]

    @classmethod
    def get_model_info(cls, model_id: str) -> Optional[ModelInfo]:
        for model in cls.AVAILABLE_MODELS:
            if model.id == model_id:
                return model
        return None

    @classmethod
    def get_all_models(cls) -> list[ModelInfo]:
        return cls.AVAILABLE_MODELS
