from abc import ABC, abstractmethod
from typing import AsyncGenerator


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def generate(self, messages: list[dict], model_id: str) -> str:
        """Generate a response from the given messages."""
        pass

    @abstractmethod
    async def generate_stream(
        self, messages: list[dict], model_id: str
    ) -> AsyncGenerator[dict, None]:
        """
        Stream response chunks.
        Yields dicts with: {"type": "thinking"|"text", "content": "..."}
        """
        pass
