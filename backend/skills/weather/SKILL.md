---
name: weather
description: ALWAYS call load_skill(name="weather") before any weather__ tool. How to use the weather agent for current conditions when the weather agent is enabled.
---

# Weather Skill

## When to use
- Current weather / conditions for a place
- The `weather` agent is enabled

## Tool
- `weather__get_weather(city: str)`

## Planning rules
1. Extract a clear city name (and country/region if ambiguous).
2. Call the tool once; don't guess temperatures.
3. If the tool errors, ask the user to clarify the location.
