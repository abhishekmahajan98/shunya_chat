"""Persistence for assistants / threads / messages.

Uses Supabase when SUPABASE_URL + SUPABASE_KEY are set; otherwise an
in-process memory store so the harness runs without cloud resources.
"""

from __future__ import annotations

import threading
import uuid
from abc import ABC, abstractmethod
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Optional

from config import settings

_LOCK = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


class Store(ABC):
    @abstractmethod
    def list_assistants(self, user_id: str) -> list[dict]: ...

    @abstractmethod
    def get_assistant(self, assistant_id: str, user_id: str) -> Optional[dict]: ...

    @abstractmethod
    def create_assistant(self, data: dict) -> dict: ...

    @abstractmethod
    def update_assistant(self, assistant_id: str, user_id: str, patch: dict) -> Optional[dict]: ...

    @abstractmethod
    def delete_assistant(self, assistant_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def list_threads(
        self, user_id: str, assistant_id: Optional[str] = None, limit: int = 50, offset: int = 0
    ) -> list[dict]: ...

    @abstractmethod
    def get_thread(self, thread_id: str, user_id: str) -> Optional[dict]: ...

    @abstractmethod
    def create_thread(self, data: dict) -> dict: ...

    @abstractmethod
    def update_thread(self, thread_id: str, user_id: str, patch: dict) -> Optional[dict]: ...

    @abstractmethod
    def delete_thread(self, thread_id: str, user_id: str) -> bool: ...

    @abstractmethod
    def list_messages(self, thread_id: str) -> list[dict]: ...

    @abstractmethod
    def append_message(self, data: dict) -> dict: ...

    @abstractmethod
    def list_compactions(self, thread_id: str) -> list[dict]: ...

    @abstractmethod
    def get_latest_compaction(self, thread_id: str) -> Optional[dict]: ...

    @abstractmethod
    def create_compaction(self, data: dict) -> dict: ...

    @abstractmethod
    def list_agents(self, *, enabled_only: bool = True) -> list[dict]: ...

    @abstractmethod
    def get_agent(self, agent_id: str) -> Optional[dict]: ...

    @abstractmethod
    def upsert_agent(self, data: dict) -> dict: ...

    @abstractmethod
    def ensure_agents_seeded(self, rows: list[dict]) -> list[dict]: ...

    @abstractmethod
    def get_user_credential(self, user_id: str, agent_id: str) -> Optional[dict]: ...

    @abstractmethod
    def list_user_credentials(self, user_id: str) -> list[dict]: ...

    @abstractmethod
    def upsert_user_credential(self, data: dict) -> dict: ...

    @abstractmethod
    def delete_user_credential(self, user_id: str, agent_id: str) -> bool: ...

    @abstractmethod
    def get_oauth_client(self, agent_id: str) -> Optional[dict]: ...

    @abstractmethod
    def upsert_oauth_client(self, data: dict) -> dict: ...

    @abstractmethod
    def create_oauth_state(self, data: dict) -> dict: ...

    @abstractmethod
    def consume_oauth_state(self, state: str) -> Optional[dict]: ...

    @abstractmethod
    def ensure_default_assistants(self, user_id: str) -> list[dict]: ...


class MemoryStore(Store):
    def __init__(self) -> None:
        self.assistants: dict[str, dict] = {}
        self.threads: dict[str, dict] = {}
        self.messages: dict[str, list[dict]] = {}
        self.compactions: dict[str, list[dict]] = {}
        self.agents: dict[str, dict] = {}
        self.user_credentials: dict[tuple[str, str], dict] = {}
        self.oauth_clients: dict[str, dict] = {}
        self.oauth_states: dict[str, dict] = {}

    def list_assistants(self, user_id: str) -> list[dict]:
        items = [a for a in self.assistants.values() if a["user_id"] == user_id]
        items.sort(key=lambda a: a["created_at"])
        return deepcopy(items)

    def get_assistant(self, assistant_id: str, user_id: str) -> Optional[dict]:
        a = self.assistants.get(assistant_id)
        if a and a["user_id"] == user_id:
            return deepcopy(a)
        return None

    def create_assistant(self, data: dict) -> dict:
        row = {
            "id": data.get("id") or _new_id(),
            "user_id": data["user_id"],
            "name": data["name"],
            "description": data.get("description"),
            "graph_id": data["graph_id"],
            "system_prompt": data.get("system_prompt"),
            "config": data.get("config") or {},
            "metadata": data.get("metadata") or {},
            "created_at": _now(),
            "updated_at": _now(),
        }
        self.assistants[row["id"]] = row
        return deepcopy(row)

    def update_assistant(self, assistant_id: str, user_id: str, patch: dict) -> Optional[dict]:
        a = self.assistants.get(assistant_id)
        if not a or a["user_id"] != user_id:
            return None
        for key in ("name", "description", "graph_id", "system_prompt", "config", "metadata"):
            if key in patch and patch[key] is not None:
                a[key] = patch[key]
        a["updated_at"] = _now()
        return deepcopy(a)

    def delete_assistant(self, assistant_id: str, user_id: str) -> bool:
        a = self.assistants.get(assistant_id)
        if not a or a["user_id"] != user_id:
            return False
        # cascade threads
        for tid, t in list(self.threads.items()):
            if t["assistant_id"] == assistant_id:
                self.threads.pop(tid, None)
                self.messages.pop(tid, None)
                self.compactions.pop(tid, None)
        del self.assistants[assistant_id]
        return True

    def list_threads(
        self, user_id: str, assistant_id: Optional[str] = None, limit: int = 50, offset: int = 0
    ) -> list[dict]:
        items = [t for t in self.threads.values() if t["user_id"] == user_id]
        if assistant_id:
            items = [t for t in items if t["assistant_id"] == assistant_id]
        items.sort(key=lambda t: t["updated_at"], reverse=True)
        return deepcopy(items[offset : offset + limit])

    def get_thread(self, thread_id: str, user_id: str) -> Optional[dict]:
        t = self.threads.get(thread_id)
        if t and t["user_id"] == user_id:
            return deepcopy(t)
        return None

    def create_thread(self, data: dict) -> dict:
        row = {
            "id": data.get("id") or _new_id(),
            "user_id": data["user_id"],
            "assistant_id": data["assistant_id"],
            "title": data.get("title") or "New Chat",
            "metadata": data.get("metadata") or {},
            "created_at": _now(),
            "updated_at": _now(),
        }
        self.threads[row["id"]] = row
        self.messages[row["id"]] = []
        self.compactions[row["id"]] = []
        return deepcopy(row)

    def update_thread(self, thread_id: str, user_id: str, patch: dict) -> Optional[dict]:
        t = self.threads.get(thread_id)
        if not t or t["user_id"] != user_id:
            return None
        for key in ("title", "metadata", "assistant_id"):
            if key in patch and patch[key] is not None:
                t[key] = patch[key]
        t["updated_at"] = _now()
        return deepcopy(t)

    def delete_thread(self, thread_id: str, user_id: str) -> bool:
        t = self.threads.get(thread_id)
        if not t or t["user_id"] != user_id:
            return False
        del self.threads[thread_id]
        self.messages.pop(thread_id, None)
        self.compactions.pop(thread_id, None)
        return True

    def list_messages(self, thread_id: str) -> list[dict]:
        return deepcopy(self.messages.get(thread_id, []))

    def append_message(self, data: dict) -> dict:
        row = {
            "id": data.get("id") or _new_id(),
            "thread_id": data["thread_id"],
            "role": data["role"],
            "content": data.get("content") or "",
            "tool_calls": data.get("tool_calls"),
            "tool_call_id": data.get("tool_call_id"),
            "additional_kwargs": data.get("additional_kwargs") or {},
            "created_at": data.get("created_at") or _now(),
        }
        self.messages.setdefault(data["thread_id"], []).append(row)
        if data["thread_id"] in self.threads:
            self.threads[data["thread_id"]]["updated_at"] = _now()
        return deepcopy(row)

    def list_compactions(self, thread_id: str) -> list[dict]:
        items = list(self.compactions.get(thread_id, []))
        items.sort(key=lambda c: c.get("created_at") or "")
        return deepcopy(items)

    def get_latest_compaction(self, thread_id: str) -> Optional[dict]:
        items = self.list_compactions(thread_id)
        return items[-1] if items else None

    def create_compaction(self, data: dict) -> dict:
        row = {
            "id": data.get("id") or _new_id(),
            "thread_id": data["thread_id"],
            "summary": data.get("summary") or "",
            "first_kept_message_id": data.get("first_kept_message_id"),
            "file_path": data.get("file_path"),
            "created_at": data.get("created_at") or _now(),
        }
        self.compactions.setdefault(data["thread_id"], []).append(row)
        return deepcopy(row)

    def get_user_credential(self, user_id: str, agent_id: str) -> Optional[dict]:
        row = self.user_credentials.get((user_id, agent_id))
        return deepcopy(row) if row else None

    def list_user_credentials(self, user_id: str) -> list[dict]:
        items = [v for (uid, _), v in self.user_credentials.items() if uid == user_id]
        items.sort(key=lambda r: r.get("agent_id") or "")
        return deepcopy(items)

    def upsert_user_credential(self, data: dict) -> dict:
        key = (data["user_id"], data["agent_id"])
        prev = self.user_credentials.get(key) or {}
        row = {
            "user_id": data["user_id"],
            "agent_id": data["agent_id"],
            "kind": data.get("kind") or prev.get("kind") or "oauth",
            "status": data.get("status") or prev.get("status") or "connected",
            "access_token_enc": data.get("access_token_enc")
            if "access_token_enc" in data
            else prev.get("access_token_enc"),
            "refresh_token_enc": data.get("refresh_token_enc")
            if "refresh_token_enc" in data
            else prev.get("refresh_token_enc"),
            "expires_at": data.get("expires_at") if "expires_at" in data else prev.get("expires_at"),
            "scopes": data.get("scopes") if "scopes" in data else prev.get("scopes"),
            "token_type": data.get("token_type") or prev.get("token_type") or "Bearer",
            "oauth_client_id": data.get("oauth_client_id")
            if "oauth_client_id" in data
            else prev.get("oauth_client_id"),
            "metadata": data.get("metadata") if "metadata" in data else (prev.get("metadata") or {}),
            "created_at": prev.get("created_at") or _now(),
            "updated_at": _now(),
        }
        self.user_credentials[key] = row
        return deepcopy(row)

    def delete_user_credential(self, user_id: str, agent_id: str) -> bool:
        return self.user_credentials.pop((user_id, agent_id), None) is not None

    def list_agents(self, *, enabled_only: bool = True) -> list[dict]:
        items = list(self.agents.values())
        if enabled_only:
            items = [a for a in items if a.get("enabled", True)]
        items.sort(key=lambda a: (a.get("sort_order") or 0, a.get("id") or ""))
        return deepcopy(items)

    def get_agent(self, agent_id: str) -> Optional[dict]:
        row = self.agents.get(agent_id)
        return deepcopy(row) if row else None

    def upsert_agent(self, data: dict) -> dict:
        prev = self.agents.get(data["id"]) or {}
        row = {
            "id": data["id"],
            "name": data.get("name") if "name" in data else prev.get("name") or data["id"],
            "description": data.get("description")
            if "description" in data
            else (prev.get("description") or ""),
            "enabled": data.get("enabled") if "enabled" in data else prev.get("enabled", True),
            "sort_order": data.get("sort_order")
            if "sort_order" in data
            else (prev.get("sort_order") or 0),
            "auth": data.get("auth") if "auth" in data else (prev.get("auth") or "none"),
            "mcp_url": data.get("mcp_url") if "mcp_url" in data else prev.get("mcp_url"),
            "local_module": data.get("local_module")
            if "local_module" in data
            else prev.get("local_module"),
            "skill_id": data.get("skill_id") if "skill_id" in data else prev.get("skill_id"),
            "scopes": data.get("scopes") if "scopes" in data else (prev.get("scopes") or []),
            "env_keys": data.get("env_keys") if "env_keys" in data else (prev.get("env_keys") or []),
            "oauth_authorize_url": data.get("oauth_authorize_url")
            if "oauth_authorize_url" in data
            else prev.get("oauth_authorize_url"),
            "oauth_token_url": data.get("oauth_token_url")
            if "oauth_token_url" in data
            else prev.get("oauth_token_url"),
            "oauth_registration_url": data.get("oauth_registration_url")
            if "oauth_registration_url" in data
            else prev.get("oauth_registration_url"),
            "oauth_revocation_url": data.get("oauth_revocation_url")
            if "oauth_revocation_url" in data
            else prev.get("oauth_revocation_url"),
            "client_id_env": data.get("client_id_env")
            if "client_id_env" in data
            else prev.get("client_id_env"),
            "client_secret_env": data.get("client_secret_env")
            if "client_secret_env" in data
            else prev.get("client_secret_env"),
            "metadata": data.get("metadata") if "metadata" in data else (prev.get("metadata") or {}),
            "created_at": prev.get("created_at") or _now(),
            "updated_at": _now(),
        }
        self.agents[row["id"]] = row
        return deepcopy(row)

    def ensure_agents_seeded(self, rows: list[dict]) -> list[dict]:
        if self.agents:
            return self.list_agents(enabled_only=False)
        for row in rows:
            self.upsert_agent(row)
        return self.list_agents(enabled_only=False)

    def get_oauth_client(self, agent_id: str) -> Optional[dict]:
        row = self.oauth_clients.get(agent_id)
        return deepcopy(row) if row else None

    def upsert_oauth_client(self, data: dict) -> dict:
        agent_id = data.get("agent_id") or data.get("provider")
        prev = self.oauth_clients.get(agent_id) or {}
        row = {
            "agent_id": agent_id,
            "client_id": data["client_id"],
            "client_secret_enc": data.get("client_secret_enc")
            if "client_secret_enc" in data
            else prev.get("client_secret_enc"),
            "metadata": data.get("metadata") if "metadata" in data else (prev.get("metadata") or {}),
            "created_at": prev.get("created_at") or _now(),
            "updated_at": _now(),
        }
        self.oauth_clients[agent_id] = row
        return deepcopy(row)

    def create_oauth_state(self, data: dict) -> dict:
        agent_id = data.get("agent_id") or data.get("provider")
        row = {
            "state": data["state"],
            "user_id": data["user_id"],
            "agent_id": agent_id,
            "code_verifier": data["code_verifier"],
            "redirect_after": data.get("redirect_after"),
            "created_at": _now(),
            "expires_at": data["expires_at"],
        }
        self.oauth_states[data["state"]] = row
        return deepcopy(row)

    def consume_oauth_state(self, state: str) -> Optional[dict]:
        row = self.oauth_states.pop(state, None)
        return deepcopy(row) if row else None

    def ensure_default_assistants(self, user_id: str) -> list[dict]:
        existing = self.list_assistants(user_id)
        if existing:
            return existing
        defaults = [
            {
                "user_id": user_id,
                "name": "Basic Agent",
                "description": "LangChain ReAct agent with calculator tools",
                "graph_id": "basic_agent",
                "system_prompt": "You are a helpful AI assistant.",
                "metadata": {"seed": True},
            },
            {
                "user_id": user_id,
                "name": "Deep Agent",
                "description": "DeepAgents harness with planning, filesystem, and subagents",
                "graph_id": "deep_agent",
                "system_prompt": "You are a helpful AI assistant.",
                "metadata": {"seed": True},
            },
        ]
        return [self.create_assistant(d) for d in defaults]


class SupabaseStore(Store):
    def __init__(self, url: str, key: str) -> None:
        from supabase import create_client

        self.client = create_client(url, key)

    def list_assistants(self, user_id: str) -> list[dict]:
        res = (
            self.client.table("assistants")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        return res.data or []

    def get_assistant(self, assistant_id: str, user_id: str) -> Optional[dict]:
        res = (
            self.client.table("assistants")
            .select("*")
            .eq("id", assistant_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def create_assistant(self, data: dict) -> dict:
        row = {
            "id": data.get("id") or _new_id(),
            "user_id": data["user_id"],
            "name": data["name"],
            "description": data.get("description"),
            "graph_id": data["graph_id"],
            "system_prompt": data.get("system_prompt"),
            "config": data.get("config") or {},
            "metadata": data.get("metadata") or {},
        }
        res = self.client.table("assistants").insert(row).execute()
        return res.data[0]

    def update_assistant(self, assistant_id: str, user_id: str, patch: dict) -> Optional[dict]:
        payload = {k: v for k, v in patch.items() if v is not None and k in {
            "name", "description", "graph_id", "system_prompt", "config", "metadata"
        }}
        payload["updated_at"] = _now()
        res = (
            self.client.table("assistants")
            .update(payload)
            .eq("id", assistant_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def delete_assistant(self, assistant_id: str, user_id: str) -> bool:
        res = (
            self.client.table("assistants")
            .delete()
            .eq("id", assistant_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res.data)

    def list_threads(
        self, user_id: str, assistant_id: Optional[str] = None, limit: int = 50, offset: int = 0
    ) -> list[dict]:
        q = (
            self.client.table("threads")
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if assistant_id:
            q = q.eq("assistant_id", assistant_id)
        res = q.execute()
        return res.data or []

    def get_thread(self, thread_id: str, user_id: str) -> Optional[dict]:
        res = (
            self.client.table("threads")
            .select("*")
            .eq("id", thread_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def create_thread(self, data: dict) -> dict:
        row = {
            "id": data.get("id") or _new_id(),
            "user_id": data["user_id"],
            "assistant_id": data["assistant_id"],
            "title": data.get("title") or "New Chat",
            "metadata": data.get("metadata") or {},
        }
        res = self.client.table("threads").insert(row).execute()
        return res.data[0]

    def update_thread(self, thread_id: str, user_id: str, patch: dict) -> Optional[dict]:
        payload = {k: v for k, v in patch.items() if v is not None and k in {"title", "metadata", "assistant_id"}}
        payload["updated_at"] = _now()
        res = (
            self.client.table("threads")
            .update(payload)
            .eq("id", thread_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def delete_thread(self, thread_id: str, user_id: str) -> bool:
        res = (
            self.client.table("threads")
            .delete()
            .eq("id", thread_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res.data)

    def list_messages(self, thread_id: str) -> list[dict]:
        res = (
            self.client.table("messages")
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at")
            .execute()
        )
        return res.data or []

    def append_message(self, data: dict) -> dict:
        row = {
            "id": data.get("id") or _new_id(),
            "thread_id": data["thread_id"],
            "role": data["role"],
            "content": data.get("content") or "",
            "tool_calls": data.get("tool_calls"),
            "tool_call_id": data.get("tool_call_id"),
            "additional_kwargs": data.get("additional_kwargs") or {},
        }
        res = self.client.table("messages").insert(row).execute()
        self.client.table("threads").update({"updated_at": _now()}).eq("id", data["thread_id"]).execute()
        return res.data[0]

    def list_compactions(self, thread_id: str) -> list[dict]:
        res = (
            self.client.table("compactions")
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at")
            .execute()
        )
        return res.data or []

    def get_latest_compaction(self, thread_id: str) -> Optional[dict]:
        res = (
            self.client.table("compactions")
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def create_compaction(self, data: dict) -> dict:
        row = {
            "id": data.get("id") or _new_id(),
            "thread_id": data["thread_id"],
            "summary": data.get("summary") or "",
            "first_kept_message_id": data.get("first_kept_message_id"),
            "file_path": data.get("file_path"),
        }
        res = self.client.table("compactions").insert(row).execute()
        return res.data[0]

    def list_agents(self, *, enabled_only: bool = True) -> list[dict]:
        q = self.client.table("agents").select("*").order("sort_order").order("id")
        if enabled_only:
            q = q.eq("enabled", True)
        res = q.execute()
        return res.data or []

    def get_agent(self, agent_id: str) -> Optional[dict]:
        res = (
            self.client.table("agents")
            .select("*")
            .eq("id", agent_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def upsert_agent(self, data: dict) -> dict:
        row = {
            "id": data["id"],
            "name": data.get("name") or data["id"],
            "description": data.get("description") or "",
            "enabled": data.get("enabled", True),
            "sort_order": data.get("sort_order") or 0,
            "auth": data.get("auth") or "none",
            "mcp_url": data.get("mcp_url"),
            "local_module": data.get("local_module"),
            "skill_id": data.get("skill_id"),
            "scopes": data.get("scopes") or [],
            "env_keys": data.get("env_keys") or [],
            "oauth_authorize_url": data.get("oauth_authorize_url"),
            "oauth_token_url": data.get("oauth_token_url"),
            "oauth_registration_url": data.get("oauth_registration_url"),
            "oauth_revocation_url": data.get("oauth_revocation_url"),
            "client_id_env": data.get("client_id_env"),
            "client_secret_env": data.get("client_secret_env"),
            "metadata": data.get("metadata") or {},
            "updated_at": _now(),
        }
        res = self.client.table("agents").upsert(row, on_conflict="id").execute()
        return res.data[0]

    def ensure_agents_seeded(self, rows: list[dict]) -> list[dict]:
        existing = self.list_agents(enabled_only=False)
        if existing:
            return existing
        for row in rows:
            self.upsert_agent(row)
        return self.list_agents(enabled_only=False)

    def get_user_credential(self, user_id: str, agent_id: str) -> Optional[dict]:
        res = (
            self.client.table("user_credentials")
            .select("*")
            .eq("user_id", user_id)
            .eq("agent_id", agent_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def list_user_credentials(self, user_id: str) -> list[dict]:
        res = (
            self.client.table("user_credentials")
            .select("*")
            .eq("user_id", user_id)
            .order("agent_id")
            .execute()
        )
        return res.data or []

    def upsert_user_credential(self, data: dict) -> dict:
        row = {
            "user_id": data["user_id"],
            "agent_id": data["agent_id"],
            "kind": data.get("kind") or "oauth",
            "status": data.get("status") or "connected",
            "access_token_enc": data.get("access_token_enc") or "",
            "refresh_token_enc": data.get("refresh_token_enc"),
            "expires_at": data.get("expires_at"),
            "scopes": data.get("scopes"),
            "token_type": data.get("token_type") or "Bearer",
            "oauth_client_id": data.get("oauth_client_id"),
            "metadata": data.get("metadata") or {},
            "updated_at": _now(),
        }
        if not data.get("access_token_enc"):
            existing = self.get_user_credential(data["user_id"], data["agent_id"])
            if existing:
                row["access_token_enc"] = existing.get("access_token_enc") or ""
                if "refresh_token_enc" not in data:
                    row["refresh_token_enc"] = existing.get("refresh_token_enc")
                if "expires_at" not in data:
                    row["expires_at"] = existing.get("expires_at")
                if "scopes" not in data:
                    row["scopes"] = existing.get("scopes")
                if "oauth_client_id" not in data:
                    row["oauth_client_id"] = existing.get("oauth_client_id")
                if "kind" not in data:
                    row["kind"] = existing.get("kind") or "oauth"
                if "metadata" not in data:
                    row["metadata"] = existing.get("metadata") or {}
        res = (
            self.client.table("user_credentials")
            .upsert(row, on_conflict="user_id,agent_id")
            .execute()
        )
        return res.data[0]

    def delete_user_credential(self, user_id: str, agent_id: str) -> bool:
        res = (
            self.client.table("user_credentials")
            .delete()
            .eq("user_id", user_id)
            .eq("agent_id", agent_id)
            .execute()
        )
        return bool(res.data)

    def get_oauth_client(self, agent_id: str) -> Optional[dict]:
        res = (
            self.client.table("oauth_clients")
            .select("*")
            .eq("agent_id", agent_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def upsert_oauth_client(self, data: dict) -> dict:
        agent_id = data.get("agent_id") or data.get("provider")
        row = {
            "agent_id": agent_id,
            "client_id": data["client_id"],
            "client_secret_enc": data.get("client_secret_enc"),
            "metadata": data.get("metadata") or {},
            "updated_at": _now(),
        }
        res = (
            self.client.table("oauth_clients")
            .upsert(row, on_conflict="agent_id")
            .execute()
        )
        return res.data[0]

    def create_oauth_state(self, data: dict) -> dict:
        agent_id = data.get("agent_id") or data.get("provider")
        row = {
            "state": data["state"],
            "user_id": data["user_id"],
            "agent_id": agent_id,
            "code_verifier": data["code_verifier"],
            "redirect_after": data.get("redirect_after"),
            "expires_at": data["expires_at"],
        }
        res = self.client.table("oauth_states").insert(row).execute()
        return res.data[0]

    def consume_oauth_state(self, state: str) -> Optional[dict]:
        res = (
            self.client.table("oauth_states")
            .select("*")
            .eq("state", state)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        row = res.data[0]
        self.client.table("oauth_states").delete().eq("state", state).execute()
        return row

    def ensure_default_assistants(self, user_id: str) -> list[dict]:
        existing = self.list_assistants(user_id)
        if existing:
            return existing
        defaults = [
            {
                "user_id": user_id,
                "name": "Basic Agent",
                "description": "LangChain ReAct agent with calculator tools",
                "graph_id": "basic_agent",
                "system_prompt": "You are a helpful AI assistant.",
                "metadata": {"seed": True},
            },
            {
                "user_id": user_id,
                "name": "Deep Agent",
                "description": "DeepAgents harness with planning, filesystem, and subagents",
                "graph_id": "deep_agent",
                "system_prompt": "You are a helpful AI assistant.",
                "metadata": {"seed": True},
            },
        ]
        return [self.create_assistant(d) for d in defaults]


_STORE: Optional[Store] = None


def get_store() -> Store:
    global _STORE
    with _LOCK:
        if _STORE is None:
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                _STORE = SupabaseStore(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            else:
                _STORE = MemoryStore()
        return _STORE
