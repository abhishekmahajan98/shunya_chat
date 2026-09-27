---
name: datetime
description: How to use date/time tools for "now", timezones, and day gaps. Use when the datetime agent is enabled.
---

# Date & Time Skill

## When to use
- Current time/date, weekdays, timezone questions, days between dates
- The `datetime` agent is enabled

## Tools
- `datetime__now(timezone_name="UTC")` — IANA zones like `America/New_York`, `Asia/Kolkata`
- `datetime__days_between(start_date, end_date)` — `YYYY-MM-DD`

## Planning rules
1. Default timezone to UTC unless the user implies another.
2. Always call `now` instead of guessing the current date/time.
3. For "how many days until X", use `days_between` with ISO dates.
