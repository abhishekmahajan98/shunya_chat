"""Runtime model selection — ported from agents-project-template."""

from __future__ import annotations

import functools
import os
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Annotated, Any, cast

from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, SystemMessage


@dataclass(kw_only=True)
class Context:
    """Runtime configuration injected into agent graphs."""

    model: Annotated[
        str, {"description": "LLM model as 'provider/model' or 'provider:model'."}
    ] = field(default="")
    model_base_url: Annotated[
        str | None, {"description": "Optional base URL for Ollama or proxy servers."}
    ] = field(default=None)
    client_id: str | None = field(default=None)
    system_prompt: Annotated[
        str | None,
        {"description": "Optional system prompt that overrides the graph default."},
    ] = field(default=None)

    def __post_init__(self) -> None:
        if not self.model and (env_model := os.environ.get("MODEL")):
            self.model = env_model
        if self.model_base_url is None and (
            env_base_url := os.environ.get("MODEL_BASE_URL")
        ):
            self.model_base_url = env_base_url


def _split_provider(model_id: str) -> tuple[str, str] | None:
    slash = model_id.find("/")
    colon = model_id.find(":")
    if slash < 0 and colon < 0:
        return None
    if slash >= 0 and (colon < 0 or slash < colon):
        provider, model = model_id.split("/", maxsplit=1)
    else:
        provider, model = model_id.split(":", maxsplit=1)
    return provider.strip(), model.strip()


@functools.lru_cache(maxsize=32)
def _load(model_id: str, base_url: str | None = None) -> BaseChatModel:
    kwargs: dict[str, Any] = {}
    if base_url:
        kwargs["base_url"] = base_url
    parts = _split_provider(model_id)
    if parts is None:
        return cast(BaseChatModel, init_chat_model(model_id, **kwargs))
    provider, model = parts
    return cast(
        BaseChatModel, init_chat_model(model, model_provider=provider, **kwargs)
    )


@wrap_model_call  # type: ignore[arg-type]
async def configurable_model(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    ctx = request.runtime.context
    if not ctx or not getattr(ctx, "model", None):
        raise ValueError(
            "No model configured. Set MODEL in .env or pass via run context."
        )
    model = _load(ctx.model, getattr(ctx, "model_base_url", None))
    response = await handler(request.override(model=model))
    for msg in getattr(response, "result", None) or []:
        if isinstance(msg, AIMessage) and "model_id" not in msg.additional_kwargs:
            msg.additional_kwargs["model_id"] = ctx.model
    return response


@wrap_model_call  # type: ignore[arg-type]
async def dynamic_system_prompt(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """Append the assistant's extra prompt — never replace the graph's.

    Replacing wiped deep-agent / Skills / write_todos instructions and left
    models (esp. Gemini) claiming enabled tools were unavailable.
    """
    ctx = request.runtime.context
    prompt = getattr(ctx, "system_prompt", None) if ctx else None
    if not prompt:
        return await handler(request)  # type: ignore[misc, no-any-return]

    existing = request.system_message
    if existing is None:
        new_msg = SystemMessage(content=prompt)
    else:
        blocks = getattr(existing, "content_blocks", None)
        if blocks:
            new_msg = SystemMessage(
                content=[*blocks, {"type": "text", "text": f"\n\n{prompt}"}]
            )
        else:
            base = existing.content
            if isinstance(base, str):
                new_msg = SystemMessage(content=f"{base}\n\n{prompt}")
            else:
                new_msg = SystemMessage(
                    content=[
                        *(base if isinstance(base, list) else [{"type": "text", "text": str(base)}]),
                        {"type": "text", "text": f"\n\n{prompt}"},
                    ]
                )
    return await handler(request.override(system_message=new_msg))
