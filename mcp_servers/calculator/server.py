"""
Calculator MCP Server using FastMCP.
Exposes arithmetic and scientific tools.
Runs on port 8002.
"""
import math
from typing import Union
from fastmcp import FastMCP

mcp = FastMCP(
    "calculator",
    host="0.0.0.0",
    port=8002,
)

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
        return "Error: Cannot calculate square root of a negative index."
    return math.sqrt(n)

@mcp.tool()
def logarithm(n: float, base: float = math.e) -> Union[float, str]:
    """Calculate the logarithm of n to a given base (defaults to natural log)."""
    if n <= 0:
        return "Error: Logarithm is only defined for positive numbers."
    return math.log(n, base)

@mcp.tool()
def calculate_expression(expression: str) -> Union[float, str, list]:
    """
    Evaluate a complex mathematical expression.
    Supported functions: sin, cos, tan, sqrt, log, exp, pi, e.
    Example: 'sin(pi/2) + sqrt(16)'
    """
    # Pre-process the expression:
    # 1. Replace '^' with '**' for exponentiation
    # 2. Remove commas from numbers (e.g., '1,000,000' -> '1000000')
    processed_expr = expression.replace('^', '**')
    
    # Simple regex-less comma removal for numbers
    import re
    # Match commas that are between digits
    processed_expr = re.sub(r'(\d),(\d)', r'\1\2', processed_expr)

    # Create a safe subset of math functions
    safe_dict = {
        'sin': math.sin,
        'cos': math.cos,
        'tan': math.tan,
        'sqrt': math.sqrt,
        'log': math.log,
        'exp': math.exp,
        'pi': math.pi,
        'e': math.e,
        'pow': math.pow
    }
    try:
        result = eval(processed_expr, {"__builtins__": None}, safe_dict)
        if isinstance(result, tuple):
            return list(result)
        return result
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    mcp.run(transport="sse")
