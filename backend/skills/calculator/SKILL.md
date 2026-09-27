---
name: calculator
description: ALWAYS call load_skill(name="calculator") before any calculator__ tool. How to plan and use math/calculator tools when the calculator agent is enabled.
---

# Calculator skill

## When to use
- Arithmetic, algebra-style expressions, roots, logs, trig
- The calculator agent is enabled (matching tools appear in your tool list)

## Tools
Use the math/calculator tool(s) from your tool list — prefer a single expression
evaluator when available for multi-step expressions.

## Planning rules
1. Prefer one expression call for anything beyond two operands.
2. Never invent numeric results when calculator tools are available — call a tool.
3. If divide-by-zero or domain errors occur, explain the tool error clearly.
