"""Resolve optional per-agent skills for DeepAgents SkillsMiddleware."""

from __future__ import annotations

from pathlib import Path

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
    """Agent skills plus the research orchestration skill when present.

    Paths are virtual (POSIX) relative to FilesystemBackend root_dir=BACKEND_DIR,
    e.g. `/skills/search/`.
    """
    sources = [f"/skills/{agent_id}/" for agent_id in agents_with_skills(agent_ids)]
    research = "/skills/research/"
    if (SKILLS_DIR / "research" / "SKILL.md").is_file() and research not in sources:
        sources.append(research)
    return sources


def skill_status_label(agent_ids: list[str]) -> tuple[str, str]:
    """Friendly label/detail for the prep skills line."""
    from mcp_servers import AGENT_CATALOG

    names_by_id = {a["id"]: a["name"] for a in AGENT_CATALOG}
    skilled = agents_with_skills(agent_ids)
    names = [names_by_id.get(aid, aid) for aid in skilled]
    if (SKILLS_DIR / "research" / "SKILL.md").is_file():
        names = [*names, "Research"]
    if not names:
        return ("", "")
    seen: set[str] = set()
    ordered: list[str] = []
    for n in names:
        if n not in seen:
            seen.add(n)
            ordered.append(n)
    return (f"Loaded SKILLS for {', '.join(ordered)}", ", ".join(ordered))
