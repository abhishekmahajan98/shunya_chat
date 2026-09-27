---
name: calculator
description: How to plan and use calculator MCP tools for math. Use when the calculator agent is enabled.
---

# Calculator Skill

## When to use
- Arithmetic, algebra-style expressions, roots, logs, trig
- The `calculator` agent is enabled

## Tools
- `calculator__add`, `calculator__subtract`, `calculator__multiply`, `calculator__divide`
- `calculator__power`, `calculator__sqrt`
- `calculator__calculate_expression(expression)` — preferred for multi-step expressions

## Planning rules
1. Prefer `calculate_expression` for anything beyond two operands.
2. Use `^` or `**` for powers; supported fns: `sin`, `cos`, `tan`, `sqrt`, `log`, `exp`, `pi`, `e`.
3. Never invent numeric results when calculator tools are available — call a tool.
4. If divide-by-zero or domain errors occur, explain the tool error clearly.
