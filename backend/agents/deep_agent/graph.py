"""Deep agent — DeepAgents create_deep_agent harness (LangChain underneath).

Single ReAct loop: plan → call MCP tools directly and/or spawn general-purpose
subagents via task (serial or parallel). Soft policy; minimal force middleware.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Optional

from deepagents import create_deep_agent
from deepagents.backends.filesystem import FilesystemBackend
from deepagents.middleware.skills import SkillsMiddleware
from langchain.agents.middleware import (
    ModelRequest,
    ModelResponse,
    TodoListMiddleware,
    wrap_model_call,
)
from langgraph.checkpoint.memory import MemorySaver

from agents.deep_agent.tools import TOOLS
from agents.model import Context, configurable_model, dynamic_system_prompt
from agents.skills_loader import (
    BACKEND_DIR,
    make_load_skill_tool,
    skill_ids_from_sources,
)
from config import settings
from services.citations import cite_sources

_SYSTEM_PROMPT = """You are a capable multi-step assistant.
Thoroughness beats speed — latency is acceptable.

## Plan
1. FIRST use your planning/todo tool with steps SPECIFIC to this user question
   (entities, metrics, capabilities). No bare generics like only "Gather evidence".
2. Exactly one item in_progress. After EACH step's tools finish, update the plan
   AGAIN before the next step — mark the finished item completed and set the
   next to in_progress. Never leave the whole list pending until the end, and
   never mark everything completed in one shot after all tools.
3. Do not give the final answer while any todo is still pending/in_progress.

## Tools — when YOU call vs when you delegate
- Your tool list is authoritative. Use every enabled capability the question needs.
- If a needed capability is missing from the tool list, it is OFF. Do not fake it.
  Tell the user which capability to enable, finish the plan, and answer only what
  you can without inventing tool results.
- ONE trivial call (single lookup, single expression) → call that tool yourself.
  Do not spawn a subagent for that.
- Multi-tool research batches (several related lookups, or lookup + compute that
  depends on those results) → delegate via the subagent/task tool for that plan
  step ONLY when the needed tools are in your list. Do not delegate just to poke
  the workspace filesystem.
- Standalone arithmetic → call the math/calculator capability yourself when
  present (or a separate parallel subagent). Never bolt it onto an unrelated
  research brief.
- Independent concerns MAY run in PARALLEL (multiple subagent calls, and/or
  you calling a tool while a subagent runs).
- After a subagent returns: update the plan (tick that step), then continue.
- Most tools do NOT return citations — use the citation tool when you relied on
  external/tool facts.
- Skills: see **Available Skills**. Before the first tool from an agent that
  has a skill (`agent__…`), call `load_skill(name="<skill>")` once and follow
  it. Do not use raw read_file for SKILL.md. Skip skills for agents you are
  not using. Bundled skill resources: read later only if the skill says so.
- Re-check contested claims with a direct tool call, or another short subagent.

## Workspace filesystem (skills only)
- Prefer `load_skill` for skill instructions. Workspace file tools are for
  skill *resource* files the skill points at — NOT world facts, news, or math.
- NEVER search the workspace for real-world data. Use the matching enabled tools,
  or say those capabilities are off.

## Subagent scope (hard rules)
- ONE concern per delegation — map to a single plan step. Never paste the whole
  plan or unrelated steps into one description.
- Pass a clear description of only that step's work.
- Do not mark a tool-backed todo completed until that tool/subagent has actually run.

## Finish
Cite sources if needed, mark ALL todos completed, then write the full
user-facing final answer in your own voice.
"""

_TODO_SYSTEM_PROMPT = """## Planning / todo list (required backbone)

You MUST maintain a todo list for this turn via the planning tool in your list.

### Writing the plan
- First action: create concrete steps for THIS question.
- Name subject matter in each item. Split multi-part asks (e.g. math + research).
- First plan: pending or exactly one in_progress. Do not mark completed until
  the work for that step actually finished (tools ran).

### Updating
- Exactly one in_progress at a time (unless you intentionally run parallel
  subagents for independent steps — then tick each as they finish).
- When a step is done, update the plan immediately: completed + next in_progress.
- At most one plan update per model turn (never in parallel with other tools).

### Finishing
- Before the final answer, every todo must be completed.
"""

# Replaces DeepAgents' default "progressive disclosure / read when needed"
# catalog copy — we want agent skills read before that agent's tools.
_SKILLS_CATALOG_PROMPT = """## Skills

{skills_locations}{skills_load_warnings}

**Available Skills** (skill `name` matches the agent id; tools look like `name__…`):

{skills_list}

**Required:** Before the first call to any tool for an agent that has a skill
listed above, call `load_skill` with that skill's `name` and follow the returned
instructions. Do not skip this when those tools are in your list. Skip skills
for agents you are not using this turn. Use `read_file` only for bundled skill
resource files the loaded skill tells you to open — not for SKILL.md itself.
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
        "load_skill",
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
        if isinstance(msg, dict) and _domain_agent_id(msg.get("name")):
            return True
        for tc in getattr(msg, "tool_calls", None) or []:
            tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            if _domain_agent_id(tc_name) or tc_name == "task":
                return True
        if isinstance(msg, dict):
            for tc in msg.get("tool_calls") or []:
                tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
                if _domain_agent_id(tc_name) or tc_name == "task":
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


def _tc_name(tc: Any) -> str | None:
    if isinstance(tc, dict):
        name = tc.get("name")
        if name:
            return str(name)
        fn = tc.get("function")
        if isinstance(fn, dict) and fn.get("name"):
            return str(fn["name"])
        return None
    return getattr(tc, "name", None)


def _tc_args(tc: Any) -> dict:
    import json

    raw: Any = None
    if isinstance(tc, dict):
        raw = tc.get("args") or tc.get("arguments") or tc.get("input")
        if raw is None:
            fn = tc.get("function")
            if isinstance(fn, dict):
                raw = fn.get("arguments") or fn.get("args")
    else:
        raw = getattr(tc, "args", None) or getattr(tc, "arguments", None)
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = {}
    if raw is None:
        return {}
    if hasattr(raw, "model_dump"):
        try:
            return dict(raw.model_dump())
        except Exception:
            return {}
    return raw if isinstance(raw, dict) else {}


def _load_skill_enum(tools: list | None) -> list[str]:
    """Skill names advertised by the load_skill tool schema."""
    for tool in tools or []:
        if _tool_name(tool) != "load_skill":
            continue
        schema = getattr(tool, "args_schema", None)
        if schema is None:
            continue
        try:
            props = schema.model_json_schema().get("properties", {})
            enum = (props.get("name") or {}).get("enum")
            if enum:
                return [str(x) for x in enum]
        except Exception:
            continue
    return []


def _skills_loaded_ids(state: Any) -> set[str]:
    """Skill names already returned by load_skill in this agent run."""
    import re

    found: set[str] = set()
    for msg in _state_messages(state):
        for tc in getattr(msg, "tool_calls", None) or []:
            if _tc_name(tc) != "load_skill":
                continue
            name = _tc_args(tc).get("name")
            if name:
                found.add(str(name))
        if isinstance(msg, dict):
            for tc in msg.get("tool_calls") or []:
                if _tc_name(tc) != "load_skill":
                    continue
                name = _tc_args(tc).get("name")
                if name:
                    found.add(str(name))
        msg_name = getattr(msg, "name", None) or (
            msg.get("name") if isinstance(msg, dict) else None
        )
        if msg_name != "load_skill":
            continue
        content = getattr(msg, "content", None)
        if isinstance(msg, dict):
            content = msg.get("content", content)
        text = str(content or "")
        m = re.search(r'name="([^"]+)"', text)
        if m:
            found.add(m.group(1))
    return found


def _skills_ready(request: ModelRequest) -> bool:
    needed = _load_skill_enum(list(request.tools or []))
    if not needed:
        return True
    loaded = _skills_loaded_ids(request.state)
    return all(n in loaded for n in needed)


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
async def force_load_skills_once(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """After planning, require load_skill for each catalog skill before domain tools.

    Detection uses load_skill tool calls/results (reliable). Soft prompts alone
    were not enough — the model skipped straight to search/calculator.
    """
    names = {_tool_name(t) for t in (request.tools or [])}
    if "load_skill" not in names:
        return await handler(request)

    if "write_todos" in names and not _state_todos(request.state):
        return await handler(request)

    if _any_domain_tool_used(request.state):
        return await handler(request)

    needed = _load_skill_enum(list(request.tools or []))
    if not needed:
        return await handler(request)

    loaded = _skills_loaded_ids(request.state)
    missing = [n for n in needed if n not in loaded]
    if not missing:
        return await handler(request)

    # Circuit breaker if results exist but path/name parse failed
    load_results = sum(
        1
        for msg in _state_messages(request.state)
        if (getattr(msg, "name", None) == "load_skill")
        or (isinstance(msg, dict) and msg.get("name") == "load_skill")
    )
    if load_results >= len(needed):
        return await handler(request)

    load_tools = [t for t in (request.tools or []) if _tool_name(t) == "load_skill"]
    nudge = (
        "HARD REQUIREMENT: Before any domain/agent tools or subagent "
        "delegation, call load_skill for each missing skill (parallel OK): "
        f"{', '.join(missing)}. Do not call other tools in this turn."
    )
    return await handler(
        request.override(
            tools=load_tools,
            tool_choice="any",
            system_message=_append_system_nudge(request, nudge),
        )
    )


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

    # Skill load gate may leave only load_skill — wait for it
    if not _skills_ready(request):
        return await handler(request)

    domain = [t for t in (request.tools or []) if _is_domain_tool_name(_tool_name(t))]
    names = {_tool_name(t) for t in (request.tools or [])}

    # Only meta/fs tools (e.g. mid skill-load) — pass through
    if not domain and names and names <= {
        "load_skill",
        "read_file",
        "ls",
        "write_file",
        "edit_file",
        "delete",
        "glob",
        "grep",
        "execute",
        "write_todos",
        "cite_sources",
    }:
        return await handler(request)

    # No domain/MCP tools enabled — do NOT force subagent delegation.
    if not domain:
        nudge = (
            "No domain/agent tools are enabled in your tool list. Do not "
            "delegate to a subagent or use workspace file tools to look up "
            "world facts — the workspace is for skill instructions only. "
            "Mark todos completed and tell the user which agents/capabilities "
            "to enable, or answer without inventing tool data."
        )
        return await handler(
            request.override(system_message=_append_system_nudge(request, nudge))
        )

    nudge = (
        "HARD REQUIREMENT: Enabled tools are in your list. Call at least one "
        "relevant tool now (directly, or via a subagent for a multi-tool batch). "
        "Do not mark tool-backed todos completed or write the final answer "
        "from memory."
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
        "HARD REQUIREMENT: tool work just finished. Update the plan NOW — mark "
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


_GP_BASE = {
    "name": "general-purpose",
    "description": (
        "Multi-tool batch for ONE concern — several related lookups, or lookup "
        "+ compute that depends on those results. Only useful when the needed "
        "domain tools are enabled. Not for a single trivial call."
    ),
    "system_prompt": (
        "Complete ONLY the objective in the task description.\n"
        "- If a skill is listed for an agent you will use, call "
        "`load_skill(name=…)` once before that agent's tools, then follow it.\n"
        "- Prefer at most 6 tool calls; stop once you have reliable figures.\n"
        "- If the description is research/lookup only, do not run unrelated "
        "arithmetic.\n"
        "- Workspace file tools are for skill instructions only — NEVER search "
        "the disk for world facts, news, or math.\n"
        "- If the tools you need are not in your tool list, say so in one short "
        "brief and stop — do not thrash the workspace filesystem.\n"
        "- Return a concise brief. The parent only sees your final message."
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

    skill_list = list(skills or [])
    # Research orchestration skill only when MCP domain tools are actually on
    has_domain = any(
        _is_domain_tool_name(getattr(t, "name", None)) for t in resolved_tools
    )
    if has_domain and "/skills/research/" not in skill_list:
        skill_list.append("/skills/research/")

    skill_ids = skill_ids_from_sources(skill_list)
    load_skill_tool = make_load_skill_tool(skill_ids)
    if load_skill_tool is not None and not any(
        getattr(t, "name", None) == "load_skill" for t in resolved_tools
    ):
        resolved_tools = [*resolved_tools, load_skill_tool]

    backend = FilesystemBackend(
        root_dir=str(BACKEND_DIR),
        virtual_mode=True,
    )

    # Own SkillsMiddleware so we control catalog wording (create_deep_agent's
    # default says "read only when needed" which skips agent skills).
    skills_mw = (
        SkillsMiddleware(
            backend=backend,
            sources=skill_list,
            system_prompt=_SKILLS_CATALOG_PROMPT,
        )
        if skill_list
        else None
    )

    middleware: list = []
    if skills_mw is not None:
        middleware.append(skills_mw)
    middleware.extend(
        [
            TodoListMiddleware(system_prompt=_TODO_SYSTEM_PROMPT),
            force_todos_when_empty,
            force_load_skills_once,
            force_domain_tool_once,
            force_tick_todos_after_work,
            configurable_model,
            dynamic_system_prompt,
        ]
    )

    gp = dict(_GP_BASE)
    if skills_mw is not None:
        # Same catalog + skill gate for subagents (isolated history)
        gp["middleware"] = [skills_mw, force_load_skills_once]

    kwargs: dict = dict(
        model=settings.MODEL or "google_genai:gemini-3.8-flash",
        tools=resolved_tools,
        system_prompt=_SYSTEM_PROMPT,
        context_schema=Context,
        middleware=middleware,
        name="deep_agent",
        checkpointer=checkpointer,
        # skills=None: we inject SkillsMiddleware ourselves with a stricter prompt
        skills=None,
        subagents=[gp],
        backend=backend,
    )

    return create_deep_agent(**kwargs)
