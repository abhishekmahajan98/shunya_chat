---
name: research
description: ALWAYS call load_skill(name="research") before multi-step research or subagent delegation with enabled agents. Prefer direct tools for trivial calls; delegate multi-tool batches when those tools are enabled.
---

# Research workflow

## When to use
Non-trivial asks (multi-part research, compare, look up + compute). Prefer thoroughness.

## 1. Plan first
Use the planning/todo tool before heavy tool work. Items must be **specific** to the question.
Split independent concerns (e.g. research vs standalone math) into separate todos.

Mark exactly **one** item `in_progress` (unless intentionally running parallel
independent work). After each step: mark `completed`, next `in_progress`.

## 2. Gather
### Default for research batches → delegate
If a plan step needs **several related lookups** / multi-source dig / compare
facts **and** those tools are in your list: use the subagent/task tool for
**that step only**. Do not run a long parent-side lookup chain yourself.

### Trivial / math → you call tools
- One lookup → call the matching tool yourself
- Standalone arithmetic → call the math capability yourself (or a separate parallel subagent)
- Never bolt unrelated math onto a research brief

### Scope
- One concern per subagent call — never paste the whole plan
- Independent work MAY run in parallel
- If needed tools are not enabled, do not delegate or search the workspace; tell the user to enable them

## 3. Synthesize
Draft from tool evidence only. No invented numbers/facts.

## 4. Verify (optional)
Re-check contested claims with a direct tool call, or another short subagent.

## 5. Finish
Use the citation tool if needed, mark **all** todos `completed`, write the final answer.
Do not answer while todos are still `pending` / `in_progress`.

## Anti-patterns
- Doing all multi-lookup research on the parent instead of delegating a batch
- One mega-brief that dumps every todo into a single subagent description
- Delegating or browsing the workspace when the needed tools are not enabled
- Using the workspace filesystem to look up world facts (skills only)
- Generic todos / leaving the whole plan `pending` until the end
- Assuming a capability not in the tool list
- Dumping raw tool JSON to the user
