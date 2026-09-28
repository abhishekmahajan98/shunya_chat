---
name: linear
description: ALWAYS call load_skill(name="linear") before any linear__ tool. Manage issues, projects, and team workflows via the Linear MCP. Use when the user wants to read, create, or update tickets in Linear.
---

# Linear

Adapted from the OpenAI curated Linear skill
(https://github.com/openai/skills/blob/main/skills/.curated/linear/SKILL.md)
for the official Linear remote MCP (`mcp.linear.app`).

## When to use

- User asks about issues, tickets, projects, cycles, assignees, labels, or comments in Linear
- Triage, sprint planning, workload, docs audit, or status updates that need Linear data
- The Linear agent is enabled this turn (`linear__*` tools appear in your tool list)

## Prerequisites

- Linear must be **Connected** (OAuth). If a tool fails with auth/connection errors, tell the user to open **Agents → Linear → Connect**, then retry.
- Use only tools that appear in your tool list. Names are prefixed `linear__` (e.g. `linear__list_issues`). Never invent tool or issue IDs.
- This workspace may expose **read-only** tools. Prefer list/get/search. Do not attempt create/update/comment if those tools are absent.

## Required workflow

Follow in order. Do not skip steps.

### Step 1 — Clarify goal and scope

Examples: issue triage, sprint planning, documentation audit, workload balance.
Confirm team/project, priority, labels, cycle, and due dates when relevant.

### Step 2 — Plan tools and IDs

Pick a workflow below. Confirm identifiers (issue id, project id, team key) **before** writes.
Never guess UUIDs or issue identifiers — resolve them with list/get/search first.

### Step 3 — Execute in batches

1. **Read first** (list / get / search) to build context.
2. **Create or update next** only when write tools exist and the user wants changes — include all required fields.
3. For bulk ops, explain the grouping logic before applying changes.

### Step 4 — Summarize

Call out remaining gaps or blockers. Propose next actions (issues, labels, assignments, follow-up comments). Prefer title, identifier, state, assignee, and URL when present.

## Typical MCP tools

Exact set depends on the connected Linear MCP endpoint and scopes. Common names (with `linear__` prefix):

**Issues:** `list_issues`, `get_issue`, `create_issue`, `update_issue`, `list_my_issues`, `list_issue_statuses`, `list_issue_labels`, `create_issue_label`

**Projects & team:** `list_projects`, `get_project`, `create_project`, `update_project`, `list_teams`, `get_team`, `list_users`

**Docs & collab:** `list_documents`, `get_document`, `search_documentation`, `list_comments`, `create_comment`, `list_cycles`

## Practical workflows

- **Sprint planning:** Review open issues for a team, pick top items by priority, assign into the current or a new cycle.
- **Bug triage:** List critical/high bugs, rank by impact, move top items toward In Progress (if write tools exist).
- **Documentation audit:** Search docs, open labeled documentation issues for gaps.
- **Workload balance:** Group active issues by assignee; flag overload; suggest redistributions.
- **Release planning:** Project with milestones; issues with estimates.
- **Dependencies:** Find blocked issues; identify blockers; create linked issues if missing and allowed.
- **Stale updates:** Find your issues with stale activity; add status comments when allowed.
- **Smart labeling:** Suggest/apply labels on unlabeled issues when allowed.
- **Retro:** Summarize last completed cycle — done vs pushed; open discussion issues for patterns.

## Tips

- Batch related reads; use specific filters over huge unfiltered lists.
- Prefer natural queries in tool args when the tool supports them (“what John is working on this week”).
- Reuse prior issue identifiers from this conversation; do not invent new ones.
- Respect rate limits — smaller batches for bulk changes.
- **Stop once you can answer.** Prefer `list_my_issues` / filtered `list_issues` over exhaustively listing projects, views, and teams.
- **Omit unused optional args** — do not pass null or empty strings. Example: “what projects?” → `linear__list_projects` with no args (or only filters you need), then answer.
- **Do not** use `ls`, `grep`, `read_file`, or other filesystem tools for Linear. Use `load_skill(name="linear")` once, then only `linear__*` tools.

## Troubleshooting

- **Auth:** Ask the user to reconnect Linear in Agents; verify workspace access.
- **Tool errors:** Provide all required fields; split complex requests; only call tools that exist in the list.
- **Missing data:** Wrong team/project, archived items, or insufficient scopes — say so clearly.
- **Writes unavailable:** If only read tools are present, report findings and describe the changes the user could make (or ask them to reconnect with write access if that exists later).
