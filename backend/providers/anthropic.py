import os
from typing import AsyncGenerator
import anthropic
from config import settings
from .base import LLMProvider
from system_prompt import get_system_prompt


class AnthropicProvider(LLMProvider):
    """Anthropic Claude API provider with real-time thinking support."""

    def __init__(self):
        api_key = settings.ANTHROPIC_API_KEY
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY must be set in config")
        # Use ASYNC client for true real-time streaming
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        # Keep sync client for non-streaming calls
        self.sync_client = anthropic.Anthropic(api_key=api_key)

    async def generate(self, messages: list[dict], model_id: str) -> str:
        """Generate response using Claude."""
        formatted_messages = await self._format_messages(messages)
        
        is_thinking = model_id.endswith("-thinking")
        base_model = model_id.replace("-thinking", "") if is_thinking else model_id
        system_prompt = get_system_prompt("America/New_York")

        # For non-streaming, we can use the async client's .create method
        if is_thinking:
            response = await self.client.messages.create(
                model=base_model,
                max_tokens=16000,
                system=system_prompt,
                thinking={"type": "enabled", "budget_tokens": 10000},
                messages=formatted_messages
            )
        else:
            response = await self.client.messages.create(
                model=base_model,
                max_tokens=8192,
                system=system_prompt,
                messages=formatted_messages
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
        formatted_messages = await self._format_messages(messages)
        
        is_thinking = model_id.endswith("-thinking")
        base_model = model_id.replace("-thinking", "") if is_thinking else model_id
        system_prompt = get_system_prompt("America/New_York")

        if is_thinking:
            # Use ASYNC streaming for real-time events
            async with self.client.messages.stream(
                model=base_model,
                max_tokens=16000,
                system=system_prompt,
                thinking={"type": "enabled", "budget_tokens": 10000},
                messages=formatted_messages
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
                system=system_prompt,
                messages=formatted_messages
            ) as stream:
                async for text in stream.text_stream:
                    yield {"type": "text", "content": text}

    async def _format_messages(self, messages: list[dict]) -> list[dict]:
        """Convert messages to Anthropic format, handling attachments."""
        from utils import download_file_as_base64

        formatted = []
        for msg in messages:
            role = msg["role"]
            content_blocks = []
            
            # Add text content
            if msg.get("content"):
                content_blocks.append({"type": "text", "text": msg["content"]})
            
            # Add attachments
            if role == "user" and msg.get("attachments"):
                for attachment in msg["attachments"]:
                    url = attachment.get("url") if isinstance(attachment, dict) else attachment.url
                    if url:
                        result = await download_file_as_base64(url)
                        if result:
                            base64_str, mime_type = result
                            
                            # Determine block type (image or document for PDF)
                            if mime_type == "application/pdf":
                                content_blocks.append({
                                    "type": "document",
                                    "source": {
                                        "type": "base64",
                                        "media_type": mime_type,
                                        "data": base64_str
                                    }
                                })
                            elif mime_type.startswith("image/"):
                                content_blocks.append({
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": mime_type,
                                        "data": base64_str
                                    }
                                })
            
            # If no content (only text which is empty?), skip or ensure structure
            if content_blocks:
                formatted.append({
                    "role": role,
                    "content": content_blocks
                })
        
        return formatted

