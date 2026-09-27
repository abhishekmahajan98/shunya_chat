---
name: research
description: Multi-step workflow — prompt-specific plan, then Gather → Synthesize → Verify. The todo plan is the backbone; update it after every step.
---

# Planning backbone

## When to use
Always for non-trivial asks. Prefer thoroughness over speed.

## 1. Plan first (required)
Call `write_todos` **before** any gather/verify work.

Todo items must be **specific to the user's question** — name the entities, metrics,
comparisons, or checks involved. Never use bare generics like "Gather evidence" alone.

Good examples:
- `Search current LangGraph create_deep_agent skills API`
- `Compare Postgres vs SQLite for Shunya thread storage`
- `Recompute portfolio return with calculator`
- `Verify the release-date claim with a second search`

Structure (adapt names to the prompt):
1. One or more **gather** steps (specific)
2. **Synthesize** grounded draft
3. One or more **verify** steps (specific)
4. Optional: `Record sources with cite_sources`

Mark exactly **one** item `in_progress` at a time.

## 2. Tick the plan as you go (required)
After finishing a step, call `write_todos` again immediately:
- mark that item `completed`
- set the next item `in_progress`
Do **not** batch completions at the end. The UI plan must advance live.

## 3. Gather
Prefer `task` → `gatherer` when several tool calls are needed.
Use only enabled agents/tools. No inventing search if it isn't selected.

## 4. Synthesize
Draft from gathered evidence only. No invented numbers/facts.

## 5. Verify
Prefer `task` → `verifier`. Re-check contested claims with enabled tools.

## 6. Finish
Call `cite_sources`, mark **all** todos `completed`, then write the final answer.
Do not give the final answer while any todo is still `pending` or `in_progress`.

## Tools
- `write_todos` — living plan (backbone)
- `task` (`gatherer` / `verifier`)
- `cite_sources`
- Enabled MCP tools only

## Anti-patterns
- Generic todos ("Gather evidence", "Synthesize answer", "Verify claims") with no prompt detail
- Leaving the whole plan `pending` until the end
- Skipping verify on multi-claim answers
- Assuming search exists when it wasn't selected
- Dumping raw tool JSON to the user
