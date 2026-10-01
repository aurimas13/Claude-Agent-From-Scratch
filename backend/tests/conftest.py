"""Test doubles: a scripted fake of the Anthropic streaming API, so tests never hit the network."""

from __future__ import annotations

import copy
import json
from types import SimpleNamespace as NS
from typing import Any

import httpx
import pytest
from anthropic.types import Message, TextBlock, ToolUseBlock, Usage

from app.config import Settings
from app.main import create_app
from app.store import MemoryStore


def text(t: str) -> TextBlock:
    return TextBlock(type="text", text=t)


def tool(name: str, inp: dict[str, Any], id: str = "toolu_1") -> ToolUseBlock:
    return ToolUseBlock(type="tool_use", id=id, name=name, input=inp)


def msg(*blocks: Any, stop: str = "end_turn", tin: int = 100, tout: int = 20) -> Message:
    return Message(
        id="msg_1",
        type="message",
        role="assistant",
        model="claude-test",
        content=list(blocks),
        stop_reason=stop,
        stop_sequence=None,
        usage=Usage(input_tokens=tin, output_tokens=tout),
    )


class FakeStream:
    def __init__(self, message: Message) -> None:
        self.message = message

    async def __aenter__(self) -> FakeStream:
        return self

    async def __aexit__(self, *exc: Any) -> None:
        return None

    async def _events(self):
        for block in self.message.content:
            if block.type == "text":
                for word in block.text.split(" "):
                    yield NS(type="text", text=word + " ")
            yield NS(type="content_block_stop", content_block=block)

    def __aiter__(self):
        return self._events()

    async def get_final_message(self) -> Message:
        return self.message


class FakeMessages:
    def __init__(self, script: list[Message]) -> None:
        self.script = list(script)
        self.calls: list[dict[str, Any]] = []

    def stream(self, **kwargs: Any) -> FakeStream:
        self.calls.append(copy.deepcopy(kwargs))
        if not self.script:
            raise AssertionError("FakeAnthropic: no scripted response left")
        return FakeStream(self.script.pop(0))


class FakeAnthropic:
    def __init__(self, script: list[Message] | None = None) -> None:
        self.messages = FakeMessages(script or [])


GEOCODE_PARIS = {
    "results": [
        {
            "name": "Paris",
            "country": "France",
            "country_code": "FR",
            "admin1": "Île-de-France",
            "latitude": 48.85,
            "longitude": 2.35,
            "timezone": "Europe/Paris",
        }
    ]
}
FORECAST = {
    "current": {
        "time": "2026-10-01T14:00",
        "temperature_2m": 17.2,
        "apparent_temperature": 16.1,
        "relative_humidity_2m": 60,
        "weather_code": 2,
        "wind_speed_10m": 12.5,
        "is_day": 1,
    },
    "daily": {
        "time": ["2026-10-01", "2026-10-02"],
        "weather_code": [2, 61],
        "temperature_2m_max": [18.0, 15.5],
        "temperature_2m_min": [10.1, 9.0],
        "precipitation_probability_max": [10, 80],
    },
}


def open_meteo_handler(request: httpx.Request) -> httpx.Response:
    if "geocoding-api" in request.url.host:
        name = request.url.params.get("name", "")
        return httpx.Response(200, json=GEOCODE_PARIS if name.lower() == "paris" else {})
    if request.url.host == "api.open-meteo.com":
        return httpx.Response(200, json=FORECAST)
    if "challenges.cloudflare.com" in request.url.host:
        ok = b"response=good-token" in request.content
        return httpx.Response(200, json={"success": ok})
    return httpx.Response(404)


@pytest.fixture
def http() -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(open_meteo_handler))


def make_settings(**overrides: Any) -> Settings:
    base = {
        "anthropic_api_key": "sk-test",
        "supabase_url": None,
        "supabase_secret_key": None,
        "turnstile_secret_key": None,
        "ip_hash_salt": "salt",
        "rate_limit_per_minute": 100,
        "rate_limit_per_day": 1000,
    }
    return Settings(_env_file=None, **{**base, **overrides})


def make_app(script: list[Message], **settings: Any):
    app = create_app(make_settings(**settings))
    app.state.llm = FakeAnthropic(script)
    app.state.store = MemoryStore()
    app.state.http = httpx.AsyncClient(transport=httpx.MockTransport(open_meteo_handler))
    return app


def parse_sse(body: str) -> list[dict[str, Any]]:
    return [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]
