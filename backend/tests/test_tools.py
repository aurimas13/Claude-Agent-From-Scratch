import json

import pytest

from app.store import MemoryStore
from app.tools import ToolContext, build_tool_specs, run_tool
from app.tools.calculator import CalculatorError, calculate


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("2 + 2", "4"),
        ("10000 * (1 + 0.07) ** 10", "19671.51357"),
        ("sqrt(144) * 366", "4392"),
        ("2^10", "1024"),
        ("15 / 100 * 240", "36"),
        ("round(pi, 3)", "3.142"),
        ("factorial(5)", "120"),
        ("12 × 3 ÷ 4", "9"),
    ],
)
def test_calculator_valid(expression, expected):
    assert calculate(expression) == expected


@pytest.mark.parametrize(
    "expression",
    [
        "__import__('os').system('ls')",
        "(1).__class__",
        "open('x')",
        "2 ** 99999999",
        "1 / 0",
        "lambda: 1",
        "x + 1",
        "factorial(10000)",
        "",
        "1" * 400,
    ],
)
def test_calculator_rejects_unsafe_or_invalid(expression):
    with pytest.raises(CalculatorError):
        calculate(expression)


async def test_weather_tool(http):
    ctx = ToolContext(http=http, store=MemoryStore())
    output, is_error = await run_tool("get_weather", {"location": "Paris, France"}, ctx)
    data = json.loads(output)
    assert not is_error
    assert data["location"].startswith("Paris")
    assert data["current"]["temperature_c"] == 17.2
    assert data["current"]["condition"] == "Partly cloudy"
    assert data["forecast"][1]["condition"] == "Light rain"


async def test_world_time_by_city_and_zone(http):
    ctx = ToolContext(http=http, store=MemoryStore())
    by_city = json.loads((await run_tool("get_world_time", {"location": "Paris"}, ctx))[0])
    assert by_city["timezone"] == "Europe/Paris"
    by_zone = json.loads((await run_tool("get_world_time", {"location": "Asia/Tokyo"}, ctx))[0])
    assert by_zone["timezone"] == "Asia/Tokyo"
    assert by_zone["utc_offset"] == "+09:00"


async def test_unknown_place_is_a_tool_error_not_a_crash(http):
    ctx = ToolContext(http=http, store=MemoryStore())
    output, is_error = await run_tool("get_weather", {"location": "Atlantis"}, ctx)
    assert is_error and "could not find" in output


async def test_save_note_is_stored_and_truncated(http):
    store = MemoryStore()
    ctx = ToolContext(http=http, store=store, conversation_id="c1")
    output, is_error = await run_tool("save_note", {"title": "Plan", "content": "x" * 20_000}, ctx)
    assert not is_error and json.loads(output)["saved"]
    assert len(store.notes[0]["content"]) == 10_000


async def test_unknown_tool(http):
    output, is_error = await run_tool("rm_rf", {}, ToolContext(http=http, store=MemoryStore()))
    assert is_error


def test_tool_specs_include_server_web_search_only_when_enabled():
    names = [t["name"] for t in build_tool_specs(True, 3)]
    assert "web_search" in names
    assert "web_search" not in [t["name"] for t in build_tool_specs(False, 3)]
