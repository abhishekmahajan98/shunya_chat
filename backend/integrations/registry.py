"""Thin adapter for OAuth discovery — prefer AgentRecord fields; this is for discover_auth_server."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

AuthMode = Literal["oauth_dcr", "oauth_static"]


@dataclass(frozen=True)
class RemoteMcpProvider:
    """Legacy shape used by discover_auth_server; prefer db.agents.AgentRecord."""

    id: str
    name: str
    description: str
    mcp_url: str
    auth_mode: AuthMode = "oauth_dcr"
    scopes: tuple[str, ...] = ("read",)
    enabled: bool = True
    authorize_url: Optional[str] = None
    token_url: Optional[str] = None
    registration_url: Optional[str] = None
    revocation_url: Optional[str] = None
    client_id_env: Optional[str] = None
    client_secret_env: Optional[str] = None
    extra_authorize_params: dict[str, str] = field(default_factory=dict)
