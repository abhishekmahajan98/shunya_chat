"""Capability agents the UI can toggle — backed by the DB agents registry."""

from typing import Literal, Optional

from pydantic import BaseModel


class AgentInfo(BaseModel):
    """A capability agent the user can enable in the UI."""

    id: str
    name: str
    description: str
    auth: Literal[
        "none", "env_api_key", "user_api_key", "oauth_dcr", "oauth_static"
    ] = "none"
    mcp_url: Optional[str] = None
    connected: Optional[bool] = None
    ready: bool = True
    ready_reason: Optional[str] = None


class AgentRegistry:
    @classmethod
    def get_all_agents(cls, user_id: Optional[str] = None) -> list[AgentInfo]:
        from db.agents import (
            env_keys_satisfied,
            is_credential_connected,
            list_enabled_agents,
        )

        out: list[AgentInfo] = []
        for agent in list_enabled_agents():
            connected: Optional[bool] = None
            ready = True
            reason: Optional[str] = None
            if agent.auth == "env_api_key":
                ready = env_keys_satisfied(agent)
                reason = None if ready else "missing_env"
            elif agent.needs_user_credential:
                connected = (
                    is_credential_connected(user_id, agent.id) if user_id else False
                )
                ready = bool(connected)
                reason = None if ready else "not_connected"
            out.append(
                AgentInfo(
                    id=agent.id,
                    name=agent.name,
                    description=agent.description,
                    auth=agent.auth,  # type: ignore[arg-type]
                    mcp_url=agent.mcp_url or None,
                    connected=connected,
                    ready=ready,
                    ready_reason=reason,
                )
            )
        return out

    @classmethod
    def get_agent_info(cls, agent_id: str) -> Optional[AgentInfo]:
        for agent in cls.get_all_agents():
            if agent.id == agent_id:
                return agent
        return None


def get_available_agents(user_id: Optional[str] = None) -> list[AgentInfo]:
    return AgentRegistry.get_all_agents(user_id=user_id)
