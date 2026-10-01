"""In-memory store: zero setup for local runs and tests. Data is lost on restart."""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any


def _now() -> datetime:
    return datetime.now(UTC)


class MemoryStore:
    def __init__(self) -> None:
        self.conversations: dict[str, dict[str, Any]] = {}
        self.messages: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.turns: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.notes: list[dict[str, Any]] = []
        self.cache: dict[str, dict[str, Any]] = {}
        self.usage: list[dict[str, Any]] = []

    async def create_conversation(self, ip_hash: str) -> str:
        cid = str(uuid.uuid4())
        self.conversations[cid] = {"id": cid, "ip_hash": ip_hash, "turn_count": 0, "created_at": _now()}
        return cid

    async def get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        return self.conversations.get(conversation_id)

    async def load_messages(self, conversation_id: str) -> list[dict[str, Any]]:
        return [dict(m) for m in self.messages[conversation_id]]

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
        self.messages[conversation_id].extend(new_messages)
        self.turns[conversation_id].append(
            {"question": question, "answer": answer, "trace": trace, "cached": cached, "created_at": _now().isoformat()}
        )
        conv = self.conversations[conversation_id]
        conv["turn_count"] += 1
        conv.setdefault("title", question[:80])

    async def list_turns(self, conversation_id: str) -> list[dict[str, Any]]:
        return list(self.turns[conversation_id])

    async def save_note(self, conversation_id: str | None, title: str, content: str) -> None:
        self.notes.append({"conversation_id": conversation_id, "title": title, "content": content})

    async def cache_get(self, key: str, ttl_hours: int) -> dict[str, Any] | None:
        hit = self.cache.get(key)
        if hit and hit["created_at"] > _now() - timedelta(hours=ttl_hours):
            return hit
        return None

    async def cache_put(self, key: str, question: str, answer: str, trace: list[dict[str, Any]]) -> None:
        self.cache[key] = {"question": question, "answer": answer, "trace": trace, "created_at": _now()}

    async def log_usage(self, row: dict[str, Any]) -> None:
        self.usage.append({**row, "created_at": _now()})

    async def usage_today(self) -> dict[str, Any]:
        start = _now().replace(hour=0, minute=0, second=0, microsecond=0)
        rows = [r for r in self.usage if r["created_at"] >= start]
        return {
            "requests": len(rows),
            "cache_hits": sum(1 for r in rows if r.get("cached")),
            "cost_usd": round(sum(r.get("cost_usd", 0.0) for r in rows), 6),
        }

    async def aclose(self) -> None:
        return None
