"""Supabase client singleton — service-role key, bypasses RLS.

Used ONLY from the pipeline (admin-side). The mobile app uses the anon key
at runtime with RLS enforcing per-user access.
"""
from __future__ import annotations

from supabase import Client, create_client

from . import config

_client: Client | None = None


def client() -> Client:
    global _client
    if _client is None:
        config.require_supabase()
        _client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    return _client
