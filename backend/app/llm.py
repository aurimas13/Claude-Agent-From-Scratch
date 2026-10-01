"""Anthropic client factory (Step 1 of the guide: connect to Claude)."""

from __future__ import annotations

import anthropic

from .config import Settings


def build_anthropic(settings: Settings) -> anthropic.AsyncAnthropic:
    headers = {}
    if settings.anthropic_workspace_id:
        headers["anthropic-workspace-id"] = settings.anthropic_workspace_id
    return anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key.get_secret_value(), default_headers=headers, max_retries=2
    )
