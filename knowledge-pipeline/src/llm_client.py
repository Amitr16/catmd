"""OpenAI client wrapper — retry, JSON-mode, token counting.

Keeps all LLM calls in one place so rate-limit, timeout, and cost-tracking
live in a single spot.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import tiktoken
from openai import AsyncOpenAI, RateLimitError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from . import config

_client: AsyncOpenAI | None = None
_encoder: tiktoken.Encoding | None = None


def client() -> AsyncOpenAI:
    global _client
    if _client is None:
        config.require_openai()
        _client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
    return _client


def encoder() -> tiktoken.Encoding:
    global _encoder
    if _encoder is None:
        # o200k_base covers gpt-4o / gpt-4o-mini / text-embedding-3-*
        _encoder = tiktoken.get_encoding("o200k_base")
    return _encoder


def count_tokens(text: str) -> int:
    return len(encoder().encode(text))


# ─── Retry-wrapped JSON completion ─────────────────────────────────────────
@retry(
    retry=retry_if_exception_type(RateLimitError),
    wait=wait_exponential(multiplier=2, min=4, max=60),
    stop=stop_after_attempt(6),
    reraise=True,
)
async def complete_json(
    *,
    system: str,
    user: str,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int | None = None,
    json_retry: bool = True,
) -> dict[str, Any]:
    """Call LLM with JSON-mode enabled. Returns parsed dict.

    On json.JSONDecodeError, retry ONCE with a corrective system message
    appended. This recovers the ~5% of LLM outputs that have trailing
    commas, unclosed strings, or embedded prose.
    """
    model = model or config.LLM_MODEL
    resp = await client().chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        response_format={"type": "json_object"},
        max_tokens=max_tokens,
    )
    content = resp.choices[0].message.content or "{}"
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        if not json_retry:
            raise
        # One corrective retry — tell the model the output was invalid JSON.
        resp2 = await client().chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
                {"role": "assistant", "content": content},
                {"role": "user", "content": (
                    f"The previous response was not valid JSON "
                    f"(parser error: {e.msg} at char {e.pos}). "
                    f"Return ONLY valid JSON matching the schema. No prose."
                )},
            ],
            temperature=0.0,  # deterministic on retry
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
        )
        content2 = resp2.choices[0].message.content or "{}"
        return json.loads(content2)  # let this raise if still bad


async def embed(text: str, *, model: str | None = None) -> list[float]:
    """Single-text embedding."""
    model = model or config.EMBED_MODEL
    resp = await client().embeddings.create(
        model=model,
        input=text,
        dimensions=config.EMBED_DIMS,
    )
    return resp.data[0].embedding


async def embed_batch(texts: list[str], *, model: str | None = None) -> list[list[float]]:
    """Batch embedding. OpenAI allows up to 2048 inputs per call; we chunk 100 to
    stay comfortably under rate limits.
    """
    model = model or config.EMBED_MODEL
    chunks: list[list[str]] = [texts[i:i + 100] for i in range(0, len(texts), 100)]
    out: list[list[float]] = []
    for chunk in chunks:
        resp = await client().embeddings.create(
            model=model,
            input=chunk,
            dimensions=config.EMBED_DIMS,
        )
        out.extend(d.embedding for d in resp.data)
        await asyncio.sleep(0.1)  # gentle pacing
    return out
