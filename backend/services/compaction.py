"""Between-turn conversation compaction for agent context + UI chips.

UI history stays complete in `messages`. Durable agent context on cold start is:
  [summary HumanMessage] + DB messages from `first_kept_message_id` onward.

App-owned compaction runs *after* a turn finishes (not mid-ReAct). Middleware
summarization may still run silently as an overflow safety net — it must not
drive UI chips.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.messages.utils import count_tokens_approximately

from config import settings

logger = logging.getLogger("uvicorn.error")

COMPACTION_NOTICE = (
    "Context compacted — earlier turns were summarized for the model. "
    "Full chat still available above."
)

# Between-turn compaction on durable user/assistant context (tool rows ignored).
# Fires when *either* token or message threshold is hit; keep window is token-first.
COMPACTION_TRIGGER_TOKENS = 80_000
COMPACTION_KEEP_TOKENS = 20_000
COMPACTION_TRIGGER_MESSAGES = 40
COMPACTION_KEEP_MESSAGES = 12

_SUMMARY_PROMPT = """You summarize a chat for continuing the conversation later.
Respond ONLY with the summary body using these sections (use "None" if empty):

## SESSION INTENT
## SUMMARY
## ARTIFACTS
## NEXT STEPS

Conversation:
{messages}
"""


def _content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text") or "")
            elif hasattr(block, "text"):
                parts.append(getattr(block, "text") or "")
        return "".join(parts)
    return str(content)


def _normalize_summary_for_storage(raw: str) -> str:
    """Keep the human-readable summary body; drop agent-facing wrappers."""
    text = (raw or "").strip()
    if not text:
        return ""

    lower = text.lower()
    start = lower.find("<summary>")
    end = lower.find("</summary>")
    if start >= 0 and end > start:
        inner = text[start + len("<summary>") : end].strip()
        if inner:
            return inner

    prefix = "Here is a summary of the conversation to date:"
    if text.startswith(prefix):
        return text[len(prefix) :].strip()

    marker = "A condensed summary follows:"
    idx = text.find(marker)
    if idx >= 0:
        return text[idx + len(marker) :].strip().strip("`").strip()

    return text


def turn_messages(rows: list[dict]) -> list[dict]:
    """User/assistant rows only — durable chat turns, not tool/system noise."""
    return [r for r in rows if r.get("role") in ("user", "assistant")]


def messages_after_compaction(
    history_rows: list[dict],
    compaction: Optional[dict],
) -> list[dict]:
    """DB rows that belong in agent context after the latest compaction."""
    if not compaction:
        return list(history_rows)

    first_kept = compaction.get("first_kept_message_id")
    if first_kept:
        for i, row in enumerate(history_rows):
            if str(row.get("id")) == str(first_kept):
                return history_rows[i:]
        logger.warning(
            "compaction first_kept_message_id %s not in thread history; using created_at",
            first_kept,
        )

    cutoff_at = compaction.get("created_at")
    if cutoff_at:
        return [r for r in history_rows if (r.get("created_at") or "") > cutoff_at]
    return list(history_rows)


def build_agent_messages(
    history_rows: list[dict],
    compaction: Optional[dict],
    *,
    db_to_lc,
) -> list:
    """Build LangChain messages for a cold (or reconstructed) agent turn."""
    if not compaction:
        return db_to_lc(history_rows)

    tail = messages_after_compaction(history_rows, compaction)
    summary = (compaction.get("summary") or "").strip()
    out: list = []
    if summary:
        out.append(
            HumanMessage(
                content=summary,
                additional_kwargs={"lc_source": "summarization"},
            )
        )
    out.extend(db_to_lc(tail))
    return out


def insert_compaction_markers(
    visible_messages: list[dict],
    compactions: list[dict],
) -> list[dict]:
    """Inject system compaction rows into a UI transcript at the right places."""
    if not compactions:
        return visible_messages

    by_kept: dict[str, list[dict]] = {}
    orphan: list[dict] = []
    for c in compactions:
        kept = c.get("first_kept_message_id")
        marker = {
            "id": c["id"],
            "role": "system",
            "content": COMPACTION_NOTICE,
            "created_at": c.get("created_at"),
            "additional_kwargs": {
                "kind": "compaction",
                "summary": c.get("summary") or "",
                "file_path": c.get("file_path"),
            },
        }
        if kept:
            by_kept.setdefault(str(kept), []).append(marker)
        else:
            orphan.append(marker)

    out: list[dict] = []
    for msg in visible_messages:
        mid = str(msg.get("id") or "")
        for marker in by_kept.pop(mid, []):
            out.append(marker)
        out.append(msg)
    leftovers = orphan + [m for ms in by_kept.values() for m in ms]
    leftovers.sort(key=lambda m: m.get("created_at") or "")
    out.extend(leftovers)
    return out


def _format_rows_for_prompt(rows: list[dict]) -> str:
    lines: list[str] = []
    for row in rows:
        role = (row.get("role") or "unknown").upper()
        content = (row.get("content") or "").strip()
        if not content:
            continue
        if len(content) > 2000:
            content = content[:2000] + "…"
        lines.append(f"{role}: {content}")
    return "\n\n".join(lines) if lines else "(empty)"


def _merge_prior_summary(prior: Optional[dict], older_turns: list[dict]) -> str:
    """Build prompt text: prior summary (if any) + turns being folded away."""
    parts: list[str] = []
    if prior and (prior.get("summary") or "").strip():
        parts.append("PRIOR SUMMARY:\n" + prior["summary"].strip())
    parts.append("NEW MESSAGES TO FOLD IN:\n" + _format_rows_for_prompt(older_turns))
    return "\n\n".join(parts)


async def _ainvoke_summary(prompt_body: str) -> str:
    model_id = settings.MODEL or "google_genai:gemini-3.8-flash"
    llm = init_chat_model(model_id)
    response = await llm.ainvoke(_SUMMARY_PROMPT.format(messages=prompt_body))
    return _normalize_summary_for_storage(
        _content_to_text(getattr(response, "content", response))
    )


def _rows_to_lc(rows: list[dict]) -> list:
    out: list = []
    for row in rows:
        role = row.get("role")
        content = row.get("content") or ""
        if role == "user":
            out.append(HumanMessage(content=content))
        elif role == "assistant":
            out.append(AIMessage(content=content))
    return out


def _estimate_tokens(rows: list[dict], *, prior_summary: str = "") -> int:
    msgs = _rows_to_lc(rows)
    if prior_summary.strip():
        msgs = [HumanMessage(content=prior_summary.strip()), *msgs]
    if not msgs:
        return 0
    return int(count_tokens_approximately(msgs))


def _split_keep_by_tokens(
    turns: list[dict],
    *,
    keep_tokens: int,
    keep_messages: int,
) -> tuple[list[dict], list[dict]]:
    """Partition turns into (older, kept) using a token budget from the end."""
    if not turns:
        return [], []

    floor = max(1, min(keep_messages, len(turns)))
    # Always keep at least `floor` messages; grow keep window until token budget.
    kept: list[dict] = list(turns[-floor:])
    older: list[dict] = list(turns[:-floor]) if len(turns) > floor else []

    while older and _estimate_tokens(kept) < keep_tokens:
        kept.insert(0, older.pop())

    # If still nothing to fold, cannot compact
    return older, kept


def plan_compaction(
    store: Any,
    thread_id: str,
    *,
    trigger_tokens: int = COMPACTION_TRIGGER_TOKENS,
    keep_tokens: int = COMPACTION_KEEP_TOKENS,
    trigger_messages: int = COMPACTION_TRIGGER_MESSAGES,
    keep_messages: int = COMPACTION_KEEP_MESSAGES,
) -> Optional[dict]:
    """Return fold/keep split if compaction should run, else None."""
    if trigger_tokens <= keep_tokens:
        raise ValueError("trigger_tokens must be greater than keep_tokens")
    if trigger_messages <= keep_messages:
        raise ValueError("trigger_messages must be greater than keep_messages")

    latest = store.get_latest_compaction(thread_id)
    prior_summary = (latest or {}).get("summary") or ""
    all_rows = store.list_messages(thread_id)
    effective = messages_after_compaction(all_rows, latest)
    turns = turn_messages(effective)

    total_tokens = _estimate_tokens(turns, prior_summary=prior_summary)
    over_tokens = total_tokens >= trigger_tokens
    over_messages = len(turns) >= trigger_messages
    if not over_tokens and not over_messages:
        return None

    older, kept = _split_keep_by_tokens(
        turns,
        keep_tokens=keep_tokens,
        keep_messages=keep_messages,
    )
    if not older or not kept:
        return None

    return {
        "latest": latest,
        "older": older,
        "kept": kept,
        "first_kept_id": kept[0].get("id"),
        "total_tokens": total_tokens,
    }


def should_compact_thread(
    store: Any,
    thread_id: str,
    **kwargs: Any,
) -> bool:
    return plan_compaction(store, thread_id, **kwargs) is not None


async def maybe_compact_thread(
    store: Any,
    thread_id: str,
    **kwargs: Any,
) -> Optional[dict]:
    """If durable turn history is large, summarize older turns and persist a row.

    Triggers on token *or* message thresholds (user/assistant only, after the
    latest compaction). Returns the new compaction row, or None if skipped.
    """
    plan = plan_compaction(store, thread_id, **kwargs)
    if not plan:
        return None

    older = plan["older"]
    kept = plan["kept"]
    first_kept_id = plan["first_kept_id"]
    prompt_body = _merge_prior_summary(plan["latest"], older)
    try:
        summary = await _ainvoke_summary(prompt_body)
    except Exception:
        logger.exception("between-turn summarization failed thread=%s", thread_id)
        return None

    if not summary:
        return None

    row = store.create_compaction(
        {
            "thread_id": thread_id,
            "summary": summary,
            "first_kept_message_id": first_kept_id,
            "file_path": None,
        }
    )
    logger.info(
        "between-turn compaction thread=%s id=%s folded=%d kept=%d tokens≈%s",
        thread_id,
        row.get("id"),
        len(older),
        len(kept),
        plan.get("total_tokens"),
    )
    return row
