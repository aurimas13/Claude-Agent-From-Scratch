from __future__ import annotations

import logging

from ..config import Settings
from .base import Store
from .memory import MemoryStore
from .supabase import SupabaseStore

log = logging.getLogger(__name__)

__all__ = ["MemoryStore", "Store", "SupabaseStore", "build_store"]


def build_store(settings: Settings) -> Store:
    if settings.supabase_enabled:
        log.info("storage: Supabase")
        return SupabaseStore(settings.supabase_url, settings.supabase_secret_key.get_secret_value())
    log.warning("storage: in-memory (set SUPABASE_URL + SUPABASE_SECRET_KEY to persist)")
    return MemoryStore()
