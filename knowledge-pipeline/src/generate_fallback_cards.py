"""Fallback card generator for topics with no usable external source.

For each topic in `topics.jsonl` that has NO entry (or an empty one) in the
existing cards_draft.jsonl, ask the LLM to generate a card from its
training data alone. Cards are marked with source
`internal://llm-training-data` and confidence 0.55 so the app can surface
them with reduced authority + clear badging.

Appends to cards_draft.jsonl (not overwrite), so it runs AFTER Step 3.

Run:
    python -m src.generate_fallback_cards
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path

from pydantic import ValidationError
from rich.console import Console
from rich.progress import BarColumn, MofNCompleteColumn, Progress, TextColumn, TimeElapsedColumn

from . import config
from .llm_client import complete_json
from .schemas import KnowledgeCard, Topic
from .utils.jsonl import read_jsonl_list, write_jsonl

console = Console()

SYSTEM = (
    "You are a feline veterinary expert generating a structured knowledge "
    "card from training-data knowledge alone. You output ONLY valid JSON "
    "matching the provided schema. Be conservative — if unsure, leave fields null."
)

LLM_SOURCE_URL = "internal://llm-training-data"


def load_prompt() -> str:
    return (config.PROMPTS / "generate_card_from_training.md").read_text(encoding="utf-8")


async def generate_one(
    topic: Topic,
    *,
    sem: asyncio.Semaphore,
) -> KnowledgeCard | None:
    generated_at = datetime.now(timezone.utc).isoformat()
    user = load_prompt().format(
        topic=topic.topic,
        category=topic.category,
        priority=topic.priority,
        emergency_related=str(topic.emergency_related).lower(),
        generated_at=generated_at,
    )
    async with sem:
        try:
            resp = await complete_json(
                system=SYSTEM,
                user=user,
                temperature=0.2,
                max_tokens=2500,
            )
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]LLM fail[/] for {topic.topic!r}: {e}")
            return None

    # Unwrap if wrapped in a single key
    card_data = resp
    if "topic" not in resp and len(resp) == 1:
        only_key = next(iter(resp))
        if isinstance(resp[only_key], dict):
            card_data = resp[only_key]

    try:
        card = KnowledgeCard.model_validate(card_data)
    except ValidationError as e:
        console.print(f"[yellow]validation fail[/] {topic.topic!r}: {e.errors()[0].get('msg')}")
        return None

    # Enforce the fallback contract — no matter what LLM wrote.
    card.confidence = 0.55
    if not card.sources or str(card.sources[0].url) != LLM_SOURCE_URL:
        from .schemas import Source
        card.sources = [Source(
            url=LLM_SOURCE_URL,
            title="AI model training data (no external source)",
            fetched_at=datetime.now(timezone.utc),
            license=None,
        )]
    return card


async def run(
    topics_path: Path | None = None,
    drafts_path: Path | None = None,
) -> int:
    topics_path = topics_path or config.TOPICS_PATH
    drafts_path = drafts_path or config.CARDS_DRAFT_PATH

    topics = read_jsonl_list(topics_path, Topic)
    existing_drafts = read_jsonl_list(drafts_path, KnowledgeCard) if drafts_path.exists() else []
    covered = {d.topic.strip().lower() for d in existing_drafts}
    missing_topics = [t for t in topics if t.topic.strip().lower() not in covered]

    console.print(
        f"[bold]Step 3.5 (LLM fallback)[/] — generating cards for "
        f"{len(missing_topics)} uncovered topics of {len(topics)} total "
        f"(already covered: {len(covered)})"
    )

    if not missing_topics:
        console.print("[green]No gaps to fill.[/]")
        return 0

    sem = asyncio.Semaphore(6)
    new_cards: list[KnowledgeCard] = []
    failed = 0

    tasks = [asyncio.create_task(generate_one(t, sem=sem)) for t in missing_topics]
    with Progress(
        TextColumn("[cyan]llm-fallback[/]"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        console=console,
    ) as prog:
        task_id = prog.add_task("", total=len(tasks))
        for fut in asyncio.as_completed(tasks):
            c = await fut
            if c is None:
                failed += 1
            else:
                new_cards.append(c)
            prog.advance(task_id)

    # Append to drafts (preserve existing)
    all_drafts = existing_drafts + new_cards
    n = write_jsonl(drafts_path, all_drafts)

    console.print(
        f"[bold green]OK[/] generated {len(new_cards)} fallback cards, "
        f"{failed} failed. Total drafts: {n}. -> {drafts_path}"
    )
    return len(new_cards)


if __name__ == "__main__":
    asyncio.run(run())
