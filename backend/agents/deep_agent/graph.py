"""Deep agent — DeepAgents create_deep_agent harness (LangChain underneath)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Optional, Sequence

from deepagents import create_deep_agent
from deepagents.backends.filesystem import FilesystemBackend
from langchain.agents.middleware import (
    ModelRequest,
    ModelResponse,
    TodoListMiddleware,
    wrap_model_call,
)
from langgraph.checkpoint.memory import MemorySaver

from agents.deep_agent.tools import TOOLS
from agents.model import Context, configurable_model, dynamic_system_prompt
from agents.skills_loader import BACKEND_DIR
from services.citations import cite_sources

_SYSTEM_PROMPT = """You are a capable multi-step assistant.
Thoroughness beats speed — latency is acceptable.

The todo plan is the backbone of the turn:
1. FIRST call write_todos with steps that are SPECIFIC to the user's question
   (name entities, metrics, comparisons, tools). Never use bare generics like
   only "Gather evidence" / "Synthesize answer" / "Verify claims".
2. First write_todos must use pending / exactly one in_progress — NEVER mark
   items completed until you have actually finished that work with tools.
3. Mark exactly one item in_progress. As each step finishes, call write_todos
   again immediately to mark it completed and advance the next — do not leave
   the whole list pending until the end.
4. Gather with enabled agents/tools. Prefer calling calculator__/search__/etc.
   tools DIRECTLY; use task→gatherer only for large multi-tool batches.
5. Synthesize from evidence only (tool results), not training-data guesses.
6. Verify contested claims (prefer task→verifier when useful).
7. cite_sources, mark ALL todos completed, then write the final answer.

Rules:
- Your tool list is authoritative. If a calculator__/search__/weather__/datetime__
  tool (or task) is listed, you HAVE it — never claim a tool is unavailable.
- Prefer tools over guessing when a relevant tool is available.
- Most tools do NOT return a citations key — use cite_sources.
- Read and follow skills when listed.
- Do not give the final answer while any todo is still pending/in_progress.
- For truly trivial one-step asks only, you may skip the full loop.
"""

_TODO_SYSTEM_PROMPT = """## write_todos (required backbone)

You MUST maintain a todo list for this turn.

### Writing the plan
- First action: write_todos with concrete steps tailored to THIS user question.
- Include the subject matter in each item (who/what/which claim), not vague labels.
- Cover gather → synthesize → verify (split gather/verify into multiple specific
  items when the question has several parts).
- First plan: statuses are pending or exactly one in_progress. Do NOT mark
  anything completed until tools have finished that step.
- Bad: "Gather evidence", "Synthesize answer", "Verify claims"
- Good: "Search LangGraph skills= parameter docs", "Draft comparison of X vs Y",
  "Re-check the pricing claim with a second search"

### Updating as you work
- Exactly one item in_progress at a time.
- The moment a step is done, write_todos again: mark it completed, set the next
  to in_progress. Never batch all completions at the end.
- Revise the list if new sub-tasks appear.

### Finishing
- Before the final user-facing answer, every todo must be completed.
- Call write_todos at most once per model turn (never in parallel).
"""

_GATHERER_PROMPT = """You are a gatherer subagent. Collect evidence using only the tools you have.

- Call the relevant enabled tools (whatever they are — search, calc, weather, etc.).
- Return a structured brief: what you found, key values, and any sources/ids.
- Do not write the final user-facing answer.
- If you lack a tool needed for the question, say what's missing — don't fake it.
"""

_VERIFIER_PROMPT = """You are a verifier subagent. Challenge a draft using only the tools you have.

- Re-check contested claims with the same class of tools used to gather evidence.
- Return: confirmed points, disputed points, gaps, and suggested fixes.
- Do not assume web search exists. If only calc/weather/etc. are available, verify
  with those (recompute, re-fetch, cross-check).
- Do not rewrite the full answer unless a critical error must be corrected.
"""


def _state_todos(state: Any) -> list:
    if state is None:
        return []
    if isinstance(state, dict):
        todos = state.get("todos") or []
    else:
        todos = getattr(state, "todos", None) or []
    return list(todos) if isinstance(todos, list) else []


def _tool_name(tool: Any) -> str | None:
    if tool is None:
        return None
    if isinstance(tool, dict):
        return tool.get("name")
    return getattr(tool, "name", None)


def _is_domain_tool_name(name: str | None) -> bool:
    """MCP agent tools are prefixed `agent__tool`; skip planning/fs/meta tools."""
    if not name:
        return False
    if name in {
        "write_todos",
        "cite_sources",
        "task",
        "ls",
        "read_file",
        "write_file",
        "edit_file",
        "delete",
        "glob",
        "grep",
        "execute",
    }:
        return False
    return "__" in name


def _domain_agent_id(name: str | None) -> str | None:
    if not _is_domain_tool_name(name):
        return None
    return name.split("__", 1)[0]  # type: ignore[union-attr]


def _used_domain_agents(state: Any) -> set[str]:
    used: set[str] = set()
    if state is None:
        return used
    messages = state.get("messages") if isinstance(state, dict) else getattr(state, "messages", None)
    if not messages:
        return used
    for msg in messages:
        name = getattr(msg, "name", None)
        agent = _domain_agent_id(name)
        if agent:
            used.add(agent)
        for tc in getattr(msg, "tool_calls", None) or []:
            tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            agent = _domain_agent_id(tc_name)
            if agent:
                used.add(agent)
    return used


def _todos_all_completed(todos: list) -> bool:
    if not todos:
        return False
    for t in todos:
        status = t.get("status") if isinstance(t, dict) else getattr(t, "status", None)
        if status != "completed":
            return False
    return True


@wrap_model_call  # type: ignore[arg-type]
async def force_todos_when_empty(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """First model call must create a plan via write_todos.

    Gemini (and others) often skip planning and jump to search/calc. Forcing
    tool_choice when the todos list is empty makes the Plan show up in the UI
    and keeps write_todos as the backbone.
    """
    if _state_todos(request.state):
        return await handler(request)

    tool_names = {_tool_name(t) for t in (request.tools or [])}
    if "write_todos" not in tool_names:
        return await handler(request)

    return await handler(request.override(tool_choice="write_todos"))


@wrap_model_call  # type: ignore[arg-type]
async def force_domain_tools_after_plan(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """After a plan exists, require each enabled agent family at least once."""
    todos = _state_todos(request.state)
    if not todos:
        return await handler(request)
    if _todos_all_completed(todos):
        return await handler(request)

    domain = [t for t in (request.tools or []) if _is_domain_tool_name(_tool_name(t))]
    if not domain:
        names = {_tool_name(t) for t in (request.tools or [])}
        if "task" in names:
            return await handler(request.override(tool_choice="task"))
        return await handler(request)

    available = {_domain_agent_id(_tool_name(t)) for t in domain}
    available.discard(None)
    used = _used_domain_agents(request.state)
    missing = {a for a in available if a not in used}
    if not missing:
        return await handler(request)

    filtered = [
        t
        for t in domain
        if _domain_agent_id(_tool_name(t)) in missing
    ]
    return await handler(request.override(tools=filtered or domain, tool_choice="any"))


def _rsv_subagents(tools: list) -> list[dict]:
    """Gather/verify helpers share whatever tools the user enabled."""
    available = list(tools or [])
    return [
        {
            "name": "gatherer",
            "description": (
                "Gather evidence with the enabled agents/tools for complex questions. "
                "Use before synthesizing when several tool calls are needed."
            ),
            "system_prompt": _GATHERER_PROMPT,
            "tools": available,
        },
        {
            "name": "verifier",
            "description": (
                "Challenge a draft with the same enabled tools: recompute, re-fetch, "
                "or cross-check. Use after synthesizing, before the final answer."
            ),
            "system_prompt": _VERIFIER_PROMPT,
            "tools": available,
        },
    ]


def build_deep_agent(
    checkpointer: MemorySaver | None = None,
    tools: list | None = None,
    skills: Optional[Sequence[str]] = None,
):
    resolved_tools = list(tools if tools is not None else TOOLS)
    if not any(getattr(t, "name", None) == "cite_sources" for t in resolved_tools):
        resolved_tools = [*resolved_tools, cite_sources]

    middleware: list = [
        TodoListMiddleware(system_prompt=_TODO_SYSTEM_PROMPT),
        force_todos_when_empty,
        force_domain_tools_after_plan,
        configurable_model,
        dynamic_system_prompt,
    ]

    skill_list = list(skills or [])
    if "/skills/research/" not in skill_list:
        skill_list.append("/skills/research/")

    kwargs: dict = dict(
        model="anthropic:claude-sonnet-4-5-20250929",
        tools=resolved_tools,
        system_prompt=_SYSTEM_PROMPT,
        context_schema=Context,
        middleware=middleware,
        name="deep_agent",
        checkpointer=checkpointer,
        skills=skill_list,
        backend=FilesystemBackend(
            root_dir=str(BACKEND_DIR),
            virtual_mode=True,
        ),
        subagents=_rsv_subagents(list(resolved_tools or [])),
    )

    return create_deep_agent(**kwargs)
