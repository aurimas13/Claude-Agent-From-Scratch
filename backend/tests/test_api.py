from fastapi.testclient import TestClient

from app.security import RateLimiter, hash_ip
from tests.conftest import make_app, msg, parse_sse, text, tool


def ask(client, message, conversation_id=None, **extra):
    body = {"message": message, **extra}
    if conversation_id:
        body["conversation_id"] = conversation_id
    return client.post("/api/chat", json=body)


def test_chat_streams_steps_and_remembers_context():
    app = make_app(
        [
            msg(text("Let me calculate."), tool("calculator", {"expression": "50000*1.07**5"}), stop="tool_use"),
            msg(text("You'd have **70127.59**.")),
            msg(text("For 10 years it's **98357.57**.")),
        ]
    )
    with TestClient(app) as client:
        r1 = ask(client, "My budget is $50,000. 7% for 5 years?")
        assert r1.status_code == 200 and r1.headers["content-type"].startswith("text/event-stream")
        events = parse_sse(r1.text)
        assert events[0]["type"] == "meta"
        cid = events[0]["conversation_id"]
        assert [e["type"] for e in events if e["type"] in ("tool_call", "tool_result")] == ["tool_call", "tool_result"]
        assert events[-1]["type"] == "done" and events[-1]["cached"] is False

        r2 = ask(client, "Now 10 years", conversation_id=cid)
        assert parse_sse(r2.text)[-1]["type"] == "done"
        # memory: the 2nd model call saw the whole first exchange
        sent = app.state.llm.messages.calls[-1]["messages"]
        assert sent[0]["content"].startswith("My budget") and sent[-1]["content"] == "Now 10 years"

        convo = client.get(f"/api/conversations/{cid}").json()
        assert len(convo["turns"]) == 2
        assert any(step["type"] == "tool_call" for step in convo["turns"][0]["trace"])
        assert app.state.store.usage[0]["input_tokens"] == 200


def test_repeat_question_is_served_from_cache_without_calling_claude():
    app = make_app(
        [
            msg(text("Calculating."), tool("calculator", {"expression": "15/100*240"}), stop="tool_use"),
            msg(text("**36**")),
        ]
    )
    with TestClient(app) as client:
        ask(client, "What is 15% of 240?")
        second = parse_sse(ask(client, "what is 15% of 240").text)
        assert second[-1]["cached"] is True
        assert "36" in "".join(e.get("delta", "") for e in second)
        assert len(app.state.llm.messages.calls) == 2  # no third call
        assert client.get("/api/stats").json() == {"questions_today": 2, "answered_from_cache": 1}


def test_weather_answers_are_never_cached():
    script = [
        msg(tool("get_weather", {"location": "Paris"}), stop="tool_use"),
        msg(text("17°C in Paris.")),
    ]
    app = make_app(script * 2)
    with TestClient(app) as client:
        ask(client, "Weather in Paris?")
        second = parse_sse(ask(client, "Weather in Paris?").text)
        assert second[-1]["cached"] is False
        assert len(app.state.llm.messages.calls) == 4


def test_input_validation_and_unknown_conversation():
    app = make_app([], max_message_chars=20)
    with TestClient(app) as client:
        assert ask(client, "x" * 21).status_code == 400
        assert ask(client, "   ").status_code == 400
        assert ask(client, "hi", conversation_id="00000000-0000-4000-8000-000000000000").status_code == 404
        assert ask(client, "hi", conversation_id="not-a-uuid").status_code == 422
        assert client.get("/api/conversations/00000000-0000-4000-8000-000000000000").status_code == 404


def test_rate_limit_returns_429():
    app = make_app([msg(text("ok"))] * 5, rate_limit_per_minute=2)
    with TestClient(app) as client:
        assert ask(client, "a").status_code == 200
        assert ask(client, "b").status_code == 200
        blocked = ask(client, "c")
        assert blocked.status_code == 429 and "Retry-After" in blocked.headers


def test_turnstile_is_required_for_new_conversations_when_configured():
    app = make_app([msg(text("ok"))], turnstile_secret_key="secret")
    with TestClient(app) as client:
        assert ask(client, "hi").status_code == 403
        assert ask(client, "hi", turnstile_token="bad-token").status_code == 403
        assert ask(client, "hi", turnstile_token="good-token").status_code == 200


def test_daily_budget_cap_blocks_requests():
    app = make_app([], daily_budget_usd=0.0)
    with TestClient(app) as client:
        assert ask(client, "hi").status_code == 503


def test_security_headers_and_cors():
    app = make_app([], allowed_origins="https://agent.aurimas.io")
    with TestClient(app) as client:
        r = client.get("/api/health", headers={"Origin": "https://agent.aurimas.io"})
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["access-control-allow-origin"] == "https://agent.aurimas.io"
        evil = client.get("/api/health", headers={"Origin": "https://evil.example"})
        assert "access-control-allow-origin" not in evil.headers


def test_ip_hash_and_limiter_units():
    assert hash_ip("1.2.3.4", "s") == hash_ip("1.2.3.4", "s") != hash_ip("1.2.3.4", "t")
    limiter = RateLimiter(per_minute=1, per_day=10)
    assert limiter.check("k") is None
    assert limiter.check("k") > 0
