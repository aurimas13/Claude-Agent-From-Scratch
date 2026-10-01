"""The agent's "hands": tool schemas Claude sees + the Python that runs them.

Step 2 of the guide ("Define your tools"), upgraded:
- calculator is an AST evaluator, not eval()
- weather + world time use real data from Open-Meteo (no key needed)
- save_note stores to the database instead of the server's disk
- web_search is Anthropic's server-side tool (runs on Anthropic's side, no code here)
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import httpx

from .calculator import CalculatorError, calculate
from .geocoding import PlaceNotFound
from .weather import get_weather
from .world_time import get_world_time

if TYPE_CHECKING:
    from ..store import Store

log = logging.getLogger(__name__)

MAX_NOTE_CHARS = 10_000
MAX_TITLE_CHARS = 120

CLIENT_TOOLS: list[dict[str, Any]] = [
    {
        "name": "calculator",
        "description": (
            "Evaluates a math expression exactly. Use it for ALL arithmetic instead of "
            "calculating in your head. Supports + - * / // % ** (or ^), parentheses, "
            "sqrt, cbrt, log, log10, exp, sin, cos, tan, factorial, round, abs, min, max, "
            "pi, e. Example: '10000 * (1 + 0.07) ** 10'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"expression": {"type": "string", "description": "One math expression."}},
            "required": ["expression"],
        },
    },
    {
        "name": "get_weather",
        "description": (
            "Gets the current weather and a short daily forecast for a city. Use it for "
            "any weather question. Temperatures are in Celsius."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City, optionally with country: 'Paris' or 'Paris, France'.",
                },
                "days": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 7,
                    "description": "Forecast days to include (default 3).",
                },
            },
            "required": ["location"],
        },
    },
    {
        "name": "get_world_time",
        "description": (
            "Gets the current local date and time for a city or IANA time zone. Use it "
            "whenever the answer depends on the current time or date anywhere."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City ('Tokyo'), 'City, Country', or zone ('Asia/Tokyo', 'UTC').",
                }
            },
            "required": ["location"],
        },
    },
    {
        "name": "save_note",
        "description": (
            "Saves a note (e.g. a result or summary) so the user can download it. Only use "
            "it when the user asks to save, export or keep something."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Short title, e.g. 'Investment plan'."},
                "content": {"type": "string", "description": "The full text to save (Markdown ok)."},
            },
            "required": ["title", "content"],
        },
    },
]

# Tools whose answers change over time; replies that used them are never cached.
TIME_SENSITIVE_TOOLS = {"get_weather", "get_world_time", "web_search", "save_note"}


def build_tool_specs(enable_web_search: bool, web_search_max_uses: int) -> list[dict[str, Any]]:
    specs = [dict(t) for t in CLIENT_TOOLS]
    if enable_web_search:
        specs.append({"type": "web_search_20260318", "name": "web_search", "max_uses": web_search_max_uses})
    return specs


@dataclass
class ToolContext:
    http: httpx.AsyncClient
    store: Store
    conversation_id: str | None = None


async def run_tool(name: str, tool_input: dict[str, Any], ctx: ToolContext) -> tuple[str, bool]:
    """Run a client-side tool. Returns (output, is_error). Never raises."""
    try:
        match name:
            case "calculator":
                return calculate(str(tool_input["expression"])), False
            case "get_weather":
                return await get_weather(str(tool_input["location"]), ctx.http, int(tool_input.get("days", 3))), False
            case "get_world_time":
                return await get_world_time(str(tool_input["location"]), ctx.http), False
            case "save_note":
                title = str(tool_input["title"]).strip()[:MAX_TITLE_CHARS] or "Note"
                content = str(tool_input["content"])[:MAX_NOTE_CHARS]
                await ctx.store.save_note(ctx.conversation_id, title, content)
                return json.dumps({"saved": True, "title": title, "chars": len(content)}), False
            case _:
                return f"Unknown tool: {name}", True
    except (CalculatorError, PlaceNotFound, LookupError, KeyError, ValueError) as exc:
        return f"Error: {exc}", True
    except httpx.HTTPError:
        log.warning("tool %s network error", name, exc_info=True)
        return "Error: the data service is not reachable right now. Try again shortly.", True
    except Exception:  # pragma: no cover - last-resort guard so the agent loop survives
        log.exception("tool %s failed", name)
        return "Error: the tool failed unexpectedly.", True
