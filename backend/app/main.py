"""FastAPI app: streams the agent's step-by-step work to the browser over Server-Sent Events.

Endpoints
    POST /api/chat                      - ask the agent (SSE stream of steps + answer)
    GET  /api/conversations/{id}        - reload a past conversation (Q&A + traces)
    GET  /api/stats                     - today's public usage counters
    GET  /api/health                    - liveness for Railway
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import anthropic
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .agent import PROMPT_VERSION, Agent, window
from .cache import cache_key, is_cacheable
from .config import Settings, get_settings
from .llm import build_anthropic
from .security import RateLimiter, client_ip, hash_ip, verify_turnstile
from .store import Store, build_store
from .tools import ToolContext, build_tool_specs

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("agent")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings: Settings = app.state.settings
    if not settings.anthropic_api_key.get_secret_value():
        raise RuntimeError("ANTHROPIC_API_KEY is not set (see backend/.env.example)")
    if settings.is_production and not settings.turnstile_secret_key:
        log.warning("TURNSTILE_SECRET_KEY not set: bot protection is OFF")
    app.state.http = getattr(app.state, "http", None) or httpx.AsyncClient(
        timeout=8.0, headers={"User-Agent": "claude-agent-from-scratch/1.0"}
    )
    app.state.store = getattr(app.state, "store", None) or build_store(settings)
    app.state.llm = getattr(app.state, "llm", None) or build_anthropic(settings)
    app.state.limiter = RateLimiter(settings.rate_limit_per_minute, settings.rate_limit_per_day)
    app.state.tool_specs = build_tool_specs(settings.enable_web_search, settings.web_search_max_uses)
    yield
    await app.state.store.aclose()
    await app.state.http.aclose()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="Claude Agent From Scratch",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        max_age=600,
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = response.headers.get("Cache-Control", "no-store")
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

    register_routes(app)
    return app


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    conversation_id: uuid.UUID | None = None
    turnstile_token: str | None = Field(default=None, max_length=4096)


def sse(event: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n".encode()


def merge_trace(trace: list[dict[str, Any]], event: dict[str, Any]) -> None:
    """Store text deltas as merged text segments; keep tool events as they are."""
    if event["type"] == "text":
        if trace and trace[-1]["type"] == "text":
            trace[-1]["text"] += event["delta"]
        else:
            trace.append({"type": "text", "text": event["delta"]})
    elif event["type"] in ("tool_call", "tool_result"):
        trace.append(event)


def register_routes(app: FastAPI) -> None:
    @app.get("/api/health")
    async def health(request: Request) -> dict[str, Any]:
        s: Settings = request.app.state.settings
        return {"status": "ok", "model": s.model, "storage": "supabase" if s.supabase_enabled else "memory"}

    @app.get("/api/stats")
    async def stats(request: Request) -> dict[str, Any]:
        today = await request.app.state.store.usage_today()
        return {"questions_today": today["requests"], "answered_from_cache": today["cache_hits"]}

    @app.get("/api/conversations/{conversation_id}")
    async def get_conversation(conversation_id: uuid.UUID, request: Request) -> dict[str, Any]:
        store: Store = request.app.state.store
        if not await store.get_conversation(str(conversation_id)):
            raise HTTPException(404, "Conversation not found")
        return {"conversation_id": str(conversation_id), "turns": await store.list_turns(str(conversation_id))}

    @app.post("/api/chat")
    async def chat(body: ChatRequest, request: Request):
        s: Settings = request.app.state.settings
        store: Store = request.app.state.store
        http: httpx.AsyncClient = request.app.state.http

        message = body.message.strip()
        if not message or len(message) > s.max_message_chars:
            raise HTTPException(400, f"Message must be 1-{s.max_message_chars} characters.")

        ip = client_ip(request)
        ip_hash = hash_ip(ip, s.ip_hash_salt.get_secret_value())
        if (wait := request.app.state.limiter.check(ip_hash)) is not None:
            return JSONResponse(
                {"detail": f"Slow down a little - try again in {wait} seconds."},
                status_code=429,
                headers={"Retry-After": str(wait)},
            )

        if (await store.usage_today())["cost_usd"] >= s.daily_budget_usd:
            raise HTTPException(503, "The demo's daily budget is used up. Please come back tomorrow!")

        if body.conversation_id:
            conversation_id = str(body.conversation_id)
            conversation = await store.get_conversation(conversation_id)
            if not conversation:
                raise HTTPException(404, "Conversation not found - start a new chat.")
            if conversation.get("turn_count", 0) >= s.max_turns_per_conversation:
                raise HTTPException(409, "This chat is full - start a new one.")
        else:
            if s.turnstile_secret_key and not await verify_turnstile(
                body.turnstile_token, s.turnstile_secret_key.get_secret_value(), ip, http
            ):
                raise HTTPException(403, "Bot check failed - refresh the page and try again.")
            conversation_id = await store.create_conversation(ip_hash)

        history = await store.load_messages(conversation_id)
        first_turn = not history

        key = cache_key(message, s.model, PROMPT_VERSION)
        cached = await store.cache_get(key, s.cache_ttl_hours) if (s.cache_enabled and first_turn) else None

        async def stream() -> AsyncIterator[bytes]:
            started = time.perf_counter()
            yield sse({"type": "meta", "conversation_id": conversation_id})
            trace: list[dict[str, Any]] = []
            new_messages: list[dict[str, Any]] = []
            agent: Agent | None = None
            done: dict[str, Any] = {}

            try:
                if cached:
                    for item in cached["trace"]:
                        event = {"type": "text", "delta": item["text"]} if item["type"] == "text" else item
                        merge_trace(trace, event)
                        yield sse(event)
                    new_messages = [
                        {"role": "user", "content": message},
                        {"role": "assistant", "content": [{"type": "text", "text": cached["answer"]}]},
                    ]
                    done = {"type": "done", "cached": True, "stop_reason": "end_turn", "tools_used": []}
                    yield sse(done)
                    return

                convo = window(history, s.history_window_messages) + [{"role": "user", "content": message}]
                base_len = len(convo) - 1
                agent = Agent(
                    client=request.app.state.llm,
                    model=s.model,
                    tools=request.app.state.tool_specs,
                    max_tokens=s.max_tokens,
                    max_iterations=s.max_iterations,
                )
                ctx = ToolContext(http=http, store=store, conversation_id=conversation_id)
                async for event in agent.run(convo, ctx):
                    if event["type"] == "done":
                        done = {**event, "cached": False}
                    merge_trace(trace, event)
                    yield sse(event if event["type"] != "done" else done)
                new_messages = convo[base_len:]
            except anthropic.APIStatusError as exc:
                log.error("anthropic error %s: %s", exc.status_code, exc.message)
                msg = (
                    "The AI service is busy - please retry."
                    if exc.status_code in (429, 529)
                    else "The AI service returned an error."
                )
                yield sse({"type": "error", "message": msg})
            except anthropic.APIConnectionError:
                log.exception("anthropic connection error")
                yield sse({"type": "error", "message": "Couldn't reach the AI service - please retry."})
            finally:
                await asyncio.shield(
                    persist(
                        store,
                        s,
                        conversation_id,
                        len(history),
                        new_messages,
                        message,
                        trace,
                        agent,
                        done,
                        key,
                        first_turn,
                        ip_hash,
                        started,
                    )
                )

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
        )


async def persist(
    store: Store,
    s: Settings,
    conversation_id: str,
    seq: int,
    new_messages: list[dict[str, Any]],
    question: str,
    trace: list[dict[str, Any]],
    agent: Agent | None,
    done: dict[str, Any],
    key: str,
    first_turn: bool,
    ip_hash: str,
    started: float,
) -> None:
    """Save memory, the Q&A trace, the cache entry and the usage row. Never raises."""
    answer = "".join(t["text"] for t in trace if t["type"] == "text").strip()
    cached = bool(done.get("cached"))
    try:
        if done and new_messages:
            await store.save_turn(
                conversation_id,
                first_seq=seq,
                new_messages=new_messages,
                question=question,
                answer=answer,
                trace=trace,
                cached=cached,
            )
            if (
                agent
                and first_turn
                and s.cache_enabled
                and answer
                and is_cacheable(agent.tools_used, done.get("stop_reason", ""))
            ):
                await store.cache_put(key, question, answer, trace)
        usage = agent.usage if agent else None
        await store.log_usage(
            {
                "conversation_id": conversation_id,
                "ip_hash": ip_hash,
                "model": s.model,
                "input_tokens": usage.input_tokens if usage else 0,
                "output_tokens": usage.output_tokens if usage else 0,
                "web_searches": usage.web_searches if usage else 0,
                "cost_usd": usage.cost(s.price_input_per_mtok, s.price_output_per_mtok, s.price_web_search_per_1k)
                if usage
                else 0.0,
                "cached": cached,
                "latency_ms": round((time.perf_counter() - started) * 1000),
                "stop_reason": done.get("stop_reason", "error"),
            }
        )
    except Exception:
        log.exception("failed to persist turn for %s", conversation_id)


app = create_app()
