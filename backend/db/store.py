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
    def ensure_default_assistants(self, user_id: str) -> list[dict]: ...


class MemoryStore(Store):
    def __init__(self) -> None:
        self.assistants: dict[str, dict] = {}
        self.threads: dict[str, dict] = {}
        self.messages: dict[str, list[dict]] = {}

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
