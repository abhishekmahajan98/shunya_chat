"""
Date & Time MCP Server.
Mounted at /mcp/datetime
"""
from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastmcp import FastMCP

mcp = FastMCP("datetime")


@mcp.tool()
def now(timezone_name: str = "UTC") -> dict:
    """Return the current date and time.

    Args:
        timezone_name: IANA timezone, e.g. 'UTC', 'America/New_York', 'Asia/Kolkata'
    """
    try:
        tz = ZoneInfo(timezone_name) if timezone_name else timezone.utc
    except Exception:
        return {"status": "error", "error": f"Unknown timezone: {timezone_name}"}

    dt = datetime.now(tz)
    return {
        "status": "success",
        "iso": dt.isoformat(),
        "date": dt.strftime("%Y-%m-%d"),
        "time": dt.strftime("%H:%M:%S"),
        "timezone": timezone_name or "UTC",
        "weekday": dt.strftime("%A"),
    }


@mcp.tool()
def days_between(start_date: str, end_date: str) -> dict:
    """Number of days between two ISO dates (YYYY-MM-DD).

    Args:
        start_date: Start date YYYY-MM-DD
        end_date: End date YYYY-MM-DD
    """
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        return {
            "status": "success",
            "start_date": start_date,
            "end_date": end_date,
            "days": (end - start).days,
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=8004)
