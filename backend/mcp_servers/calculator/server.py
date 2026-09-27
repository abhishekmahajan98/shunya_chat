"""
Calculator MCP Server.
Mounted at /mcp/calculator
"""
from __future__ import annotations

import math
import re
from typing import Union

from fastmcp import FastMCP

mcp = FastMCP("calculator")


@mcp.tool()
def add(a: float, b: float) -> float:
    """Add two numbers."""
    return a + b


@mcp.tool()
def subtract(a: float, b: float) -> float:
    """Subtract b from a."""
    return a - b


@mcp.tool()
def multiply(a: float, b: float) -> float:
    """Multiply two numbers."""
    return a * b


@mcp.tool()
def divide(a: float, b: float) -> Union[float, str]:
    """Divide a by b."""
    if b == 0:
        return "Error: Division by zero"
    return a / b


@mcp.tool()
def power(base: float, exponent: float) -> float:
    """Calculate base raised to the power of exponent."""
    return math.pow(base, exponent)


@mcp.tool()
def sqrt(n: float) -> Union[float, str]:
    """Calculate the square root of n."""
    if n < 0:
        return "Error: Cannot calculate square root of a negative number."
    return math.sqrt(n)


@mcp.tool()
def calculate_expression(expression: str) -> Union[float, str, list]:
    """Evaluate a math expression. Supports sin, cos, tan, sqrt, log, exp, pi, e, ^.

    Example: 'sin(pi/2) + sqrt(16)'
    """
    processed = expression.replace("^", "**")
    processed = re.sub(r"(\d),(\d)", r"\1\2", processed)
    safe = {
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "sqrt": math.sqrt,
        "log": math.log,
        "exp": math.exp,
        "pi": math.pi,
        "e": math.e,
        "pow": math.pow,
    }
    try:
        result = eval(processed, {"__builtins__": None}, safe)  # noqa: S307
        if isinstance(result, tuple):
            return list(result)
        return result
    except Exception as exc:
        return f"Error: {exc}"


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=8002)
