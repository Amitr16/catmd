"""Step 6: Embed final cards and upsert into Supabase pgvector.

Reads `data/cards_final.jsonl`, computes text-embedding-3-small (1536-dim)
vectors, and upserts into `public.knowledge_cards` via the service-role key.

Run:
    python -m src.embed_and_load
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from rich.console import Console
from rich.progress import BarColumn, MofNCompleteColumn, Progress, TextColumn, TimeElapsedColumn

from . import config
from .llm_client import embed_batch
from .schemas import KnowledgeCard
from .supabase_client import client
from .utils.jsonl import read_jsonl_list

console = Console()

BATCH = 50  # rows per upsert


def _embed_text(card: KnowledgeCard) -> str:
    """The fields we embed — tuned for retrieval relevance.

    Keep this STABLE — changing it requires full re-embedding.
    """
    b = card.body
    lines = [
        f"Topic: {card.topic}",
        f"Category: {card.category}",
        f"Symptoms: {', '.join(b.symptoms)}",
    ]
    if b.aliases:
        lines.append(f"Aliases: {', '.join(b.aliases)}")
    if b.emergency_threshold:
        lines.append(f"Emergency threshold: {b.emergency_threshold}")
    if b.differentials:
        lines.append(f"Differentials: {', '.join(b.differentials)}")
    lines.append(f"Cat-specific: {b.cat_specific_notes}")
    if b.breed_risks:
        lines.append(f"Breed risks: {', '.join(b.breed_risks)}")
    return "\n".join(lines)


async def run(cards_path: Path | None = None) -> int:
    cards_path = cards_path or config.CARDS_FINAL_PATH
    if not cards_path.exists():
        raise FileNotFoundError(f"{cards_path} missing — run step 5 first.")

    cards = read_jsonl_list(cards_path, KnowledgeCard)
    console.print(f"[bold]Step 6[/] — embedding + loading {len(cards)} cards "
                  f"via {config.EMBED_MODEL}")

    # Embed in one batch call (openai chunks internally)
    texts = [_embed_text(c) for c in cards]
    vectors = await embed_batch(texts)
    assert len(vectors) == len(cards)

    sb = client()
    rows: list[dict] = []
    for c, vec in zip(cards, vectors):
        rows.append({
            "topic": c.topic,
            "category": c.category,
            "body": json.loads(c.body.model_dump_json()),
            "sources": [json.loads(s.model_dump_json()) for s in c.sources],
            "embedding": vec,
            "emergency_tags": c.emergency_tags,
            "confidence": c.confidence,
            "generated_at": c.generated_at.isoformat(),
            "version": c.version,
        })

    with Progress(
        TextColumn("[cyan]upsert[/]"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        console=console,
    ) as prog:
        task_id = prog.add_task("", total=len(rows))
        for i in range(0, len(rows), BATCH):
            batch = rows[i : i + BATCH]
            sb.table("knowledge_cards").upsert(batch, on_conflict="topic").execute()
            prog.advance(task_id, advance=len(batch))

    console.print(f"[bold green]OK[/] upserted {len(rows)} cards into Supabase.")
    return len(rows)


if __name__ == "__main__":
    asyncio.run(run())
