from typing import Optional

from pydantic import BaseModel


class AgentInfo(BaseModel):
    """A capability agent the user can enable in the UI (maps to /mcp/{id})."""

    id: str
    name: str
    description: str


class AgentRegistry:
    """User-facing capability agents backed by localhost MCP mounts."""

    @classmethod
    def get_all_agents(cls) -> list[AgentInfo]:
        from mcp_servers import AGENT_CATALOG

        return [AgentInfo(**row) for row in AGENT_CATALOG]

    @classmethod
    def get_agent_info(cls, agent_id: str) -> Optional[AgentInfo]:
        for agent in cls.get_all_agents():
            if agent.id == agent_id:
                return agent
        return None


def get_available_agents() -> list[AgentInfo]:
    return AgentRegistry.get_all_agents()
