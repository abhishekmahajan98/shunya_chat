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
- `Look up current docs for create_deep_agent skills API`
- `Compare Postgres vs SQLite for thread storage`
- `Recompute the numeric result with an enabled math tool`
- `Verify the release-date claim with a second tool call`

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

## 3. Gather (one step at a time)
For each **gather** todo, in order:
1. Ensure that todo is `in_progress`
2. Call `task` → `gatherer` with a description of **only that todo**
3. When gatherer returns, `write_todos`: mark it `completed`, next gather `in_progress`
4. Call gatherer again for the next gather todo

Do **not** pack step 1 and step 2 into one gatherer call. Do not mark a gather
todo completed until its tools have run. The gatherer inventories its tool list
and uses whatever is relevant to **that** step only.

## 4. Synthesize
Draft from gathered evidence only. No invented numbers/facts.
Do **not** call verifier until gather + synthesize for this turn are done.

## 5. Verify (required)
You MUST call `task` → `verifier` after synthesizing and before `cite_sources`
or the final answer. Verifier is a **light re-check** (≤3 tool calls) — not
primary research. After verifier returns, write the full user-facing answer.
Skipping verify is not allowed when the `task` tool is available.

## 6. Finish
Call `cite_sources`, mark **all** todos `completed`, then write the final answer.
Do not give the final answer while any todo is still `pending` or `in_progress`.
Do not give the final answer until `task→verifier` has run.

## Tools
- `write_todos` — living plan (backbone)
- `task` (`gatherer` / `verifier`) — **verifier is mandatory** before the answer
- `cite_sources`
- Whatever other tools are enabled for this turn (see your tool list)

## Anti-patterns
- Generic todos ("Gather evidence", "Synthesize answer", "Verify claims") with no prompt detail
- Leaving the whole plan `pending` until the end
- Skipping `task→verifier` (or only "verifying" in prose without the subagent)
- Assuming a capability exists when it is not in the tool list
- Dumping raw tool JSON to the user
