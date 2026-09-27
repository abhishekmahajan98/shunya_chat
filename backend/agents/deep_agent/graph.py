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
from config import settings
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
4. Gather ONE plan step at a time. Prefer task→gatherer for the single
   in_progress gather todo (pass only that step's text — never pack later
   todos into the same gatherer call). When gatherer returns: write_todos
   (mark it completed, next gather step in_progress), then call gatherer
   again for the next gather step. Repeat until gather todos are done.
5. Synthesize from evidence only (tool results), not training-data guesses.
   Do NOT call verifier until gather (and synthesize) for this turn are done.
6. REQUIRED: call task with subagent_type="verifier" after gathering/synthesizing.
   Do this before cite_sources and before the final answer. Never skip verify.
7. AFTER verifier returns: write the complete user-facing final answer in your
   own voice (do not stop at cite_sources / write_todos alone). Then cite_sources
   and mark ALL todos completed.

Rules:
- Your tool list is authoritative. If a tool (or task) is listed, you HAVE it —
  never claim it is unavailable.
- Prefer enabled tools over guessing when they can answer the question.
- Use EVERY enabled agent family the question needs across the gather loop
  (e.g. calculator on step 1 via gatherer, search on step 2 via gatherer).
  One calculator call does not finish a research todo.
- Most tools do NOT return a citations key — use cite_sources.
- Read and follow skills when listed.
- Do not give the final answer while any todo is still pending/in_progress.
- Do not give the final answer until task→verifier has run this turn.
- When the task tool is the only allowed choice after gather, you MUST use
  subagent_type="verifier" (not gatherer).
- For truly trivial one-step asks only, you may skip gather — but verifier is
  still required unless the runtime did not expose the task tool.
"""

_TODO_SYSTEM_PROMPT = """## write_todos (required backbone)

You MUST maintain a todo list for this turn.

### Writing the plan
- First action: write_todos with concrete steps tailored to THIS user question.
- Include the subject matter in each item (who/what/which claim), not vague labels.
- Cover gather → synthesize → verify (split gather/verify into multiple specific
  items when the question has several parts).
- Include an explicit verify step that will be done via task→verifier.
- First plan: statuses are pending or exactly one in_progress. Do NOT mark
  anything completed until tools have finished that step.
- Bad: "Gather evidence", "Synthesize answer", "Verify claims"
- Good: "Look up current docs for X API parameter", "Draft comparison of X vs Y",
  "Verify pricing claim via task→verifier"

### Updating as you work
- Exactly one item in_progress at a time.
- The moment a step is done, write_todos again: mark it completed, set the next
  to in_progress. Never batch all completions at the end.
- Revise the list if new sub-tasks appear.

### Finishing
- Before the final user-facing answer: task→verifier must have run, and every
  todo must be completed.
- Call write_todos at most once per model turn (never in parallel).
"""

_GATHERER_PROMPT = """You are a gatherer subagent. Your job is to collect evidence for
ONE delegated plan step only (the description you were given).

Before calling anything:
1. Inventory EVERY tool in your tool list (names + what each can do).
2. Map THIS step only to which tools are relevant — ignore other plan steps.
3. Use every relevant tool family for this step; skip tools that do not help it.
4. Do NOT use filesystem tools (glob/ls/grep/read/write) unless the step is
   explicitly about local files. Never glob "*".

While working:
- Prefer direct tool calls over guessing or relying on prior knowledge.
- If several tools apply to THIS step, call them and combine results.
- Return a structured brief: what you found, key values, which tools you used,
  and any sources/ids.
- Do not work on later todos, synthesize, verify, or write the final answer.
- If a needed capability is missing from your tool list, say what is missing —
  do not fake it.
"""

_VERIFIER_PROMPT = """You are a verifier subagent. Challenge an EXISTING draft —
do not perform primary research or fill in work the gatherer skipped.

Hard limits:
- At most 3 tool calls total for this entire verification.
- For math: ONE recalculation of the claimed expression is enough — do not
  re-derive with multiply/add/divide/subtract variants.
- For facts: at most ONE or TWO targeted re-fetches of specific claims already
  in the draft. No broad new research queries.
- Do NOT use filesystem tools (glob/ls/read/write). Do NOT explore the repo.

Return: confirmed points, disputed points, gaps, and suggested fixes.
Do not rewrite the full user-facing answer.
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


def _state_messages(state: Any) -> list:
    if state is None:
        return []
    if isinstance(state, dict):
        messages = state.get("messages") or []
    else:
        messages = getattr(state, "messages", None) or []
    return list(messages) if isinstance(messages, list) else []


def _used_domain_agents(state: Any) -> set[str]:
    used: set[str] = set()
    for msg in _state_messages(state):
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


def _task_args(tc: Any) -> dict:
    if isinstance(tc, dict):
        args = tc.get("args") or tc.get("arguments") or {}
    else:
        args = getattr(tc, "args", None) or {}
    return args if isinstance(args, dict) else {}


def _task_subagent_types_used(state: Any) -> set[str]:
    """Which task(subagent_type=…) values have been invoked this turn."""
    used: set[str] = set()
    for msg in _state_messages(state):
        for tc in getattr(msg, "tool_calls", None) or []:
            tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            if tc_name != "task":
                continue
            args = _task_args(tc)
            sub = (
                args.get("subagent_type")
                or args.get("agent")
                or args.get("name")
                or ""
            )
            sub = str(sub).strip().lower()
            if sub:
                used.add(sub)
    return used


def _verifier_used(state: Any) -> bool:
    return "verifier" in _task_subagent_types_used(state)


def _gatherer_used(state: Any) -> bool:
    return "gatherer" in _task_subagent_types_used(state)


def _any_domain_tool_used(state: Any) -> bool:
    return bool(_used_domain_agents(state))


def _enabled_domain_agents(tools: Sequence[Any] | None) -> set[str]:
    agents: set[str] = set()
    for t in tools or []:
        agent = _domain_agent_id(_tool_name(t))
        if agent:
            agents.add(agent)
    return agents


def _is_verify_todo(todo: Any) -> bool:
    if not isinstance(todo, dict):
        return False
    content = str(todo.get("content") or "").lower()
    return "verif" in content


def _is_synthesize_todo(todo: Any) -> bool:
    if not isinstance(todo, dict):
        return False
    content = str(todo.get("content") or "").lower()
    return any(
        k in content
        for k in ("synthes", "draft", "compile", "write the answer", "write answer")
    )


def _is_gather_todo(todo: Any) -> bool:
    """Anything that is not synthesize / verify / cite is gather work."""
    if not isinstance(todo, dict):
        return False
    if _is_verify_todo(todo) or _is_synthesize_todo(todo):
        return False
    content = str(todo.get("content") or "").lower()
    if "cite" in content or content.startswith("record source"):
        return False
    return True


def _in_progress_todo(state: Any) -> dict | None:
    for t in _state_todos(state):
        if isinstance(t, dict) and t.get("status") == "in_progress":
            return t
    return None


def _outstanding_gather_todos(state: Any) -> list[dict]:
    out: list[dict] = []
    for t in _state_todos(state):
        if not _is_gather_todo(t):
            continue
        if (t.get("status") or "pending") != "completed":
            out.append(t)
    return out


def _todo_content(todo: dict | None) -> str:
    if not todo:
        return ""
    return str(todo.get("content") or "").strip()


def _last_tool_action(state: Any) -> str | None:
    """Most recent tool action: write_todos | gatherer | verifier | domain | other."""
    for msg in reversed(_state_messages(state)):
        for tc in getattr(msg, "tool_calls", None) or []:
            tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            if tc_name == "write_todos":
                return "write_todos"
            if tc_name == "task":
                args = _task_args(tc)
                sub = str(
                    args.get("subagent_type")
                    or args.get("agent")
                    or args.get("name")
                    or ""
                ).strip().lower()
                if sub in {"gatherer", "verifier"}:
                    return sub
                return "task"
            if _is_domain_tool_name(tc_name):
                return "domain"
            if tc_name:
                return "other"
        name = getattr(msg, "name", None)
        if name == "write_todos":
            return "write_todos"
        if name == "task":
            # ToolMessage for task — treat as gatherer if that was last subagent used
            # Prefer AIMessage tool_calls above; this is a fallback.
            used = _task_subagent_types_used(state)
            if "verifier" in used and "gatherer" not in used:
                return "verifier"
            if "gatherer" in used:
                return "gatherer"
            return "task"
        if _is_domain_tool_name(name):
            return "domain"
    return None


def _non_verify_todos_complete(state: Any) -> bool:
    """True when every todo that is not a verify step is completed."""
    todos = _state_todos(state)
    if not todos:
        return False
    outstanding = [
        t for t in todos
        if not _is_verify_todo(t) and (t.get("status") or "pending") != "completed"
    ]
    return not outstanding


def _ready_for_verifier(state: Any, tools: Sequence[Any] | None = None) -> bool:
    """Gather is done only after real coverage — not a single opportunistic tool call.

    Ready when:
    - task→gatherer ran, OR every enabled domain agent family was used once
    And non-verify todos are completed (when a plan exists).
    """
    if not (_gatherer_used(state) or _any_domain_tool_used(state)):
        return False

    # Still have gather steps open → not ready
    if _outstanding_gather_todos(state):
        return False

    enabled = _enabled_domain_agents(tools)
    used = _used_domain_agents(state)
    if enabled and not _gatherer_used(state):
        # One calculator call must not unlock verifier while search is still unused
        if not enabled.issubset(used):
            return False

    if _state_todos(state) and not _non_verify_todos_complete(state):
        return False

    return True


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
async def force_mcp_once_after_plan(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """Drive gather one plan step at a time: gatherer → tick todos → gatherer…

    After a gatherer returns, force write_todos so step N is completed and
    step N+1 becomes in_progress before the next gatherer call.
    """
    todos = _state_todos(request.state)
    if not todos:
        return await handler(request)
    if _verifier_used(request.state):
        return await handler(request)
    if _ready_for_verifier(request.state, request.tools):
        return await handler(request)

    names = {_tool_name(t) for t in (request.tools or [])}
    in_prog = _in_progress_todo(request.state)
    outstanding_gather = _outstanding_gather_todos(request.state)
    last = _last_tool_action(request.state)

    # Let the parent draft during synthesize — do not steal the turn for tools
    if in_prog and _is_synthesize_todo(in_prog) and not outstanding_gather:
        return await handler(request)

    # After gatherer (or domain gather) returns, tick the plan before next gather
    if (
        outstanding_gather
        and last in {"gatherer", "domain"}
        and "write_todos" in names
    ):
        focus = _todo_content(in_prog) or _todo_content(outstanding_gather[0])
        nudge = (
            "HARD REQUIREMENT: a gather step just finished. Call write_todos now: "
            "mark the completed gather step completed, set the NEXT gather step "
            f'to in_progress (focus was: "{focus[:180]}"). Do NOT call gatherer, '
            "verifier, or answer yet."
        )
        return await handler(
            request.override(
                tool_choice="write_todos",
                system_message=_append_system_nudge(request, nudge),
            )
        )

    # Still have gather todos → gatherer for the single in_progress step only
    if outstanding_gather and "task" in names:
        focus = _todo_content(in_prog) if (in_prog and _is_gather_todo(in_prog)) else ""
        if not focus:
            focus = _todo_content(outstanding_gather[0])
        nudge = (
            'HARD REQUIREMENT: call task with subagent_type="gatherer" for ONLY '
            f'this in-progress gather step: "{focus[:220]}". Do NOT include later '
            "todos in the description. After it returns you will write_todos and "
            "call gatherer again for the next gather step. Do NOT call verifier."
        )
        task_tools = [t for t in (request.tools or []) if _tool_name(t) == "task"]
        return await handler(
            request.override(
                tools=task_tools,
                tool_choice="task",
                system_message=_append_system_nudge(request, nudge),
            )
        )

    # No gather todos left but coverage still incomplete — force remaining MCP
    domain = [t for t in (request.tools or []) if _is_domain_tool_name(_tool_name(t))]
    if not domain:
        return await handler(request)

    enabled = _enabled_domain_agents(request.tools)
    used = _used_domain_agents(request.state)
    missing = enabled - used
    remaining = [
        t for t in domain
        if _domain_agent_id(_tool_name(t)) in missing
    ] or domain
    nudge = (
        "HARD REQUIREMENT: Enabled tools are available. Call a relevant tool "
        "now for unfinished gather work"
        + (f" (still unused: {', '.join(sorted(missing))})" if missing else "")
        + ". Do not write the final answer from memory. Do NOT call verifier yet."
    )
    return await handler(
        request.override(
            tools=remaining,
            tool_choice="any",
            system_message=_append_system_nudge(request, nudge),
        )
    )


@wrap_model_call  # type: ignore[arg-type]
async def force_verifier_before_finish(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """Hard-require task→verifier after gather coverage is actually complete."""
    todos = _state_todos(request.state)
    if not todos:
        return await handler(request)
    if _verifier_used(request.state):
        return await handler(request)
    if not _ready_for_verifier(request.state, request.tools):
        return await handler(request)

    tools = list(request.tools or [])
    task_tools = [t for t in tools if _tool_name(t) == "task"]
    if not task_tools:
        return await handler(request)

    nudge = (
        'HARD REQUIREMENT for this turn: call the task tool with '
        'subagent_type="verifier" only. Do NOT call gatherer. Do NOT answer yet. '
        "Verifier must only re-check the draft — not do primary research."
    )
    return await handler(
        request.override(
            tools=task_tools,
            tool_choice="task",
            system_message=_append_system_nudge(request, nudge),
        )
    )


def _rsv_subagents(tools: list) -> list[dict]:
    """Gather/verify helpers share enabled MCP tools only (no filesystem).

    Include configurable_model so subagents use Context.model (Gemini etc.),
    not the create_deep_agent Anthropic placeholder.
    FilesystemMiddleware(tools=[]) disables inherited glob/ls/etc. on subagents.
    """
    from deepagents.middleware.filesystem import (
        FilesystemMiddleware,
        FilesystemPermission,
    )

    # Domain MCP tools only — drop cite_sources / meta if present
    available = [
        t
        for t in (tools or [])
        if _is_domain_tool_name(_tool_name(t))
    ]
    # read_file is required by FilesystemMiddleware; deny all paths so glob/ls
    # never appear and reads are blocked.
    no_fs = FilesystemMiddleware(
        tools=["read_file"],
        _permissions=[
            FilesystemPermission(
                operations=["read", "write"],
                paths=["/**"],
                mode="deny",
            )
        ],
    )
    sub_middleware = [configurable_model, no_fs]
    return [
        {
            "name": "gatherer",
            "description": (
                "Gather evidence for ONE in-progress plan step only. Pass only "
                "that step's text. After it returns, write_todos and call again "
                "for the next gather step — do not pack multiple todos into one call."
            ),
            "system_prompt": _GATHERER_PROMPT,
            "tools": available,
            "middleware": sub_middleware,
        },
        {
            "name": "verifier",
            "description": (
                "REQUIRED before the final answer. Light re-check only (≤3 tool "
                "calls): one math recompute and/or 1–2 targeted fact re-fetches. "
                'Call via task(subagent_type="verifier") after gather/synthesize. '
                "Do not use for primary research."
            ),
            "system_prompt": _VERIFIER_PROMPT,
            "tools": available,
            "middleware": sub_middleware,
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
        force_mcp_once_after_plan,
        force_verifier_before_finish,
        configurable_model,
        dynamic_system_prompt,
    ]

    skill_list = list(skills or [])
    if "/skills/research/" not in skill_list:
        skill_list.append("/skills/research/")

    kwargs: dict = dict(
        # Default/fallback model for subagents; main agent still overridden by Context.
        model=settings.MODEL or "google_genai:gemini-3.8-flash",
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
