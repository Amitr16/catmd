"""robots.txt compliance — fetched once per domain, cached in-process."""
from __future__ import annotations

import asyncio
from urllib.parse import urlparse

import httpx
from robotexclusionrulesparser import RobotExclusionRulesParser


class RobotsCache:
    """Fetches and caches robots.txt per domain. is_allowed() returns False
    only when we have a confirmed disallow — network errors default to allow
    so transient issues don't halt the pipeline.
    """

    USER_AGENT = "CatMD-Pipeline/0.1 (+https://catmd.pet/bot)"

    def __init__(self, timeout: float = 10.0) -> None:
        self._parsers: dict[str, RobotExclusionRulesParser | None] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._timeout = timeout

    async def _fetch(self, scheme: str, netloc: str) -> RobotExclusionRulesParser | None:
        url = f"{scheme}://{netloc}/robots.txt"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as c:
                resp = await c.get(url, headers={"User-Agent": self.USER_AGENT})
            if resp.status_code >= 400:
                return None  # default-allow on non-200
            p = RobotExclusionRulesParser()
            p.parse(resp.text)
            return p
        except Exception:
            return None  # default-allow on error

    async def is_allowed(self, url: str) -> bool:
        parsed = urlparse(url)
        if not parsed.netloc:
            return False
        key = parsed.netloc
        if key not in self._parsers:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            async with self._locks[key]:
                if key not in self._parsers:
                    self._parsers[key] = await self._fetch(parsed.scheme, parsed.netloc)
        parser = self._parsers[key]
        if parser is None:
            return True  # default allow
        return parser.is_allowed(self.USER_AGENT, url)
