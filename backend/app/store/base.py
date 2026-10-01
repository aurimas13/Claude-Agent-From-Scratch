"""Storage interface. Two implementations: in-memory (local/dev/tests) and Supabase."""

from __future__ import annotations

from typing import Any, Protocol


class Store(Protocol):
    async def create_conversation(self, ip_hash: str) -> str: ...

    async def get_conversation(self, conversation_id: str) -> dict[str, Any] | None: ...

    async def load_messages(self, conversation_id: str) -> list[dict[str, Any]]: ...

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
    ) -> None: ...

    async def list_turns(self, conversation_id: str) -> list[dict[str, Any]]: ...

    async def save_note(self, conversation_id: str | None, title: str, content: str) -> None: ...

    async def cache_get(self, key: str, ttl_hours: int) -> dict[str, Any] | None: ...

    async def cache_put(self, key: str, question: str, answer: str, trace: list[dict[str, Any]]) -> None: ...

    async def log_usage(self, row: dict[str, Any]) -> None: ...

    async def usage_today(self) -> dict[str, Any]: ...

    async def aclose(self) -> None: ...
