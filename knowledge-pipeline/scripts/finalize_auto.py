"""Auto-finalize: promote verified cards >= CONFIDENCE_ACCEPT to final.

Alternative to the interactive spotcheck CLI when you want to ship quickly
and do human review later. Filters cards_verified.jsonl by confidence and
writes cards_final.jsonl.

Run:
    python scripts/finalize_auto.py
    python scripts/finalize_auto.py --threshold 0.70    # override
"""
from __future__ import annotations

import argparse
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


def run(threshold: float | None = None) -> int:
    threshold = threshold if threshold is not None else config.CONFIDENCE_ACCEPT
    in_path = config.CARDS_VERIFIED_PATH
    out_path = config.CARDS_FINAL_PATH

    if not in_path.exists():
        console.print(f"[red]{in_path} missing — run step 4 first.[/]")
        return 2

    verified = read_jsonl_list(in_path, KnowledgeCard)
    accepted = [c for c in verified if c.confidence >= threshold]
    rejected = [c for c in verified if c.confidence < threshold]

    # Also require >=1 source
    accepted_with_sources = [c for c in accepted if len(c.sources) >= 1]
    dropped_no_sources = len(accepted) - len(accepted_with_sources)

    # Category distribution on accepted
    cat_counts = Counter(c.category for c in accepted_with_sources)

    table = Table(title=f"Auto-finalize (threshold >= {threshold:.2f})")
    table.add_column("Bucket")
    table.add_column("Count", justify="right")
    table.add_row("Verified input", str(len(verified)))
    table.add_row("Accepted", f"[green]{len(accepted_with_sources)}[/]")
    table.add_row("Rejected (low conf)", f"[yellow]{len(rejected)}[/]")
    table.add_row("Dropped (no sources)", str(dropped_no_sources))
    console.print(table)

    cat_table = Table(title="Category coverage (final)")
    cat_table.add_column("Category", style="cyan")
    cat_table.add_column("Count", justify="right")
    for cat in config.CATEGORIES:
        cat_table.add_row(cat, str(cat_counts.get(cat, 0)))
    console.print(cat_table)

    n = write_jsonl(out_path, accepted_with_sources)
    console.print(f"[bold green]->[/] Wrote {n} cards to {out_path}")
    return 0 if n > 0 else 3


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=float, default=None)
    args = parser.parse_args()
    sys.exit(run(args.threshold))
