"""Deep agent — DeepAgents create_deep_agent harness (LangChain underneath).

Single ReAct loop: plan → call MCP tools directly and/or spawn general-purpose
subagents via task (serial or parallel). Soft policy; minimal force middleware.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Optional

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
from config import settings
from services.citations import cite_sources

_SYSTEM_PROMPT = """You are a capable multi-step assistant.
Thoroughness beats speed — latency is acceptable.

## Plan
1. FIRST call write_todos with steps SPECIFIC to this user question
   (entities, metrics, tools). No bare generics like only "Gather evidence".
2. Exactly one item in_progress. After EACH step's tools finish, call
   write_todos AGAIN before the next step — mark the finished item completed
   and set the next to in_progress. Never leave the whole list pending until
   the end, and never mark everything completed in one shot after all tools.
3. Do not give the final answer while any todo is still pending/in_progress.

## Tools — when YOU call vs when you spawn task
- Your tool list is authoritative. Use EVERY enabled agent family the question
  needs (e.g. both search and calculator on a research+math ask).
- ONE trivial call (single search, single expression, single lookup) → call
  that MCP tool YOURSELF. Do not spawn a subagent for that.
- Multi-source / multi-search research (compare several figures, pull several
  related facts, dig across sources) → you MUST spawn
  task(subagent_type="general-purpose") for that plan step. Do not run a long
  chain of search__* yourself on the parent — hand the batch to a subagent and
  work from its brief.
- Standalone arithmetic (e.g. 7+7879965*237675) → YOU call calculator__*
  directly (or a separate parallel task). Never bolt it onto a research brief.
- Independent concerns MAY run in PARALLEL: e.g. one research task + your
  calculator call in the same assistant message.
- After a subagent returns: write_todos (tick that step), then continue.
- Most tools do NOT return a citations key — use cite_sources when you relied
  on tool/external facts.
- Read and follow skills when listed.
- Re-check contested claims yourself with a direct tool call, or spawn another
  short task — no special verifier type is required.

## task scope (hard rules)
- ONE concern per task — map to a single plan step. Never paste the whole plan
  or unrelated steps into one description.
- Pass a clear description of only that step's work.
- Do not mark a tool-backed todo completed until that tool/task has actually run.

## Finish
cite_sources if needed, mark ALL todos completed, then write the full
user-facing final answer in your own voice.
"""

_TODO_SYSTEM_PROMPT = """## write_todos (required backbone)

You MUST maintain a todo list for this turn.

### Writing the plan
- First action: write_todos with concrete steps for THIS question.
- Name subject matter in each item. Split multi-part asks (e.g. math + research).
- First plan: pending or exactly one in_progress. Do not mark completed until
  the work for that step actually finished (tools ran).

### Updating
- Exactly one in_progress at a time (unless you intentionally run parallel
  subagents for independent steps — then tick each as they finish).
- When a step is done, write_todos immediately: completed + next in_progress.
- At most one write_todos per model turn (never in parallel with other tools).

### Finishing
- Before the final answer, every todo must be completed.
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
    """MCP agent tools use `agent__tool`; skip planning/fs/meta tools."""
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


def _state_messages(state: Any) -> list:
    if state is None:
        return []
    if isinstance(state, dict):
        messages = state.get("messages") or []
    else:
        messages = getattr(state, "messages", None) or []
    return list(messages) if isinstance(messages, list) else []


def _any_domain_tool_used(state: Any) -> bool:
    for msg in _state_messages(state):
        if _domain_agent_id(getattr(msg, "name", None)):
            return True
        for tc in getattr(msg, "tool_calls", None) or []:
            tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            if _domain_agent_id(tc_name):
                return True
        # Nested task counts as having used tools once the subagent ran domain tools;
        # also treat task itself as progress so we don't block forever if MCP is
        # only inside the subagent.
        for tc in getattr(msg, "tool_calls", None) or []:
            tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            if tc_name == "task":
                return True
    return False


def _last_action_kind(state: Any) -> str | None:
    """Most recent tool action: write_todos | task | domain | other."""
    for msg in reversed(_state_messages(state)):
        for tc in getattr(msg, "tool_calls", None) or []:
            tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            if tc_name == "write_todos":
                return "write_todos"
            if tc_name == "task":
                return "task"
            if _is_domain_tool_name(tc_name):
                return "domain"
            if tc_name:
                return "other"
        name = getattr(msg, "name", None)
        if name == "write_todos":
            return "write_todos"
        if name == "task":
            return "task"
        if _is_domain_tool_name(name):
            return "domain"
    return None


def _todos_all_completed(state: Any) -> bool:
    todos = _state_todos(state)
    return bool(todos) and all((t.get("status") or "") == "completed" for t in todos)


def _append_system_nudge(request: ModelRequest, nudge: str) -> Any:
    existing = request.system_message
    if existing is None:
        from langchain_core.messages import SystemMessage

        return SystemMessage(content=nudge)
    from langchain_core.messages import SystemMessage

    base = existing.content
    if isinstance(base, str):
        return SystemMessage(content=f"{base}\n\n{nudge}")
    if isinstance(base, list):
        return SystemMessage(
            content=[*base, {"type": "text", "text": f"\n\n{nudge}"}]
        )
    return SystemMessage(content=f"{base}\n\n{nudge}")


@wrap_model_call  # type: ignore[arg-type]
async def force_todos_when_empty(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """First model call must create a plan via write_todos."""
    if _state_todos(request.state):
        return await handler(request)

    tool_names = {_tool_name(t) for t in (request.tools or [])}
    if "write_todos" not in tool_names:
        return await handler(request)

    return await handler(request.override(tool_choice="write_todos"))


@wrap_model_call  # type: ignore[arg-type]
async def force_domain_tool_once(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """After a plan exists, require at least one real tool (or task) before finishing."""
    todos = _state_todos(request.state)
    if not todos:
        return await handler(request)
    if _any_domain_tool_used(request.state):
        return await handler(request)

    domain = [t for t in (request.tools or []) if _is_domain_tool_name(_tool_name(t))]
    names = {_tool_name(t) for t in (request.tools or [])}

    if not domain:
        if "task" in names:
            nudge = (
                "HARD REQUIREMENT: call task (general-purpose) for a multi-tool "
                "batch, or answer only if no tools apply. Do not invent facts."
            )
            task_tools = [t for t in (request.tools or []) if _tool_name(t) == "task"]
            return await handler(
                request.override(
                    tools=task_tools,
                    tool_choice="task",
                    system_message=_append_system_nudge(request, nudge),
                )
            )
        return await handler(request)

    nudge = (
        "HARD REQUIREMENT: Enabled tools are in your list. Call at least one "
        "relevant tool now (direct MCP, or task for a multi-tool batch). Do not "
        "mark tool-backed todos completed or write the final answer from memory."
    )
    extras = [
        t for t in (request.tools or [])
        if _tool_name(t) == "task" or t in domain
    ]
    return await handler(
        request.override(
            tools=extras or domain,
            tool_choice="any",
            system_message=_append_system_nudge(request, nudge),
        )
    )


@wrap_model_call  # type: ignore[arg-type]
async def force_tick_todos_after_work(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """After tools/task return, force a plan tick so the UI advances live."""
    todos = _state_todos(request.state)
    if not todos or _todos_all_completed(request.state):
        return await handler(request)

    last = _last_action_kind(request.state)
    if last not in {"domain", "task"}:
        return await handler(request)

    names = {_tool_name(t) for t in (request.tools or [])}
    if "write_todos" not in names:
        return await handler(request)

    nudge = (
        "HARD REQUIREMENT: tool work just finished. Call write_todos NOW — mark "
        "finished step(s) completed and set the next unfinished step to "
        "in_progress. Do not mark the entire plan completed unless every step "
        "is truly done. Do not call more tools in this turn."
    )
    return await handler(
        request.override(
            tool_choice="write_todos",
            system_message=_append_system_nudge(request, nudge),
        )
    )


_GP_SUBAGENT = {
    "name": "general-purpose",
    "description": (
        "Multi-tool research batch for ONE concern — several related searches, "
        "or search + calc that depends on those results. Not for a single "
        "trivial tool call."
    ),
    "system_prompt": (
        "Complete ONLY the objective in the task description. Do not invent "
        "extra work that is not written there.\n"
        "- Prefer at most 6 tool calls; stop once you have reliable figures.\n"
        "- If the description is research/lookup only, do not run unrelated "
        "arithmetic.\n"
        "- Return a concise brief with numbers and sources. The parent only "
        "sees your final message."
    ),
}


def build_deep_agent(
    checkpointer: MemorySaver | None = None,
    tools: list | None = None,
    skills: Optional[list[str]] = None,
):
    """Build deep_agent with a scoped general-purpose subagent."""
    resolved_tools = list(tools if tools is not None else TOOLS)
    if not any(getattr(t, "name", None) == "cite_sources" for t in resolved_tools):
        resolved_tools = [*resolved_tools, cite_sources]

    middleware: list = [
        TodoListMiddleware(system_prompt=_TODO_SYSTEM_PROMPT),
        force_todos_when_empty,
        force_domain_tool_once,
        force_tick_todos_after_work,
        configurable_model,
        dynamic_system_prompt,
    ]

    skill_list = list(skills or [])
    if "/skills/research/" not in skill_list:
        skill_list.append("/skills/research/")

    # Override default GP so it stays scoped + brief (DeepAgents skips auto-GP
    # when a same-named subagent is provided).
    kwargs: dict = dict(
        model=settings.MODEL or "google_genai:gemini-3.8-flash",
        tools=resolved_tools,
        system_prompt=_SYSTEM_PROMPT,
        context_schema=Context,
        middleware=middleware,
        name="deep_agent",
        checkpointer=checkpointer,
        skills=skill_list,
        subagents=[_GP_SUBAGENT],
        backend=FilesystemBackend(
            root_dir=str(BACKEND_DIR),
            virtual_mode=True,
        ),
    )

    return create_deep_agent(**kwargs)
