"""Answer cache: the same first question with no time-sensitive tools gets answered from the DB.

"What is 15% of 240?" never changes, so asking Claude twice wastes money and time.
"What's the weather in Paris?" does change, so it is never cached.
"""

from __future__ import annotations

import hashlib
import re

from .tools import TIME_SENSITIVE_TOOLS


def normalize(question: str) -> str:
    q = question.lower().strip()
    q = re.sub(r"\s+", " ", q)
    return q.rstrip(" ?!.")


def cache_key(question: str, model: str, prompt_version: str) -> str:
    raw = f"{prompt_version}|{model}|{normalize(question)}"
    return hashlib.sha256(raw.encode()).hexdigest()


def is_cacheable(tools_used: set[str], stop_reason: str) -> bool:
    return stop_reason == "end_turn" and not (tools_used & TIME_SENSITIVE_TOOLS)
