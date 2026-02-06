from pydantic import BaseModel
from typing import Optional, Literal

class ModelInfo(BaseModel):
    """Information about an available model."""
    id: str
    name: str
    provider: Literal["google", "anthropic"]
    description: str

class ModelRegistry:
    """Registry of all permissible user-facing AI models."""
    
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

    @classmethod
    def get_model_info(cls, model_id: str) -> Optional[ModelInfo]:
        """Get model info by ID from the registry."""
        for model in cls.AVAILABLE_MODELS:
            if model.id == model_id:
                return model
        return None

    @classmethod
    def get_all_models(cls) -> list[ModelInfo]:
        """Get all registered models."""
        return cls.AVAILABLE_MODELS
