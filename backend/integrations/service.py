"""Connect / disconnect / credentials for agents that need user auth."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlencode

from config import settings
from db import get_store
from db.agents import (
    OAUTH_AUTH_TYPES,
    AgentRecord,
    env_keys_satisfied,
    get_agent,
    is_credential_connected,
    list_enabled_agents,
)
from integrations import crypto
from integrations.oauth import (
    AuthServerMeta,
    build_authorize_url,
    discover_auth_server,
    exchange_code,
    new_state,
    pkce_pair,
    refresh_tokens,
    register_client,
    revoke_token,
)

logger = logging.getLogger("uvicorn.error")

_STATE_TTL = timedelta(minutes=15)
_REFRESH_SKEW = timedelta(minutes=2)


def api_public_url() -> str:
    return (settings.API_PUBLIC_URL or "http://localhost:8000").rstrip("/")


def callback_uri(agent_id: str) -> str:
    return f"{api_public_url()}/api/integrations/{agent_id}/callback"


def frontend_redirect(agent_id: str, status: str, error: str | None = None) -> str:
    base = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    params = {"integration": agent_id, "status": status}
    if error:
        params["error"] = error[:200]
    return f"{base}/?{urlencode(params)}"


def _expires_at(expires_in: int | None) -> str | None:
    if not expires_in:
        return None
    return (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))).isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _meta_from_agent(agent: AgentRecord) -> AuthServerMeta:
    """Build AuthServerMeta preferring agent row overrides (skips network discovery)."""
    if agent.oauth_authorize_url and agent.oauth_token_url:
        from urllib.parse import urlparse

        origin = f"{urlparse(agent.mcp_url or '').scheme}://{urlparse(agent.mcp_url or '').netloc}"
        return AuthServerMeta(
            issuer=origin or (agent.mcp_url or agent.id),
            authorization_endpoint=agent.oauth_authorize_url,
            token_endpoint=agent.oauth_token_url,
            registration_endpoint=agent.oauth_registration_url,
            revocation_endpoint=agent.oauth_revocation_url,
        )
    # Fall through to discovery via a thin adapter
    raise ValueError("missing oauth urls")


async def _auth_meta(agent: AgentRecord) -> AuthServerMeta:
    try:
        return _meta_from_agent(agent)
    except ValueError:
        pass
    # Adapt AgentRecord to the shape discover_auth_server expects
    from integrations.registry import RemoteMcpProvider

    stub = RemoteMcpProvider(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        mcp_url=agent.mcp_url or "",
        auth_mode="oauth_dcr" if agent.auth == "oauth_dcr" else "oauth_static",
        scopes=agent.scopes,
        authorize_url=agent.oauth_authorize_url,
        token_url=agent.oauth_token_url,
        registration_url=agent.oauth_registration_url,
        revocation_url=agent.oauth_revocation_url,
    )
    return await discover_auth_server(stub)


async def _ensure_oauth_client(agent: AgentRecord, meta: AuthServerMeta) -> tuple[str, Optional[str]]:
    store = get_store()
    existing = store.get_oauth_client(agent.id)
    if existing:
        secret = crypto.decrypt_secret(existing.get("client_secret_enc"))
        return existing["client_id"], secret

    if agent.auth == "oauth_static":
        client_id = os.getenv(agent.client_id_env or "", "") if agent.client_id_env else ""
        client_secret = (
            os.getenv(agent.client_secret_env or "", "") if agent.client_secret_env else ""
        )
        if not client_id:
            raise RuntimeError(
                f"Agent {agent.id} requires {agent.client_id_env} in the environment"
            )
        store.upsert_oauth_client(
            {
                "agent_id": agent.id,
                "client_id": client_id,
                "client_secret_enc": crypto.encrypt_secret(client_secret) if client_secret else None,
                "metadata": {"auth_mode": "oauth_static"},
            }
        )
        return client_id, client_secret or None

    client_id, client_secret = await register_client(
        meta=meta,
        redirect_uri=callback_uri(agent.id),
        client_name="Shunya Chat",
    )
    store.upsert_oauth_client(
        {
            "agent_id": agent.id,
            "client_id": client_id,
            "client_secret_enc": crypto.encrypt_secret(client_secret) if client_secret else None,
            "metadata": {"auth_mode": "oauth_dcr", "issuer": meta.issuer},
        }
    )
    return client_id, client_secret


async def start_connect(user_id: str, agent_id: str) -> str:
    agent = get_agent(agent_id)
    if not agent or agent.auth not in OAUTH_AUTH_TYPES:
        raise ValueError(f"Agent does not support OAuth connect: {agent_id}")
    if not agent.mcp_url:
        raise ValueError(f"Agent {agent_id} missing mcp_url")

    meta = await _auth_meta(agent)
    client_id, _ = await _ensure_oauth_client(agent, meta)
    verifier, challenge = pkce_pair()
    state = new_state()
    expires = datetime.now(timezone.utc) + _STATE_TTL

    get_store().create_oauth_state(
        {
            "state": state,
            "user_id": user_id,
            "agent_id": agent_id,
            "code_verifier": verifier,
            "redirect_after": frontend_redirect(agent_id, "connected"),
            "expires_at": expires.isoformat(),
        }
    )

    return build_authorize_url(
        meta=meta,
        client_id=client_id,
        redirect_uri=callback_uri(agent_id),
        state=state,
        code_challenge=challenge,
        scopes=agent.scopes,
        resource=agent.mcp_url,
    )


async def finish_connect(agent_id: str, *, code: str, state: str) -> str:
    agent = get_agent(agent_id)
    if not agent:
        return frontend_redirect(agent_id, "error", "unknown_agent")

    store = get_store()
    row = store.consume_oauth_state(state)
    if not row or row.get("agent_id") != agent_id:
        return frontend_redirect(agent_id, "error", "invalid_state")

    expires_at = _parse_dt(row.get("expires_at"))
    if expires_at and expires_at < datetime.now(timezone.utc):
        return frontend_redirect(agent_id, "error", "state_expired")

    try:
        meta = await _auth_meta(agent)
        client_id, client_secret = await _ensure_oauth_client(agent, meta)
        tokens = await exchange_code(
            meta=meta,
            client_id=client_id,
            code=code,
            redirect_uri=callback_uri(agent_id),
            code_verifier=row["code_verifier"],
            resource=agent.mcp_url or "",
            client_secret=client_secret,
        )
        store.upsert_user_credential(
            {
                "user_id": row["user_id"],
                "agent_id": agent_id,
                "kind": "oauth",
                "status": "connected",
                "access_token_enc": crypto.encrypt_secret(tokens.access_token),
                "refresh_token_enc": crypto.encrypt_secret(tokens.refresh_token),
                "expires_at": _expires_at(tokens.expires_in),
                "scopes": tokens.scope or " ".join(agent.scopes),
                "token_type": tokens.token_type,
                "oauth_client_id": client_id,
                "metadata": {},
            }
        )
    except Exception as exc:
        logger.exception("OAuth callback failed for %s", agent_id)
        return frontend_redirect(agent_id, "error", str(exc))

    return row.get("redirect_after") or frontend_redirect(agent_id, "connected")


async def save_api_key(user_id: str, agent_id: str, api_key: str) -> None:
    agent = get_agent(agent_id)
    if not agent or agent.auth != "user_api_key":
        raise ValueError(f"Agent does not accept API keys: {agent_id}")
    key = (api_key or "").strip()
    if not key:
        raise ValueError("API key required")
    get_store().upsert_user_credential(
        {
            "user_id": user_id,
            "agent_id": agent_id,
            "kind": "api_key",
            "status": "connected",
            "access_token_enc": crypto.encrypt_secret(key),
            "refresh_token_enc": None,
            "expires_at": None,
            "scopes": None,
            "token_type": "Bearer",
            "oauth_client_id": None,
            "metadata": {},
        }
    )


async def disconnect(user_id: str, agent_id: str) -> bool:
    agent = get_agent(agent_id)
    store = get_store()
    row = store.get_user_credential(user_id, agent_id)
    if not row:
        return False

    if agent and agent.is_oauth:
        try:
            meta = await _auth_meta(agent)
            client_row = store.get_oauth_client(agent_id)
            client_id = (client_row or {}).get("client_id") or row.get("oauth_client_id")
            client_secret = (
                crypto.decrypt_secret(client_row.get("client_secret_enc"))
                if client_row
                else None
            )
            access = crypto.decrypt_secret(row.get("access_token_enc"))
            if client_id and access:
                await revoke_token(
                    meta=meta,
                    token=access,
                    client_id=client_id,
                    client_secret=client_secret,
                )
        except Exception as exc:
            logger.warning("Revoke on disconnect failed: %s", exc)

    from integrations.remote_tools import clear_remote_schema_cache

    clear_remote_schema_cache(agent_id)
    return store.delete_user_credential(user_id, agent_id)


def list_integration_status(user_id: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for agent in list_enabled_agents():
        if not agent.needs_user_credential:
            continue
        connected = is_credential_connected(user_id, agent.id)
        row = get_store().get_user_credential(user_id, agent.id)
        out.append(
            {
                "id": agent.id,
                "name": agent.name,
                "description": agent.description,
                "auth": agent.auth,
                "mcp_url": agent.mcp_url,
                "scopes": list(agent.scopes),
                "connected": connected,
                "status": (row or {}).get("status") or "disconnected",
                "scopes_granted": (row or {}).get("scopes"),
            }
        )
    return out


def is_connected(user_id: str, agent_id: str) -> bool:
    return is_credential_connected(user_id, agent_id)


async def get_access_token(user_id: str, agent_id: str) -> Optional[str]:
    agent = get_agent(agent_id)
    if not agent or not agent.needs_user_credential:
        return None

    store = get_store()
    row = store.get_user_credential(user_id, agent_id)
    if not row or row.get("status") != "connected":
        return None

    access = crypto.decrypt_secret(row.get("access_token_enc"))
    if row.get("kind") == "api_key" or agent.auth == "user_api_key":
        return access

    expires = _parse_dt(row.get("expires_at"))
    needs_refresh = expires is not None and expires <= datetime.now(timezone.utc) + _REFRESH_SKEW
    refresh = crypto.decrypt_secret(row.get("refresh_token_enc"))

    if needs_refresh and refresh:
        try:
            meta = await _auth_meta(agent)
            client_row = store.get_oauth_client(agent_id)
            client_id = (client_row or {}).get("client_id") or row.get("oauth_client_id")
            client_secret = (
                crypto.decrypt_secret(client_row.get("client_secret_enc"))
                if client_row
                else None
            )
            if not client_id:
                raise RuntimeError("Missing oauth client_id")
            tokens = await refresh_tokens(
                meta=meta,
                client_id=client_id,
                refresh_token=refresh,
                resource=agent.mcp_url or "",
                client_secret=client_secret,
                scopes=agent.scopes,
            )
            store.upsert_user_credential(
                {
                    "user_id": user_id,
                    "agent_id": agent_id,
                    "kind": "oauth",
                    "status": "connected",
                    "access_token_enc": crypto.encrypt_secret(tokens.access_token),
                    "refresh_token_enc": crypto.encrypt_secret(tokens.refresh_token),
                    "expires_at": _expires_at(tokens.expires_in),
                    "scopes": tokens.scope or row.get("scopes"),
                    "token_type": tokens.token_type,
                    "oauth_client_id": client_id,
                    "metadata": row.get("metadata") or {},
                }
            )
            return tokens.access_token
        except Exception as exc:
            logger.warning("Token refresh failed for %s/%s: %s", user_id, agent_id, exc)
            store.upsert_user_credential({**row, "status": "expired"})
            return None

    return access


def agent_ready_for_user(user_id: str, agent: AgentRecord) -> tuple[bool, str | None]:
    """Return (ready, reason_if_not)."""
    if agent.auth == "none":
        return True, None
    if agent.auth == "env_api_key":
        if env_keys_satisfied(agent):
            return True, None
        return False, "missing_env"
    if agent.needs_user_credential:
        if is_credential_connected(user_id, agent.id):
            return True, None
        return False, "not_connected"
    return True, None
