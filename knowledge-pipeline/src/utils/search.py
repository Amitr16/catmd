"""Search-provider abstraction — Brave / Serper / Google CSE behind one API.

Handles:
- global rate-limit (1 QPS for Brave free tier — enforced across all concurrent callers)
- retry with exponential backoff on 429 / transient errors
- unified SearchHit output shape
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

import httpx
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential_jitter,
)

from .. import config


@dataclass
class SearchHit:
    url: str
    title: str
    snippet: str


class SearchError(RuntimeError):
    pass


# ─── Global rate limiter — ensures ≤ MAX_QPS across ALL concurrent tasks ───
_SEARCH_LOCK = asyncio.Lock()
_LAST_CALL_AT: float = 0.0


def _provider_qps() -> float:
    # Brave free tier = 1 QPS. Serper/Google higher; default to 1 to be safe.
    return 1.0


async def _rate_limit() -> None:
    global _LAST_CALL_AT
    min_interval = 1.0 / _provider_qps()
    async with _SEARCH_LOCK:
        now = time.monotonic()
        wait = (_LAST_CALL_AT + min_interval) - now
        if wait > 0:
            await asyncio.sleep(wait)
        _LAST_CALL_AT = time.monotonic()


# ─── Retry policy — backoff on 429/5xx/transient ───────────────────────────
def _is_retriable(e: BaseException) -> bool:
    if isinstance(e, httpx.HTTPStatusError):
        return e.response.status_code in (429, 500, 502, 503, 504)
    if isinstance(e, (httpx.ConnectError, httpx.ReadError, httpx.ReadTimeout)):
        return True
    return False


_retry = retry(
    retry=retry_if_exception(_is_retriable),
    wait=wait_exponential_jitter(initial=2, max=30),
    stop=stop_after_attempt(5),
    reraise=True,
)


async def search(query: str, *, count: int = 8) -> list[SearchHit]:
    """Dispatch to the configured provider with global rate-limit + retry."""
    provider = config.SEARCH_PROVIDER.lower()
    if provider == "brave":
        return await _search_brave(query, count)
    if provider == "serper":
        return await _search_serper(query, count)
    if provider == "google":
        return await _search_google(query, count)
    raise SearchError(f"Unknown SEARCH_PROVIDER={provider!r}")


# ─── Brave Search (recommended — 2K free queries/month, 1 QPS) ─────────────
@_retry
async def _search_brave(query: str, count: int) -> list[SearchHit]:
    if not config.BRAVE_SEARCH_API_KEY:
        raise SearchError("BRAVE_SEARCH_API_KEY missing. Get one at https://brave.com/search/api/")
    await _rate_limit()
    async with httpx.AsyncClient(timeout=config.HTTP_TIMEOUT_S) as c:
        resp = await c.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": min(count, 20)},
            headers={
                "X-Subscription-Token": config.BRAVE_SEARCH_API_KEY,
                "Accept": "application/json",
            },
        )
        resp.raise_for_status()
    data = resp.json()
    web = data.get("web", {}).get("results", []) or []
    return [
        SearchHit(url=r["url"], title=r.get("title", ""), snippet=r.get("description", ""))
        for r in web
    ]


# ─── Serper.dev (Google results) ───────────────────────────────────────────
@_retry
async def _search_serper(query: str, count: int) -> list[SearchHit]:
    if not config.SERPER_API_KEY:
        raise SearchError("SERPER_API_KEY missing. Get one at https://serper.dev")
    await _rate_limit()
    async with httpx.AsyncClient(timeout=config.HTTP_TIMEOUT_S) as c:
        resp = await c.post(
            "https://google.serper.dev/search",
            json={"q": query, "num": count},
            headers={"X-API-KEY": config.SERPER_API_KEY, "Content-Type": "application/json"},
        )
        resp.raise_for_status()
    data = resp.json()
    organic = data.get("organic", []) or []
    return [
        SearchHit(url=r["link"], title=r.get("title", ""), snippet=r.get("snippet", ""))
        for r in organic
    ]


# ─── Google Custom Search (fallback — low quota) ───────────────────────────
@_retry
async def _search_google(query: str, count: int) -> list[SearchHit]:
    if not (config.GOOGLE_CSE_API_KEY and config.GOOGLE_CSE_CX):
        raise SearchError("GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX missing.")
    await _rate_limit()
    async with httpx.AsyncClient(timeout=config.HTTP_TIMEOUT_S) as c:
        resp = await c.get(
            "https://www.googleapis.com/customsearch/v1",
            params={
                "key": config.GOOGLE_CSE_API_KEY,
                "cx": config.GOOGLE_CSE_CX,
                "q": query,
                "num": min(count, 10),
            },
        )
        resp.raise_for_status()
    data = resp.json()
    items = data.get("items", []) or []
    return [
        SearchHit(url=r["link"], title=r.get("title", ""), snippet=r.get("snippet", ""))
        for r in items
    ]
