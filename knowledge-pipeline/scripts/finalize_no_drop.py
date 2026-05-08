"""Finalize without dropping any cards.

Per user directive: no topic may be silently dropped from the corpus.
This variant of finalize_auto accepts every verified card — even LLM-only
fallbacks and sub-threshold ones — but clearly marks them via confidence
and source URL. The app layer can filter by confidence at query time if
needed.

Run:
    python scripts/finalize_no_drop.py
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from rich.console import Console  # noqa: E402
from rich.table import Table  # noqa: E402

from src import config  # noqa: E402
from src.schemas import KnowledgeCard  # noqa: E402
from src.utils.jsonl import read_jsonl_list, write_jsonl  # noqa: E402

console = Console()

LLM_FALLBACK_PREFIX = "internal://"


def run() -> int:
    in_path = config.CARDS_VERIFIED_PATH
    out_path = config.CARDS_FINAL_PATH

    if not in_path.exists():
        console.print(f"[red]{in_path} missing — run steps 3+4 first.[/]")
        return 2

    verified = read_jsonl_list(in_path, KnowledgeCard)

    # Dedupe by topic (case-insensitive). If duplicates exist, prefer the
    # one with the higher confidence AND external source over LLM-fallback.
    def score(c: KnowledgeCard) -> tuple[int, float]:
        has_external = not all(
            str(s.url).startswith(LLM_FALLBACK_PREFIX) for s in c.sources
        )
        return (1 if has_external else 0, c.confidence)

    best: dict[str, KnowledgeCard] = {}
    for c in verified:
        key = c.topic.strip().lower()
        if key not in best or score(c) > score(best[key]):
            best[key] = c

    final = list(best.values())

    # Stats
    cat_counts = Counter(c.category for c in final)
    llm_fallback = sum(
        1 for c in final
        if all(str(s.url).startswith(LLM_FALLBACK_PREFIX) for s in c.sources)
    )
    low_conf = sum(1 for c in final if c.confidence < config.CONFIDENCE_ACCEPT)
    high_conf = len(final) - low_conf

    table = Table(title="Finalize (no-drop)")
    table.add_column("Bucket")
    table.add_column("Count", justify="right")
    table.add_row("Verified input", str(len(verified)))
    table.add_row("Deduped cards (final)", f"[green]{len(final)}[/]")
    table.add_row(
        f"  of which confidence >= {config.CONFIDENCE_ACCEPT}",
        f"[green]{high_conf}[/]",
    )
    table.add_row(
        f"  of which confidence <  {config.CONFIDENCE_ACCEPT} (needs human review)",
        f"[yellow]{low_conf}[/]",
    )
    table.add_row("  of which LLM-fallback (no external source)", f"[yellow]{llm_fallback}[/]")
    console.print(table)

    cat_table = Table(title="Category coverage (final)")
    cat_table.add_column("Category", style="cyan")
    cat_table.add_column("Count", justify="right")
    for cat in config.CATEGORIES:
        cat_table.add_row(cat, str(cat_counts.get(cat, 0)))
    console.print(cat_table)

    n = write_jsonl(out_path, final)
    console.print(f"[bold green]->[/] Wrote {n} cards to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(run())
