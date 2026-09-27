---
name: search
description: How to plan and use the web/docs search capability when that agent is enabled.
---

# Search skill

## When to use
- User asks for current info, docs, news, or anything that may be outdated in model knowledge
- You need citations / sources
- The search agent is enabled in this turn (matching tools appear in your tool list)

## Tools
Use the search tool(s) from your tool list — do not invent alternate names.

## Planning rules
1. **Decide if search is needed** before answering from memory. Prefer search for:
   - versions, APIs, release notes, pricing, live status
   - "latest", "today", "current", "docs for X"
2. **Write a sharp query** — specific nouns + intent, not the whole user message.
3. **One focused search first**; only follow up if the answer is incomplete.
4. **Ground the reply** in the tool result. Quote or paraphrase; list sources when present.
5. **Do not** use workspace file tools as a substitute for search.

## Response shape
- Short direct answer
- Key facts from search
- Sources (URLs) when available
