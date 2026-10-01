from app.agent import Agent, window
from app.store import MemoryStore
from app.tools import ToolContext
from tests.conftest import FakeAnthropic, msg, text, tool


async def collect(agent, history, ctx):
    return [e async for e in agent.run(history, ctx)]


async def test_react_loop_calls_tool_then_answers(http):
    llm = FakeAnthropic(
        [
            msg(text("Let me calculate that."), tool("calculator", {"expression": "2+2"}), stop="tool_use"),
            msg(text("The answer is **4**.")),
        ]
    )
    agent = Agent(client=llm, model="m", tools=[])
    history = [{"role": "user", "content": "What is 2+2?"}]
    events = await collect(agent, history, ToolContext(http=http, store=MemoryStore()))

    types = [e["type"] for e in events]
    assert types.index("tool_call") < types.index("tool_result") < len(types) - 1
    result = next(e for e in events if e["type"] == "tool_result")
    assert result["output"] == "4" and not result["is_error"]
    done = events[-1]
    assert done["type"] == "done" and done["stop_reason"] == "end_turn" and done["iterations"] == 2
    assert done["usage"]["input_tokens"] == 200
    assert agent.tools_used == {"calculator"}
    # history alternates user/assistant and the tool result is fed back to Claude
    assert [m["role"] for m in history] == ["user", "assistant", "user", "assistant"]
    assert history[2]["content"][0]["type"] == "tool_result"
    second_call = llm.messages.calls[1]["messages"]
    assert second_call[-1]["content"][0]["content"] == "4"


async def test_pause_turn_is_continued_in_the_same_assistant_message(http):
    llm = FakeAnthropic([msg(text("Searching..."), stop="pause_turn"), msg(text("Done."))])
    history = [{"role": "user", "content": "news?"}]
    await collect(Agent(client=llm, model="m", tools=[]), history, ToolContext(http=http, store=MemoryStore()))
    assert [m["role"] for m in history] == ["user", "assistant"]
    assert len(history[1]["content"]) == 2


async def test_iteration_limit_stops_runaway_loops(http):
    looping = [msg(tool("calculator", {"expression": "1"}, id=f"t{i}"), stop="tool_use") for i in range(3)]
    agent = Agent(client=FakeAnthropic(looping), model="m", tools=[], max_iterations=3)
    events = await collect(agent, [{"role": "user", "content": "loop"}], ToolContext(http=http, store=MemoryStore()))
    assert events[-1]["stop_reason"] == "tool_use" and events[-1]["iterations"] == 3
    assert any("step limit" in e.get("delta", "") for e in events)


def test_window_never_starts_on_a_tool_result():
    history = [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": [{"type": "tool_use"}]},
        {"role": "user", "content": [{"type": "tool_result"}]},
        {"role": "assistant", "content": [{"type": "text", "text": "a1"}]},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": [{"type": "text", "text": "a2"}]},
    ]
    trimmed = window(history, 4)
    assert trimmed[0] == {"role": "user", "content": "q2"}
    assert window(history, 10) == history
