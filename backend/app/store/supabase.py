"""Supabase store over the PostgREST Data API with plain httpx.

Why not supabase-py? New Supabase secret keys (sb_secret_...) must be sent in the
`apikey` header only, never as `Authorization: Bearer`. A tiny explicit client keeps
that correct for both new and legacy keys, and keeps the dependency list short.

This runs server-side only. Row Level Security is enabled on every table with no
public policies, so the browser (or anyone holding a publishable key) can read nothing.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx


def project_url(url: str) -> str:
    """Accept the project URL with or without a trailing /rest/v1 (both are shown in the dashboard)."""
    url = url.strip().rstrip("/")
    return url.removesuffix("/rest/v1").rstrip("/")


class SupabaseStore:
    def __init__(self, url: str, secret_key: str, http: httpx.AsyncClient | None = None) -> None:
        headers = {"apikey": secret_key, "Content-Type": "application/json"}
        if secret_key.startswith("eyJ"):  # legacy JWT service_role key
            headers["Authorization"] = f"Bearer {secret_key}"
        self._http = http or httpx.AsyncClient(base_url=f"{project_url(url)}/rest/v1", headers=headers, timeout=10.0)

    async def _get(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        response = await self._http.get(path, params=params)
        response.raise_for_status()
        return response.json()

    async def _post(self, path: str, body: Any, prefer: str = "return=minimal", params: dict | None = None) -> Any:
        response = await self._http.post(path, json=body, headers={"Prefer": prefer}, params=params)
        response.raise_for_status()
        return response.json() if response.content else None

    # --- conversations & memory ---
    async def create_conversation(self, ip_hash: str) -> str:
        rows = await self._post("/conversations", {"ip_hash": ip_hash}, prefer="return=representation")
        return rows[0]["id"]

    async def get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        rows = await self._get(
            "/conversations", {"id": f"eq.{conversation_id}", "select": "id,turn_count,title,created_at"}
        )
        return rows[0] if rows else None

    async def load_messages(self, conversation_id: str) -> list[dict[str, Any]]:
        rows = await self._get(
            "/messages",
            {"conversation_id": f"eq.{conversation_id}", "select": "role,content", "order": "seq.asc"},
        )
        return [{"role": r["role"], "content": r["content"]} for r in rows]

    async def save_turn(
        self,
        conversation_id: str,
        *,
        first_seq: int,
        new_messages: list[dict[str, Any]],
        question: str,
        answer: str,
        trace: list[dict[str, Any]],
        cached: bool,
    ) -> None:
        if new_messages:
            await self._post(
                "/messages",
                [
                    {
                        "conversation_id": conversation_id,
                        "seq": first_seq + i,
                        "role": m["role"],
                        "content": m["content"],
                    }
                    for i, m in enumerate(new_messages)
                ],
            )
        # A database trigger bumps conversations.turn_count and sets the title.
        await self._post(
            "/turns",
            {
                "conversation_id": conversation_id,
                "question": question,
                "answer": answer,
                "trace": trace,
                "cached": cached,
            },
        )

    async def list_turns(self, conversation_id: str) -> list[dict[str, Any]]:
        return await self._get(
            "/turns",
            {
                "conversation_id": f"eq.{conversation_id}",
                "select": "question,answer,trace,cached,created_at",
                "order": "id.asc",
            },
        )

    async def save_note(self, conversation_id: str | None, title: str, content: str) -> None:
        await self._post("/notes", {"conversation_id": conversation_id, "title": title, "content": content})

    # --- answer cache ---
    async def cache_get(self, key: str, ttl_hours: int) -> dict[str, Any] | None:
        cutoff = (datetime.now(UTC) - timedelta(hours=ttl_hours)).isoformat()
        rows = await self._get(
            "/answer_cache",
            {"key": f"eq.{key}", "created_at": f"gte.{cutoff}", "select": "question,answer,trace", "limit": "1"},
        )
        return rows[0] if rows else None

    async def cache_put(self, key: str, question: str, answer: str, trace: list[dict[str, Any]]) -> None:
        await self._post(
            "/answer_cache",
            {
                "key": key,
                "question": question,
                "answer": answer,
                "trace": trace,
                "created_at": datetime.now(UTC).isoformat(),
            },
            prefer="resolution=merge-duplicates,return=minimal",
            params={"on_conflict": "key"},
        )

    # --- usage & budget ---
    async def log_usage(self, row: dict[str, Any]) -> None:
        await self._post("/usage_log", row)

    async def usage_today(self) -> dict[str, Any]:
        rows = await self._post("/rpc/usage_today", {}, prefer="return=representation")
        row = rows[0] if isinstance(rows, list) and rows else rows or {}
        return {
            "requests": int(row.get("requests") or 0),
            "cache_hits": int(row.get("cache_hits") or 0),
            "cost_usd": float(row.get("cost_usd") or 0.0),
        }

    async def aclose(self) -> None:
        await self._http.aclose()
