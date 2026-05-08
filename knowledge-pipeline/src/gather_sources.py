"""Step 2: Source gathering.

For each topic in `data/topics.jsonl`:
  1. Search for authoritative sources via the configured search provider
  2. Re-rank so our AUTHORITATIVE_DOMAINS float to the top
  3. Fetch top-N URLs (respecting robots.txt + per-domain rate-limit)
  4. Extract main text with trafilatura
  5. Cache to `data/raw_sources/<hash>.json`

The raw HTML is NEVER persisted to Supabase. This cache is a pipeline
artifact only — downstream steps consume the extracted text.

Run:
    python -m src.gather_sources
"""
from __future__ import annotations

import asyncio
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
from rich.console import Console
from rich.progress import BarColumn, MofNCompleteColumn, Progress, TextColumn, TimeElapsedColumn
from tenacity import retry, stop_after_attempt, wait_exponential

from . import config
from .schemas import SourceExcerpt, Topic, TopicSources
from .utils import cache, html_extract
from .utils.rate_limit import DomainRateLimiter
from .utils.robots import RobotsCache
from .utils.search import SearchError, SearchHit, search
from .utils.jsonl import read_jsonl_list, write_jsonl

console = Console()

USER_AGENT = (
    "CatMD-Pipeline/0.1 (+https://catmd.pet/bot; feline-vet-knowledge-curation)"
)
MIN_CHARS = 200               # skip pages too short to be useful (was 400; lowered for ASPCA short entries etc.)
MAX_CHARS_PER_SOURCE = 8000   # cap downstream token cost


# ─── Authority re-ranker ───────────────────────────────────────────────────
def _authority_score(url: str) -> int:
    """Lower = more authoritative. Unknown domains sort last."""
    host = urlparse(url).netloc.lower()
    for i, domain in enumerate(config.AUTHORITATIVE_DOMAINS):
        if host == domain or host.endswith("." + domain):
            return i
    return 10_000


def rerank(hits: list[SearchHit]) -> list[SearchHit]:
    """Stable sort: authoritative domains first, then original rank preserved."""
    return sorted(hits, key=lambda h: (_authority_score(h.url),))


# ─── Polite fetcher ────────────────────────────────────────────────────────
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=1, max=20),
    reraise=False,
)
async def _fetch(
    url: str,
    *,
    client: httpx.AsyncClient,
    limiter: DomainRateLimiter,
    robots: RobotsCache,
) -> tuple[int, str] | None:
    if not await robots.is_allowed(url):
        return None
    domain = urlparse(url).netloc
    await limiter.acquire(domain)
    try:
        resp = await client.get(url, follow_redirects=True)
    except httpx.HTTPError as e:
        console.print(f"[yellow]fetch error {url}:[/] {e}")
        return None
    if resp.status_code >= 400:
        return None
    return resp.status_code, resp.text


def build_search_query(topic: Topic) -> str:
    """Build a Brave-friendly search query for this topic.

    Generic topics are quote-matched; toxicology needs a very different shape
    because topic names like "Sago Palm (Cycas revoluta) ingestion in cats"
    return zero quoted-phrase hits. We strip the Latin name and the
    "ingestion in cats" boilerplate and add toxicity/poisoning keywords.
    """
    t = topic.topic
    if topic.category == "toxicology":
        t = re.sub(r"\s*\([^)]+\)\s*", " ", t)                            # drop "(Lilium spp.)"
        t = re.sub(r"\s+ingestion\s+in\s+cats?\s*$", "", t, flags=re.I)   # drop tail
        t = t.strip().strip(",")
        return f"{t} cat toxicity poisoning"
    return f'"{topic.topic}" cat feline veterinary'


async def gather_for_topic(
    topic: Topic,
    *,
    client: httpx.AsyncClient,
    limiter: DomainRateLimiter,
    robots: RobotsCache,
    per_topic: int,
) -> list[SourceExcerpt]:
    query = build_search_query(topic)
    try:
        hits = await search(query, count=per_topic * 3)
    except SearchError as e:
        console.print(f"[red]search error[/] for {topic.topic!r}: {e}")
        return []
    except httpx.HTTPError as e:
        console.print(f"[red]search http error[/] for {topic.topic!r}: {e}")
        return []

    hits = rerank(hits)
    excerpts: list[SourceExcerpt] = []
    for hit in hits:
        if len(excerpts) >= per_topic:
            break

        # Cache hit short-circuit
        cached = cache.load(hit.url)
        if cached and cached.get("text"):
            text = cached["text"][:MAX_CHARS_PER_SOURCE]
            if len(text) >= MIN_CHARS:
                excerpts.append(
                    SourceExcerpt(
                        url=hit.url,
                        title=cached.get("title") or hit.title,
                        text=text,
                        fetched_at=datetime.fromisoformat(cached["fetched_at"]),
                        domain=urlparse(hit.url).netloc,
                        content_hash=hashlib.sha256(text.encode("utf-8")).hexdigest()[:16],
                    )
                )
            continue

        # Cold fetch
        result = await _fetch(hit.url, client=client, limiter=limiter, robots=robots)
        if result is None:
            continue
        status, html = result
        text, title = html_extract.extract_main_text(html, url=hit.url)
        if not text or len(text) < MIN_CHARS:
            continue
        text = text[:MAX_CHARS_PER_SOURCE]
        title = title or hit.title
        cache.save(hit.url, html=html, text=text, title=title, status=status)
        excerpts.append(
            SourceExcerpt(
                url=hit.url,
                title=title,
                text=text,
                fetched_at=datetime.now(timezone.utc),
                domain=urlparse(hit.url).netloc,
                content_hash=hashlib.sha256(text.encode("utf-8")).hexdigest()[:16],
            )
        )
    return excerpts


def _load_existing_mapping() -> dict[str, list[str]]:
    """Load prior topic_sources.jsonl if present — used by --fill-gaps."""
    if not config.TOPIC_SOURCES_PATH.exists():
        return {}
    return {
        ts.topic: ts.source_urls
        for ts in read_jsonl_list(config.TOPIC_SOURCES_PATH, TopicSources)
    }


# ─── Orchestration ─────────────────────────────────────────────────────────
async def run(
    topics_path: Path | None = None,
    *,
    fill_gaps: bool = False,
) -> dict[str, list[SourceExcerpt]]:
    """Gather sources for topics.

    fill_gaps=True → merge with existing topic_sources.jsonl, only re-gather
    topics that currently have 0 URLs. Preserves existing mappings. Saves
    search quota when you just want to fill the misses.
    """
    topics_path = topics_path or config.TOPICS_PATH
    if not topics_path.exists():
        raise FileNotFoundError(f"{topics_path} not found — run step 1 first.")
    all_topics = read_jsonl_list(topics_path, Topic)

    existing = _load_existing_mapping() if fill_gaps else {}
    if fill_gaps:
        topics = [t for t in all_topics if not existing.get(t.topic)]
        console.print(
            f"[bold]Step 2 (fill-gaps)[/] — re-gathering {len(topics)} "
            f"uncovered topics of {len(all_topics)} total. "
            f"Preserving {len(existing) - len(topics)} existing mappings."
        )
    else:
        topics = all_topics
        console.print(
            f"[bold]Step 2[/] — gathering sources for {len(topics)} topics "
            f"(provider: {config.SEARCH_PROVIDER}, rps/domain: {config.RATE_LIMIT_RPS})"
        )

    limiter = DomainRateLimiter(rps=config.RATE_LIMIT_RPS, burst=2)
    robots = RobotsCache()
    headers = {"User-Agent": USER_AGENT}

    results: dict[str, list[SourceExcerpt]] = {}
    # Bounded concurrency — we don't actually want to hit 600 topics in parallel.
    sem = asyncio.Semaphore(4)

    async with httpx.AsyncClient(timeout=config.HTTP_TIMEOUT_S, headers=headers) as client:
        async def _one(t: Topic) -> tuple[str, list[SourceExcerpt]]:
            async with sem:
                ex = await gather_for_topic(
                    t,
                    client=client,
                    limiter=limiter,
                    robots=robots,
                    per_topic=config.SOURCES_PER_TOPIC,
                )
                return t.topic, ex

        tasks = [asyncio.create_task(_one(t)) for t in topics]
        with Progress(
            TextColumn("[cyan]gather[/]"),
            BarColumn(),
            MofNCompleteColumn(),
            TimeElapsedColumn(),
            console=console,
        ) as prog:
            task_id = prog.add_task("", total=len(tasks))
            for fut in asyncio.as_completed(tasks):
                topic, ex = await fut
                results[topic] = ex
                prog.advance(task_id)

    total_ex = sum(len(v) for v in results.values())
    empty = sum(1 for v in results.values() if not v)
    console.print(
        f"[green]OK[/] {total_ex} excerpts gathered across {len(results)} topics. "
        f"{empty} topics returned no usable source."
    )

    # Emit topic -> URLs mapping so steps 3 + 4 skip re-searching.
    # In fill_gaps mode we preserve existing entries, overwriting only what
    # we re-gathered in this run.
    topic_to_category = {t.topic: t.category for t in all_topics}
    merged_urls: dict[str, list[str]] = dict(existing)  # empty if not fill_gaps
    for topic, excerpts in results.items():
        merged_urls[topic] = [str(e.url) for e in excerpts]

    mapping = [
        TopicSources(
            topic=topic,
            category=topic_to_category.get(topic, "gi"),
            source_urls=urls,
        )
        for topic, urls in merged_urls.items()
    ]
    n = write_jsonl(config.TOPIC_SOURCES_PATH, mapping)
    covered = sum(1 for m in mapping if m.source_urls)
    console.print(
        f"[bold green]->[/] Wrote topic-sources mapping: "
        f"{n} topics total, {covered} with sources. "
        f"{config.TOPIC_SOURCES_PATH}"
    )

    return results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--fill-gaps",
        action="store_true",
        help="Re-gather only topics with 0 sources in existing mapping. Saves search quota.",
    )
    args = parser.parse_args()
    asyncio.run(run(fill_gaps=args.fill_gaps))
