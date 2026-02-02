import os
from typing import AsyncGenerator
from google import genai
from google.genai.types import (
    GenerateContentConfig, 
    ThinkingConfig, 
    ThinkingLevel
)
from dotenv import load_dotenv
from .base import LLMProvider

load_dotenv()


class GeminiProvider(LLMProvider):
    """Google Gemini API provider with Gemini 3 thinking support."""

    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        self.client = genai.Client(api_key=api_key)

    async def generate(self, messages: list[dict], model_id: str) -> str:
        """Generate response using Gemini."""
        contents = self._format_messages(messages)
        
        # Gemini 3 uses thinking_level (LOW/HIGH) + include_thoughts
        config = GenerateContentConfig(
            thinking_config=ThinkingConfig(
                include_thoughts=True,
                thinking_level=ThinkingLevel.HIGH if "pro" in model_id.lower() else ThinkingLevel.LOW
            ),
            response_modalities=["TEXT"]
        )
        
        response = self.client.models.generate_content(
            model=model_id,
            contents=contents,
            config=config
        )
        return response.text

    async def generate_stream(
        self, messages: list[dict], model_id: str
    ) -> AsyncGenerator[dict, None]:
        """Stream response using Gemini 3 with REAL-TIME thinking support."""
        contents = self._format_messages(messages)
        
        # Configure Gemini 3 Thinking
        # - include_thoughts=True: MANDATORY to get thoughts in response
        # - thinking_level: HIGH for deep reasoning (pro), LOW for fast (flash)
        config = GenerateContentConfig(
            thinking_config=ThinkingConfig(
                include_thoughts=True,
                thinking_level=ThinkingLevel.HIGH if "pro" in model_id.lower() else ThinkingLevel.LOW
            ),
            response_modalities=["TEXT"]
        )
        
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
                # The SDK explicitly flags these with 'thought=True'
                if part.thought:
                    yield {"type": "thinking", "content": part.text}
                
                # 2. Handle Final Response Parts
                elif part.text:
                    yield {"type": "text", "content": part.text}

    def _format_messages(self, messages: list[dict]) -> list[dict]:
        """Convert messages to Gemini format."""
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })
        return contents
