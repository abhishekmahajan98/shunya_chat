"""Agent registry helpers — DB is source of truth; local FastMCP modules stay in code."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Literal, Optional

from db import get_store
from db.agent_seed import default_agents

AuthType = Literal["none", "env_api_key", "user_api_key", "oauth_dcr", "oauth_static"]

USER_AUTH_TYPES = frozenset({"user_api_key", "oauth_dcr", "oauth_static"})
OAUTH_AUTH_TYPES = frozenset({"oauth_dcr", "oauth_static"})


@dataclass(frozen=True)
class AgentRecord:
    id: str
    name: str
    description: str
    enabled: bool
    sort_order: int
    auth: AuthType
    mcp_url: str
    local_module: Optional[str]
    skill_id: Optional[str]
    scopes: tuple[str, ...]
    env_keys: tuple[str, ...]
    oauth_authorize_url: Optional[str]
    oauth_token_url: Optional[str]
    oauth_registration_url: Optional[str]
    oauth_revocation_url: Optional[str]
    client_id_env: Optional[str]
    client_secret_env: Optional[str]
    metadata: dict[str, Any]

    @property
    def module_key(self) -> str:
        return self.local_module or self.id

    @property
    def skill_key(self) -> str:
        return self.skill_id or self.id

    @property
    def is_in_process(self) -> bool:
        """Hosted in this process — load via FastMCP Client(module), not HTTP."""
        return bool(self.local_module)

    @property
    def needs_user_credential(self) -> bool:
        return self.auth in USER_AUTH_TYPES

    @property
    def is_oauth(self) -> bool:
        return self.auth in OAUTH_AUTH_TYPES


def _as_tuple(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        return (value,) if value else ()
    return tuple(str(x) for x in value if x is not None and str(x) != "")


def agent_from_row(row: dict[str, Any]) -> AgentRecord:
    return AgentRecord(
        id=row["id"],
        name=row.get("name") or row["id"],
        description=row.get("description") or "",
        enabled=bool(row.get("enabled", True)),
        sort_order=int(row.get("sort_order") or 0),
        auth=row.get("auth") or "none",  # type: ignore[arg-type]
        mcp_url=(row.get("mcp_url") or "").rstrip("/"),
        local_module=row.get("local_module"),
        skill_id=row.get("skill_id"),
        scopes=_as_tuple(row.get("scopes")),
        env_keys=_as_tuple(row.get("env_keys")),
        oauth_authorize_url=row.get("oauth_authorize_url"),
        oauth_token_url=row.get("oauth_token_url"),
        oauth_registration_url=row.get("oauth_registration_url"),
        oauth_revocation_url=row.get("oauth_revocation_url"),
        client_id_env=row.get("client_id_env"),
        client_secret_env=row.get("client_secret_env"),
        metadata=dict(row.get("metadata") or {}),
    )


def ensure_agents_seeded() -> None:
    store = get_store()
    store.ensure_agents_seeded(default_agents())


def list_enabled_agents() -> list[AgentRecord]:
    ensure_agents_seeded()
    rows = get_store().list_agents(enabled_only=True)
    return [agent_from_row(r) for r in rows]


def get_agent(agent_id: str) -> Optional[AgentRecord]:
    ensure_agents_seeded()
    row = get_store().get_agent(agent_id)
    if not row or not row.get("enabled", True):
        return None
    return agent_from_row(row)


def env_keys_satisfied(agent: AgentRecord) -> bool:
    if agent.auth != "env_api_key":
        return True
    return all(bool(os.getenv(k, "").strip()) for k in agent.env_keys)


def is_credential_connected(user_id: str, agent_id: str) -> bool:
    row = get_store().get_user_credential(user_id, agent_id)
    return bool(row and row.get("status") == "connected")
