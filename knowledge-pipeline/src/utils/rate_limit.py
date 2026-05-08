"""Async token-bucket rate limiter — one bucket per domain.

Ensures we don't hammer any single site. Used by gather_sources.
"""
from __future__ import annotations

import asyncio
import time
from collections import defaultdict


class DomainRateLimiter:
    """Token bucket per hostname. Blocks until a token is available."""

    def __init__(self, rps: float = 1.0, burst: int = 2) -> None:
        self._rps = rps
        self._burst = burst
        self._buckets: dict[str, tuple[float, float]] = defaultdict(
            lambda: (float(burst), time.monotonic())
        )
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def acquire(self, domain: str) -> None:
        async with self._locks[domain]:
            tokens, last = self._buckets[domain]
            now = time.monotonic()
            # Refill
            tokens = min(float(self._burst), tokens + (now - last) * self._rps)
            if tokens < 1.0:
                wait = (1.0 - tokens) / self._rps
                await asyncio.sleep(wait)
                tokens = 1.0
                now = time.monotonic()
            tokens -= 1.0
            self._buckets[domain] = (tokens, now)
