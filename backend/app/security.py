"""Abuse and cost protection for a public demo that spends real API credits.

Layers (cheapest first):
1. Input limits        - message length, turns per conversation (pydantic + checks in main)
2. Rate limits         - per visitor, per minute and per day (in-process sliding window)
3. Bot check           - Cloudflare Turnstile once per visit, then a signed 12-hour session cookie
4. Daily budget cap    - global USD ceiling from the usage log in Supabase
Visitor IPs are never stored: only a salted SHA-256 hash is kept.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque

import httpx
from fastapi import Request

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def client_ip(request: Request) -> str:
    """Best-effort client IP behind Railway's proxy."""
    for header in ("x-real-ip", "x-forwarded-for"):
        value = request.headers.get(header)
        if value:
            return value.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def hash_ip(ip: str, salt: str) -> str:
    return hmac.new(salt.encode(), ip.encode(), hashlib.sha256).hexdigest()[:32]


class RateLimiter:
    """Sliding-window limiter. Per process: fine for one Railway instance (see SECURITY.md)."""

    def __init__(self, per_minute: int, per_day: int) -> None:
        self.windows = ((60.0, per_minute), (86_400.0, per_day))
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> int | None:
        """Record a hit. Returns seconds to wait if the key is over a limit, else None."""
        now = time.monotonic()
        hits = self.hits[key]
        while hits and now - hits[0] > self.windows[-1][0]:
            hits.popleft()
        for span, limit in self.windows:
            recent = [t for t in hits if now - t <= span]
            if len(recent) >= limit:
                return max(1, int(span - (now - recent[0])) + 1)
        hits.append(now)
        if len(self.hits) > 50_000:  # crude memory guard
            self.hits.clear()
        return None


async def verify_turnstile(token: str | None, secret: str, ip: str, http: httpx.AsyncClient) -> bool:
    if not token:
        return False
    try:
        response = await http.post(
            TURNSTILE_VERIFY_URL, data={"secret": secret, "response": token, "remoteip": ip}, timeout=5.0
        )
        return bool(response.json().get("success"))
    except (httpx.HTTPError, ValueError):
        return False


class SessionSigner:
    """Stateless human-verified sessions: one Turnstile check, then a signed cookie.

    Token = "v1.<random id>.<expiry unix>.<hmac>". Nothing is stored server-side; the HMAC key is
    derived from IP_HASH_SALT, so rotating that secret logs every visitor out.
    """

    def __init__(self, secret: str, ttl_seconds: int) -> None:
        self._key = hashlib.sha256(b"afs-session|" + secret.encode()).digest()
        self.ttl = ttl_seconds

    def _sign(self, payload: str) -> str:
        return hmac.new(self._key, payload.encode(), hashlib.sha256).hexdigest()[:40]

    def issue(self) -> tuple[str, int]:
        expires = int(time.time()) + self.ttl
        payload = f"v1.{secrets.token_urlsafe(16)}.{expires}"
        return f"{payload}.{self._sign(payload)}", expires

    def verify(self, token: str | None) -> tuple[str, int] | None:
        """Return (session_id, expires) for a valid, unexpired token, else None."""
        if not token or len(token) > 200:
            return None
        parts = token.split(".")
        if len(parts) != 4 or parts[0] != "v1" or not parts[2].isdigit():
            return None
        payload = ".".join(parts[:3])
        if not hmac.compare_digest(self._sign(payload), parts[3]):
            return None
        expires = int(parts[2])
        return (parts[1], expires) if expires > time.time() else None
