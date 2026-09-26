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
            id="google_genai:gemini-2.0-flash",
            name="Gemini 2.0 Flash",
            provider="google",
            description="Fast Google model",
        ),
        ModelInfo(
            id="google_genai:gemini-2.5-pro",
            name="Gemini 2.5 Pro",
            provider="google",
            description="Stronger Google model",
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
