"""Step 3: Extract structured KnowledgeCard from sources via LLM.

Reads `data/topics.jsonl` + the per-URL cache from step 2, asks the LLM to
paraphrase the factual content into our structured schema, validates, and
writes `data/cards_draft.jsonl`.

Run:
    python -m src.extract_cards
"""
from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from pydantic import ValidationError
from rich.console import Console
from rich.progress import BarColumn, MofNCompleteColumn, Progress, TextColumn, TimeElapsedColumn

from . import config
from .llm_client import complete_json
from .schemas import KnowledgeCard, SourceExcerpt, Topic, TopicSources
from .utils import cache
from .utils.jsonl import read_jsonl_list, write_jsonl

console = Console()

SYSTEM = (
    "You are curating the CatMD feline veterinary knowledge corpus. "
    "You paraphrase facts in your own words — never reproduce verbatim. "
    "You output valid JSON conforming to the provided schema."
)

MIN_SOURCES = 1       # drop topics that returned no usable source in step 2
MAX_SOURCES = 5       # cap context size
EXCERPT_CHAR_BUDGET = 6000  # per source, to keep prompt under ~4K tokens total
MIN_CACHE_CHARS = 200  # match gather_sources MIN_CHARS


def load_prompt() -> str:
    return (config.PROMPTS / "extract_card.md").read_text(encoding="utf-8")


def _sources_block(excerpts: list[SourceExcerpt]) -> str:
    """Format source excerpts for prompt injection."""
    parts: list[str] = []
    for i, s in enumerate(excerpts, start=1):
        text = s.text[:EXCERPT_CHAR_BUDGET]
        parts.append(
            f"--- SOURCE {i} ---\n"
            f"URL: {s.url}\n"
            f"Title: {s.title}\n"
            f"Domain: {s.domain}\n"
            f"Fetched: {s.fetched_at.isoformat()}\n\n"
            f"{text}\n"
        )
    return "\n".join(parts)


def _load_topic_sources() -> dict[str, list[str]]:
    """Load topic -> URLs mapping emitted by step 2.

    Single read, shared across steps 3 + 4.
    """
    if not config.TOPIC_SOURCES_PATH.exists():
        raise FileNotFoundError(
            f"{config.TOPIC_SOURCES_PATH} missing — re-run step 2 first to emit the mapping."
        )
    return {
        ts.topic: ts.source_urls
        for ts in read_jsonl_list(config.TOPIC_SOURCES_PATH, TopicSources)
    }


def _excerpts_from_cache(urls: list[str]) -> list[SourceExcerpt]:
    """Hydrate SourceExcerpt list from the URL-keyed disk cache — zero network."""
    out: list[SourceExcerpt] = []
    for url in urls:
        cached = cache.load(url)
        if not cached or not cached.get("text"):
            continue
        text = cached["text"]
        if len(text) < MIN_CACHE_CHARS:
            continue
        out.append(
            SourceExcerpt(
                url=url,
                title=cached.get("title") or "",
                text=text,
                fetched_at=datetime.fromisoformat(cached["fetched_at"]),
                domain=urlparse(url).netloc,
                content_hash=hashlib.sha256(text.encode("utf-8")).hexdigest()[:16],
            )
        )
        if len(out) >= MAX_SOURCES:
            break
    return out


async def extract_one(
    topic: Topic,
    excerpts: list[SourceExcerpt],
    *,
    sem: asyncio.Semaphore,
) -> KnowledgeCard | None:
    if len(excerpts) < MIN_SOURCES:
        return None

    generated_at = datetime.now(timezone.utc).isoformat()
    user = load_prompt().format(
        topic=topic.topic,
        category=topic.category,
        priority=topic.priority,
        emergency_related=str(topic.emergency_related).lower(),
        generated_at=generated_at,
        sources_block=_sources_block(excerpts[:MAX_SOURCES]),
    )

    async with sem:
        try:
            resp = await complete_json(
                system=SYSTEM,
                user=user,
                temperature=0.2,
                max_tokens=3000,
            )
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]LLM fail[/] for {topic.topic!r}: {e}")
            return None

    # The LLM often returns card wrapped in a parent key — unwrap gracefully.
    card_data = resp
    if "topic" not in resp and len(resp) == 1:
        only_key = next(iter(resp))
        if isinstance(resp[only_key], dict):
            card_data = resp[only_key]

    try:
        return KnowledgeCard.model_validate(card_data)
    except ValidationError as e:
        console.print(
            f"[yellow]validation fail[/] for {topic.topic!r}: "
            f"{e.errors()[0].get('msg', 'unknown')}"
        )
        return None


async def run(
    topics_path: Path | None = None,
    out_path: Path | None = None,
) -> int:
    topics_path = topics_path or config.TOPICS_PATH
    out_path = out_path or config.CARDS_DRAFT_PATH
    if not topics_path.exists():
        raise FileNotFoundError(f"{topics_path} missing — run step 1 first.")

    topics = read_jsonl_list(topics_path, Topic)
    topic_sources = _load_topic_sources()
    console.print(f"[bold]Step 3[/] — extracting cards for {len(topics)} topics via {config.LLM_MODEL}")

    sem = asyncio.Semaphore(6)
    cards: list[KnowledgeCard] = []
    dropped = 0

    async def _one(t: Topic) -> KnowledgeCard | None:
        urls = topic_sources.get(t.topic, [])
        if not urls:
            return None
        excerpts = _excerpts_from_cache(urls)
        if not excerpts:
            return None
        return await extract_one(t, excerpts, sem=sem)

    tasks = [asyncio.create_task(_one(t)) for t in topics]
    with Progress(
        TextColumn("[cyan]extract[/]"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        console=console,
    ) as prog:
        task_id = prog.add_task("", total=len(tasks))
        for fut in asyncio.as_completed(tasks):
            result = await fut
            if result is None:
                dropped += 1
            else:
                cards.append(result)
            prog.advance(task_id)

    n = write_jsonl(out_path, cards)
    console.print(
        f"[bold green]OK[/] {n} draft cards written, {dropped} dropped "
        f"(no sources / validation failure). -> {out_path}"
    )
    return n


if __name__ == "__main__":
    asyncio.run(run())
