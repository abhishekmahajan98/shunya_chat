"""Generic MCP OAuth 2.1 helpers: discovery, DCR, PKCE, token exchange/refresh."""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlencode, urljoin, urlparse

import httpx

from integrations.registry import RemoteMcpProvider

logger = logging.getLogger("uvicorn.error")


@dataclass
class AuthServerMeta:
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    registration_endpoint: Optional[str] = None
    revocation_endpoint: Optional[str] = None
    scopes_supported: list[str] | None = None


@dataclass
class TokenSet:
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    scope: Optional[str] = None
    token_type: str = "Bearer"
    raw: dict[str, Any] | None = None


def pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) using S256."""
    verifier = secrets.token_urlsafe(64)[:128]
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def new_state() -> str:
    return secrets.token_urlsafe(32)


def _origin(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


async def discover_auth_server(provider: RemoteMcpProvider) -> AuthServerMeta:
    """RFC 9728 protected-resource → RFC 8414 authorization-server metadata."""
    if provider.authorize_url and provider.token_url:
        return AuthServerMeta(
            issuer=_origin(provider.mcp_url),
            authorization_endpoint=provider.authorize_url,
            token_endpoint=provider.token_url,
            registration_endpoint=provider.registration_url,
            revocation_endpoint=provider.revocation_url,
        )

    mcp_url = provider.mcp_url.rstrip("/")
    origin = _origin(mcp_url)
    path = urlparse(mcp_url).path or ""
    candidates = [
        f"{origin}/.well-known/oauth-protected-resource",
        f"{origin}/.well-known/oauth-protected-resource{path}",
        f"{mcp_url}/.well-known/oauth-protected-resource",
    ]

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        prm: dict[str, Any] = {}
        for url in candidates:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    prm = resp.json()
                    break
            except Exception as exc:
                logger.debug("PRM fetch failed %s: %s", url, exc)

        auth_servers = prm.get("authorization_servers") or [origin]
        as_base = str(auth_servers[0]).rstrip("/")
        meta_urls = [
            f"{as_base}/.well-known/oauth-authorization-server",
            urljoin(as_base + "/", ".well-known/oauth-authorization-server"),
        ]
        meta: dict[str, Any] = {}
        for url in meta_urls:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    meta = resp.json()
                    break
            except Exception as exc:
                logger.debug("AS metadata fetch failed %s: %s", url, exc)
        if not meta:
            raise RuntimeError(f"Could not discover OAuth metadata for {provider.id}")

    return AuthServerMeta(
        issuer=meta.get("issuer") or as_base,
        authorization_endpoint=meta["authorization_endpoint"],
        token_endpoint=meta["token_endpoint"],
        registration_endpoint=meta.get("registration_endpoint") or provider.registration_url,
        revocation_endpoint=meta.get("revocation_endpoint") or provider.revocation_url,
        scopes_supported=meta.get("scopes_supported"),
    )


async def register_client(
    *,
    meta: AuthServerMeta,
    redirect_uri: str,
    client_name: str = "Shunya Chat",
) -> tuple[str, Optional[str]]:
    """RFC 7591 dynamic client registration. Returns (client_id, client_secret|None)."""
    if not meta.registration_endpoint:
        raise RuntimeError("Authorization server does not advertise registration_endpoint")

    body = {
        "client_name": client_name,
        "redirect_uris": [redirect_uri],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "none",
        "client_uri": "https://github.com/shunya-chat",
    }
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        resp = await client.post(meta.registration_endpoint, json=body)
        if resp.status_code >= 400:
            raise RuntimeError(f"DCR failed ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
    client_id = data.get("client_id")
    if not client_id:
        raise RuntimeError("DCR response missing client_id")
    return client_id, data.get("client_secret")


def build_authorize_url(
    *,
    meta: AuthServerMeta,
    client_id: str,
    redirect_uri: str,
    state: str,
    code_challenge: str,
    scopes: tuple[str, ...] | list[str],
    resource: str,
    extra: Optional[dict[str, str]] = None,
) -> str:
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "scope": " ".join(scopes),
        "resource": resource,
    }
    if extra:
        params.update(extra)
    return f"{meta.authorization_endpoint}?{urlencode(params)}"


async def exchange_code(
    *,
    meta: AuthServerMeta,
    client_id: str,
    code: str,
    redirect_uri: str,
    code_verifier: str,
    resource: str,
    client_secret: Optional[str] = None,
) -> TokenSet:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "code_verifier": code_verifier,
        "resource": resource,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    auth = None
    if client_secret:
        auth = (client_id, client_secret)

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        resp = await client.post(meta.token_endpoint, data=data, headers=headers, auth=auth)
        if resp.status_code >= 400:
            raise RuntimeError(f"Token exchange failed ({resp.status_code}): {resp.text[:500]}")
        payload = resp.json()

    access = payload.get("access_token")
    if not access:
        raise RuntimeError("Token response missing access_token")
    return TokenSet(
        access_token=access,
        refresh_token=payload.get("refresh_token"),
        expires_in=payload.get("expires_in"),
        scope=payload.get("scope"),
        token_type=payload.get("token_type") or "Bearer",
        raw=payload,
    )


async def refresh_tokens(
    *,
    meta: AuthServerMeta,
    client_id: str,
    refresh_token: str,
    resource: str,
    client_secret: Optional[str] = None,
    scopes: Optional[tuple[str, ...] | list[str]] = None,
) -> TokenSet:
    data: dict[str, str] = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "resource": resource,
    }
    if scopes:
        data["scope"] = " ".join(scopes)
    auth = (client_id, client_secret) if client_secret else None

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        resp = await client.post(
            meta.token_endpoint,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            auth=auth,
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"Token refresh failed ({resp.status_code}): {resp.text[:500]}")
        payload = resp.json()

    access = payload.get("access_token")
    if not access:
        raise RuntimeError("Refresh response missing access_token")
    return TokenSet(
        access_token=access,
        refresh_token=payload.get("refresh_token") or refresh_token,
        expires_in=payload.get("expires_in"),
        scope=payload.get("scope"),
        token_type=payload.get("token_type") or "Bearer",
        raw=payload,
    )


async def revoke_token(
    *,
    meta: AuthServerMeta,
    token: str,
    client_id: str,
    client_secret: Optional[str] = None,
) -> None:
    if not meta.revocation_endpoint:
        return
    data = {"token": token, "client_id": client_id}
    auth = (client_id, client_secret) if client_secret else None
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            await client.post(
                meta.revocation_endpoint,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                auth=auth,
            )
    except Exception as exc:
        logger.warning("Token revocation failed: %s", exc)
