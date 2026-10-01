"""Terminal chat - the same agent as the website, no browser or database needed.

Run from the backend/ folder:
    python -m app.cli
Type 'exit' (or press Ctrl+C) to quit.
"""

from __future__ import annotations

import asyncio
import json

import httpx

from .agent import Agent
from .config import get_settings
from .llm import build_anthropic
from .store import MemoryStore
from .tools import ToolContext, build_tool_specs

DIM, BOLD, BLUE, GREEN, RED, RESET = "\033[2m", "\033[1m", "\033[94m", "\033[92m", "\033[91m", "\033[0m"


async def main() -> None:
    settings = get_settings()
    if not settings.anthropic_api_key.get_secret_value():
        raise SystemExit("Set ANTHROPIC_API_KEY in backend/.env first (copy .env.example).")
    client = build_anthropic(settings)
    tools = build_tool_specs(settings.enable_web_search, settings.web_search_max_uses)
    history: list[dict] = []

    print(f"{BOLD}Claude Agent From Scratch{RESET} - model {settings.model}. Type 'exit' to quit.")
    async with httpx.AsyncClient(timeout=8.0) as http:
        ctx = ToolContext(http=http, store=MemoryStore())
        while True:
            try:
                question = (await asyncio.to_thread(input, f"\n{BOLD}You:{RESET} ")).strip()
            except (KeyboardInterrupt, EOFError):
                break
            if question.lower() in {"exit", "quit", "bye"}:
                break
            if not question:
                continue
            history.append({"role": "user", "content": question})
            agent = Agent(client, settings.model, tools, settings.max_tokens, settings.max_iterations)
            print(f"\n{BOLD}Agent:{RESET} ", end="", flush=True)
            async for event in agent.run(history, ctx):
                match event["type"]:
                    case "text":
                        print(event["delta"], end="", flush=True)
                    case "tool_call":
                        print(f"\n  {BLUE}-> {event['name']}({json.dumps(event['input'])}){RESET}", flush=True)
                    case "tool_result":
                        color = RED if event["is_error"] else GREEN
                        print(f"  {color}<- {event['output'][:200]}{RESET}\n", flush=True)
                    case "done":
                        u = event["usage"]
                        print(
                            f"\n{DIM}[{event['iterations']} step(s), {u['input_tokens']} in / "
                            f"{u['output_tokens']} out tokens]{RESET}"
                        )
    print("Bye!")


if __name__ == "__main__":
    asyncio.run(main())
