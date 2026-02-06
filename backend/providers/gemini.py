import os
from typing import AsyncGenerator
from google import genai
from google.genai.types import (
    GenerateContentConfig, 
    ThinkingConfig, 
    ThinkingLevel
)
from config import settings
from .base import LLMProvider
from system_prompt import get_system_prompt


class GeminiProvider(LLMProvider):
    """Google Gemini API provider with Gemini 3 thinking support."""

    def __init__(self):
        api_key = settings.GOOGLE_API_KEY
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        self.client = genai.Client(api_key=api_key)

    async def generate(self, messages: list[dict], model_id: str) -> str:
        """Generate response using Gemini."""
        contents = await self._format_messages(messages)
        
        # Gemini 3 uses thinking_level (LOW/HIGH) + include_thoughts
        config = GenerateContentConfig(
            system_instruction=get_system_prompt("America/New_York"),
            thinking_config=ThinkingConfig(
                include_thoughts=True,
                thinking_level=ThinkingLevel.HIGH if "pro" in model_id.lower() else ThinkingLevel.LOW
            ),
            response_modalities=["TEXT"]
        )
        
        response = await self.client.aio.models.generate_content(
            model=model_id,
            contents=contents,
            config=config
        )
        return response.text

    async def generate_stream(
        self, messages: list[dict], model_id: str
    ) -> AsyncGenerator[dict, None]:
        """Stream response using Gemini 3 with REAL-TIME thinking support."""
        contents = await self._format_messages(messages)
        
        # Configure Gemini 3 Thinking
        # - include_thoughts=True: MANDATORY to get thoughts in response
        # - thinking_level: HIGH for deep reasoning (pro), LOW for fast (flash)
        is_thinking_supported = any(m in model_id.lower() for m in ["gemini-3", "gemini-2.5", "gemini-2.0", "gemini-exp"])
        
        config_kwargs = {}
        if is_thinking_supported:
            config_kwargs["thinking_config"] = ThinkingConfig(
                include_thoughts=True,
                thinking_level=ThinkingLevel.HIGH if "pro" in model_id.lower() else ThinkingLevel.LOW
            )
            config_kwargs["response_modalities"] = ["TEXT"]
            
        config = GenerateContentConfig(**config_kwargs)
        
        # Use async context manager for proper streaming
        async for chunk in await self.client.aio.models.generate_content_stream(
            model=model_id,
            contents=contents,
            config=config
        ):
            if not chunk.candidates:
                continue
            
            for part in chunk.candidates[0].content.parts:
                # 1. Handle Thinking Parts
                # The SDK explicitly flags these with 'thought'
                if getattr(part, 'thought', None):
                    yield {"type": "thinking", "content": part.text}
                
                # 2. Handle Final Response Parts
                elif getattr(part, 'text', None):
                    yield {"type": "text", "content": part.text}

    async def _format_messages(self, messages: list[dict]) -> list[dict]:
        """Convert messages to Gemini format, handling attachments."""
        from utils import download_file_as_base64
        
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            parts = [{"text": msg["content"]}]
            
            # Handle attachments for user messages
            if role == "user" and msg.get("attachments"):
                for attachment in msg["attachments"]:
                    # Ensure it's a list of dicts (if coming from DB/JSON)
                    # or list of models
                    url = attachment.get("url") if isinstance(attachment, dict) else attachment.url
                    if url:
                        result = await download_file_as_base64(url)
                        if result:
                            base64_str, mime_type = result
                            parts.append({
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": base64_str
                                }
                            })
            
            contents.append({
                "role": role,
                "parts": parts
            })
        return contents
