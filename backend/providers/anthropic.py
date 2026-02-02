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
        # Use ASYNC client for true real-time streaming
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        # Keep sync client for non-streaming calls
        self.sync_client = anthropic.Anthropic(api_key=api_key)

    async def generate(self, messages: list[dict], model_id: str) -> str:
        """Generate response using Claude."""
        is_thinking = model_id.endswith("-thinking")
        base_model = model_id.replace("-thinking", "") if is_thinking else model_id

        if is_thinking:
            response = self.sync_client.messages.create(
                model=base_model,
                max_tokens=16000,
                thinking={"type": "enabled", "budget_tokens": 10000},
                messages=messages
            )
        else:
            response = self.sync_client.messages.create(
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
        """Stream response using Claude with REAL-TIME thinking support."""
        is_thinking = model_id.endswith("-thinking")
        base_model = model_id.replace("-thinking", "") if is_thinking else model_id

        if is_thinking:
            # Use ASYNC streaming for real-time events
            async with self.client.messages.stream(
                model=base_model,
                max_tokens=16000,
                thinking={"type": "enabled", "budget_tokens": 10000},
                messages=messages
            ) as stream:
                # Async iteration yields events in real-time as they arrive
                async for event in stream:
                    if event.type == "content_block_delta":
                        if event.delta.type == "thinking_delta":
                            yield {"type": "thinking", "content": event.delta.thinking}
                        elif event.delta.type == "text_delta":
                            yield {"type": "text", "content": event.delta.text}
        else:
            # Standard async streaming without thinking
            async with self.client.messages.stream(
                model=base_model,
                max_tokens=8192,
                messages=messages
            ) as stream:
                async for text in stream.text_stream:
                    yield {"type": "text", "content": text}
