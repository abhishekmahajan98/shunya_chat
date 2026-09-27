---
name: search
description: How to plan and use the Perplexity search agent (search__search) for web/docs lookup. Use when the search agent is enabled.
---

# Perplexity Search Skill

## When to use
- User asks for current info, docs, news, or anything that may be outdated in model knowledge
- You need citations / sources
- The `search` agent is enabled in this turn

## Tool
- `search__search(query: str)` — web search via Perplexity

## Planning rules
1. **Decide if search is needed** before answering from memory. Prefer search for:
   - versions, APIs, release notes, pricing, live status
   - "latest", "today", "current", "docs for X"
2. **Write a sharp query** — specific nouns + intent, not the whole user message.
   - Good: `LangGraph create_deep_agent skills parameter 2026`
   - Bad: `can you tell me about that thing`
3. **One focused search first**; only follow up if the answer is incomplete.
4. **Ground the reply** in the tool result. Quote or paraphrase the `answer`; list `citations` when present.
5. **Do not** use filesystem tools (`ls`, `read_file`) as a substitute for search.

## Response shape
- Short direct answer
- Key facts from search
- Sources (URLs from citations) when available
