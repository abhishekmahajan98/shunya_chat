---
name: research
description: Multi-step research — spawn general-purpose subagents for multi-search batches; keep trivial calc on the parent.
---

# Research workflow

## When to use
Non-trivial asks (multi-part research, compare, look up + compute). Prefer thoroughness.

## 1. Plan first
Call `write_todos` before heavy tool work. Items must be **specific** to the question.
Split independent concerns (e.g. research vs standalone math) into separate todos.

Mark exactly **one** item `in_progress` (unless intentionally running parallel
independent work). After each step: mark `completed`, next `in_progress`.

## 2. Gather
### Default for research batches → spawn `task`
If a plan step needs **several related searches** / multi-source dig / compare
facts: call `task` with `subagent_type="general-purpose"` for **that step only**.
Do not run a long parent-side search chain yourself.

### Trivial / math → you call tools
- One search or one lookup → call MCP yourself
- Standalone arithmetic → `calculator__*` yourself (or a separate parallel task)
- Never bolt unrelated math onto a research task brief

### Scope
- One concern per `task` — never paste the whole plan
- Independent work MAY run in parallel (research task + your calculator)

## 3. Synthesize
Draft from tool evidence only. No invented numbers/facts.

## 4. Verify (optional)
Re-check contested claims with a direct tool call, or another short `task`.

## 5. Finish
`cite_sources` if needed, mark **all** todos `completed`, write the final answer.
Do not answer while todos are still `pending` / `in_progress`.

## Anti-patterns
- Doing all multi-search research on the parent instead of spawning `task`
- One mega-task that dumps every todo into a single description
- Generic todos / leaving the whole plan `pending` until the end
- Assuming a capability not in the tool list
- Dumping raw tool JSON to the user
