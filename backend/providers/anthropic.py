import os
from typing import AsyncGenerator
import anthropic
from dotenv import load_dotenv
from .base import LLMProvider

load_dotenv()


class AnthropicProvider(LLMProvider):
    """Anthropic Claude API provider with real-time thinking support."""

    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        self.client = anthropic.Anthropic(api_key=api_key)

    async def generate(self, messages: list[dict], model_id: str) -> str:
        """Generate response using Claude."""
        is_thinking = model_id.endswith("-thinking")
        base_model = model_id.replace("-thinking", "") if is_thinking else model_id

        if is_thinking:
            response = self.client.messages.create(
                model=base_model,
                max_tokens=16000,
                thinking={"type": "enabled", "budget_tokens": 10000},
                messages=messages
            )
        else:
            response = self.client.messages.create(
                model=base_model,
                max_tokens=8192,
                messages=messages
            )

        text_parts = []
        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
        
        return "\n".join(text_parts)

    async def generate_stream(
        self, messages: list[dict], model_id: str
    ) -> AsyncGenerator[dict, None]:
        """Stream response using Claude with real-time thinking support."""
        is_thinking = model_id.endswith("-thinking")
        base_model = model_id.replace("-thinking", "") if is_thinking else model_id

        if is_thinking:
            # Use raw events for real-time thinking streaming
            with self.client.messages.stream(
                model=base_model,
                max_tokens=16000,
                thinking={"type": "enabled", "budget_tokens": 10000},
                messages=messages
            ) as stream:
                # Iterate over raw events for real-time updates
                for event in stream:
                    if hasattr(event, 'type'):
                        if event.type == "content_block_delta":
                            delta = event.delta
                            if hasattr(delta, 'type'):
                                if delta.type == "thinking_delta":
                                    yield {"type": "thinking", "content": delta.thinking}
                                elif delta.type == "text_delta":
                                    yield {"type": "text", "content": delta.text}
        else:
            # Standard streaming using text_stream iterator
            with self.client.messages.stream(
                model=base_model,
                max_tokens=8192,
                messages=messages
            ) as stream:
                for text in stream.text_stream:
                    yield {"type": "text", "content": text}
