"""Resolve optional per-agent skills for DeepAgents SkillsMiddleware."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Sequence

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field, create_model

# backend/ — parent of agents/
BACKEND_DIR = Path(__file__).resolve().parents[1]
SKILLS_DIR = BACKEND_DIR / "skills"


def agents_with_skills(agent_ids: list[str]) -> list[str]:
    """Return agent ids (preserving order) that have a SKILL.md on disk."""
    found: list[str] = []
    for agent_id in agent_ids:
        if (SKILLS_DIR / agent_id / "SKILL.md").is_file():
            found.append(agent_id)
    return found


def skill_sources_for_agents(agent_ids: list[str]) -> list[str]:
    """Per-selected-agent skills. Research only when search is enabled.

    Paths are virtual (POSIX) relative to FilesystemBackend root_dir=BACKEND_DIR,
    e.g. `/skills/search/`. With no agents selected, return [] — filesystem is
    only for reading those skill files, not a fact database.
    """
    if not agent_ids:
        return []
    from db.agents import get_agent

    sources: list[str] = []
    for agent_id in agent_ids:
        agent = get_agent(agent_id)
        skill_id = agent.skill_key if agent else agent_id
        if (SKILLS_DIR / skill_id / "SKILL.md").is_file():
            path = f"/skills/{skill_id}/"
            if path not in sources:
                sources.append(path)
    if "search" in agent_ids:
        research = "/skills/research/"
        if (SKILLS_DIR / "research" / "SKILL.md").is_file() and research not in sources:
            sources.append(research)
    return sources


def skill_ids_from_sources(sources: Sequence[str] | None) -> list[str]:
    """Derive skill ids from virtual source dirs like `/skills/search/`."""
    ids: list[str] = []
    seen: set[str] = set()
    for source in sources or []:
        parts = [p for p in str(source).replace("\\", "/").strip("/").split("/") if p]
        if not parts:
            continue
        sid = parts[1] if parts[0] == "skills" and len(parts) >= 2 else parts[-1]
        if sid and sid not in seen and (SKILLS_DIR / sid / "SKILL.md").is_file():
            seen.add(sid)
            ids.append(sid)
    return ids


def strip_skill_frontmatter(text: str) -> str:
    """Return SKILL.md body without YAML frontmatter."""
    raw = text or ""
    if not raw.lstrip().startswith("---"):
        return raw
    # Allow leading whitespace
    start = raw.find("---")
    rest = raw[start + 3 :]
    end = rest.find("---")
    if end < 0:
        return raw
    return rest[end + 3 :].lstrip("\n")


def list_skill_resources(skill_id: str) -> list[str]:
    """Relative paths of files under the skill dir excluding SKILL.md."""
    skill_dir = SKILLS_DIR / skill_id
    if not skill_dir.is_dir():
        return []
    out: list[str] = []
    for path in sorted(skill_dir.rglob("*")):
        if not path.is_file() or path.name == "SKILL.md":
            continue
        out.append(path.relative_to(skill_dir).as_posix())
    return out


def format_loaded_skill(skill_id: str) -> str:
    """SKILL.md body + resource listing for load_skill tool results."""
    skill_dir = SKILLS_DIR / skill_id
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        available = [
            p.name
            for p in sorted(SKILLS_DIR.iterdir())
            if p.is_dir() and (p / "SKILL.md").is_file()
        ]
        return (
            f"Error: unknown skill {skill_id!r}. "
            f"Available: {', '.join(available) or '(none)'}"
        )

    body = strip_skill_frontmatter(skill_md.read_text(encoding="utf-8"))
    resources = list_skill_resources(skill_id)
    lines = [
        f'<skill_content name="{skill_id}">',
        body.strip(),
        "",
        f"Skill directory (virtual): /skills/{skill_id}/",
    ]
    if resources:
        lines.append("<skill_resources>")
        for rel in resources:
            lines.append(f"  <file>{rel}</file>")
        lines.append("</skill_resources>")
        lines.append(
            "Read resource files with read_file "
            f"(path `/skills/{skill_id}/…`) only when these instructions say to."
        )
    else:
        lines.append("(No bundled resource files.)")
    lines.append("</skill_content>")
    return "\n".join(lines)


def make_load_skill_tool(skill_ids: Sequence[str]) -> Any | None:
    """Build load_skill with name constrained to the given skill ids."""
    from typing import Literal

    allowed = list(dict.fromkeys(skill_ids))
    if not allowed:
        return None

    name_annotation = Literal[*allowed]  # type: ignore[valid-type]

    LoadSkillInput = create_model(
        "LoadSkillInput",
        __base__=BaseModel,
        name=(
            name_annotation,
            Field(
                description=(
                    "Skill name from Available Skills. "
                    f"One of: {', '.join(allowed)}"
                ),
            ),
        ),
    )

    def load_skill(name: str) -> str:
        """Load full instructions for a skill listed under Available Skills."""
        return format_loaded_skill(str(name))

    return StructuredTool.from_function(
        name="load_skill",
        description=(
            "Load the full SKILL.md instructions for a skill in Available Skills. "
            "Call once per skill BEFORE the first tool from that agent "
            "(tools look like name__). Returns instructions and lists sibling "
            "resource files — do not eagerly read those unless the skill says to. "
            f"Valid names: {', '.join(allowed)}."
        ),
        func=load_skill,
        args_schema=LoadSkillInput,
    )


def skill_status_label(agent_ids: list[str]) -> tuple[str, str]:
    """Friendly label/detail for the prep skills line."""
    from db.agents import get_agent

    if not agent_ids:
        return ("", "")
    names: list[str] = []
    for aid in agent_ids:
        agent = get_agent(aid)
        skill_id = agent.skill_key if agent else aid
        if (SKILLS_DIR / skill_id / "SKILL.md").is_file():
            names.append(agent.name if agent else aid)
    if "search" in agent_ids and (SKILLS_DIR / "research" / "SKILL.md").is_file():
        names = [*names, "Research"]
    if not names:
        return ("", "")
    seen: set[str] = set()
    ordered: list[str] = []
    for n in names:
        if n not in seen:
            seen.add(n)
            ordered.append(n)
    return (
        f"Skills available: {', '.join(ordered)}",
        ", ".join(ordered),
    )
