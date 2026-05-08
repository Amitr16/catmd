"""Simple disk cache for fetched HTML — skip re-fetching on pipeline re-runs.

Keyed by SHA256 of URL. Content stored as JSON with metadata.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .. import config


def _key(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]


def _path(url: str) -> Path:
    return config.RAW_SOURCES / f"{_key(url)}.json"


def load(url: str, *, max_age_days: int = 30) -> dict[str, Any] | None:
    p = _path(url)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        fetched = datetime.fromisoformat(data["fetched_at"])
        if datetime.now(timezone.utc) - fetched > timedelta(days=max_age_days):
            return None
        return data
    except (KeyError, ValueError, json.JSONDecodeError):
        return None


def save(url: str, *, html: str, text: str, title: str, status: int) -> None:
    p = _path(url)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(
        json.dumps({
            "url": url,
            "status": status,
            "title": title,
            "text": text,
            "html_len": len(html),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }, ensure_ascii=False),
        encoding="utf-8",
    )
