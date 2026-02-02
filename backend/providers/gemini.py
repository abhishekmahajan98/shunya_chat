import os
from typing import AsyncGenerator
from google import genai
from google.genai import types
from dotenv import load_dotenv
from .base import LLMProvider

load_dotenv()


class GeminiProvider(LLMProvider):
    """Google Gemini API provider with thinking support."""

    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        self.client = genai.Client(api_key=api_key)

    async def generate(self, messages: list[dict], model_id: str) -> str:
        """Generate response using Gemini."""
        contents = self._format_messages(messages)
        
        # Enable thinking for Gemini Pro models
        config = None
        if "pro" in model_id.lower():
            config = types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(
                    thinking_budget=10000,
                    include_thoughts=True  # Include thought summaries
                )
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
        """Stream response using Gemini with thinking support."""
        contents = self._format_messages(messages)
        
        # Enable thinking for Gemini Pro models
        config = None
        if "pro" in model_id.lower():
            config = types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(
                    thinking_budget=10000,
                    include_thoughts=True  # Include thought summaries
                )
            )
        
        response = self.client.models.generate_content_stream(
            model=model_id,
            contents=contents,
            config=config
        )
        
        for chunk in response:
            # Check for parts in candidates
            if hasattr(chunk, 'candidates') and chunk.candidates:
                for candidate in chunk.candidates:
                    if hasattr(candidate, 'content') and candidate.content:
                        for part in candidate.content.parts:
                            # Check if this is a thought part
                            if hasattr(part, 'thought') and part.thought:
                                if hasattr(part, 'text') and part.text:
                                    yield {"type": "thinking", "content": part.text}
                            elif hasattr(part, 'text') and part.text:
                                yield {"type": "text", "content": part.text}
            elif hasattr(chunk, 'text') and chunk.text:
                yield {"type": "text", "content": chunk.text}

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
