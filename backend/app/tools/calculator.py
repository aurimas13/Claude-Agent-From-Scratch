"""A safe calculator: parses the expression into an AST and evaluates only math.

Unlike eval(), nothing outside the whitelist below can run, so expressions like
"__import__('os')" or "(1).__class__" are rejected.
"""

from __future__ import annotations

import ast
import math
import operator

_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY_OPS = {ast.UAdd: operator.pos, ast.USub: operator.neg}

_FUNCTIONS = {
    name: getattr(math, name)
    for name in (
        "sqrt",
        "cbrt",
        "exp",
        "log",
        "log10",
        "log2",
        "sin",
        "cos",
        "tan",
        "asin",
        "acos",
        "atan",
        "atan2",
        "sinh",
        "cosh",
        "tanh",
        "degrees",
        "radians",
        "floor",
        "ceil",
        "fabs",
        "hypot",
        "gcd",
        "lcm",
        "comb",
        "perm",
        "trunc",
    )
    if hasattr(math, name)
}
_FUNCTIONS.update({"abs": abs, "round": round, "min": min, "max": max})
_CONSTANTS = {"pi": math.pi, "e": math.e, "tau": math.tau}

MAX_EXPRESSION_CHARS = 300
MAX_EXPONENT = 10_000
MAX_INT_DIGITS = 4_300


class CalculatorError(ValueError):
    pass


def _factorial(n: float) -> int:
    if not float(n).is_integer() or n < 0 or n > 500:
        raise CalculatorError("factorial needs a whole number between 0 and 500")
    return math.factorial(int(n))


_FUNCTIONS["factorial"] = _factorial


def _eval(node: ast.AST) -> float | int:
    if isinstance(node, ast.Expression):
        return _eval(node.body)
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _BIN_OPS:
        left, right = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > MAX_EXPONENT:
            raise CalculatorError("exponent too large")
        result = _BIN_OPS[type(node.op)](left, right)
        if isinstance(result, int) and result.bit_length() > MAX_INT_DIGITS * 3.33:
            raise CalculatorError("result too large")
        return result
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPS:
        return _UNARY_OPS[type(node.op)](_eval(node.operand))
    if isinstance(node, ast.Name) and node.id in _CONSTANTS:
        return _CONSTANTS[node.id]
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id in _FUNCTIONS
        and not node.keywords
    ):
        return _FUNCTIONS[node.func.id](*(_eval(arg) for arg in node.args))
    raise CalculatorError(f"'{ast.unparse(node)}' is not allowed")


def _format(value: float | int) -> str:
    if isinstance(value, float):
        if value.is_integer() and abs(value) < 1e15:
            return str(int(value))
        return f"{value:.10g}"
    return str(value)


def calculate(expression: str) -> str:
    """Evaluate a math expression and return the result as text."""
    expression = expression.strip().replace("^", "**").replace("×", "*").replace("÷", "/")
    if not expression:
        raise CalculatorError("empty expression")
    if len(expression) > MAX_EXPRESSION_CHARS:
        raise CalculatorError("expression too long")
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise CalculatorError("invalid syntax") from exc
    try:
        return _format(_eval(tree))
    except ZeroDivisionError as exc:
        raise CalculatorError("division by zero") from exc
    except OverflowError as exc:
        raise CalculatorError("number too large") from exc
    except (TypeError, ValueError) as exc:
        if isinstance(exc, CalculatorError):
            raise
        raise CalculatorError(str(exc)) from exc
