"""Typed settings loaded from environment variables (and backend/.env locally).

Every secret is a SecretStr so it never shows up in logs or reprs.
"""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"  # "production" on Railway

    # --- Anthropic ---
    anthropic_api_key: SecretStr = SecretStr("")
    anthropic_workspace_id: str | None = None
    model: str = "claude-sonnet-5"
    max_tokens: int = 1024
    max_iterations: int = 6
    enable_web_search: bool = True
    web_search_max_uses: int = 3

    # --- Supabase (optional: falls back to in-memory storage) ---
    supabase_url: str | None = None
    supabase_secret_key: SecretStr | None = None  # sb_secret_... or legacy service_role

    # --- Abuse & cost protection ---
    allowed_origins: str = "http://localhost:3000"
    turnstile_secret_key: SecretStr | None = None
    ip_hash_salt: SecretStr = Field(default_factory=lambda: SecretStr(secrets.token_hex(16)))
    rate_limit_per_minute: int = 8
    rate_limit_per_day: int = 60
    daily_budget_usd: float = 3.0
    max_message_chars: int = 1500
    max_turns_per_conversation: int = 30
    history_window_messages: int = 24

    # --- Answer cache ---
    cache_enabled: bool = True
    cache_ttl_hours: int = 168

    # --- Cost estimates (USD) - adjust to the model you use ---
    price_input_per_mtok: float = 3.0
    price_output_per_mtok: float = 15.0
    price_web_search_per_1k: float = 10.0

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_secret_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
