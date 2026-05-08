"""Sanity checks on the final corpus — run before declaring pipeline done.

Checks from docs/knowledge-pipeline-spec.md §13:
  [ ] >=500 cards total
  [ ] every category has >=10 cards
  [ ] toxicology has >=30 substances
  [ ] average confidence >=0.85
  [ ] no duplicate topics
  [ ] every card has >=2 sources
  [ ] all sources fetched in last 90 days
"""
from __future__ import annotations

import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from rich.console import Console  # noqa: E402
from rich.table import Table  # noqa: E402

from src import config  # noqa: E402
from src.schemas import KnowledgeCard  # noqa: E402
from src.utils.jsonl import read_jsonl_list  # noqa: E402

console = Console()


def run() -> int:
    path = config.CARDS_FINAL_PATH
    if not path.exists():
        console.print(f"[red]{path} missing — run full pipeline first.[/]")
        return 1

    cards = read_jsonl_list(path, KnowledgeCard)
    checks: list[tuple[str, bool, str]] = []

    # 1. Total count
    checks.append(("Total cards >= 500", len(cards) >= 500, f"{len(cards)} cards"))

    # 2. Category coverage
    by_cat = Counter(c.category for c in cards)
    undercovered = [cat for cat in config.CATEGORIES if by_cat.get(cat, 0) < 10]
    checks.append(
        ("Every category >= 10 cards",
         not undercovered,
         "OK" if not undercovered else f"under: {', '.join(undercovered)}")
    )

    # 3. Toxicology coverage
    checks.append(
        ("Toxicology >= 30 substances",
         by_cat.get("toxicology", 0) >= 30,
         f"{by_cat.get('toxicology', 0)} substances")
    )

    # 4. Average confidence
    avg_conf = sum(c.confidence for c in cards) / len(cards) if cards else 0
    checks.append(
        ("Avg confidence >= 0.85",
         avg_conf >= 0.85,
         f"{avg_conf:.3f}")
    )

    # 5. Dedup
    topics = [c.topic.strip().lower() for c in cards]
    dupes = [t for t, n in Counter(topics).items() if n > 1]
    checks.append(
        ("No duplicate topics",
         not dupes,
         "OK" if not dupes else f"{len(dupes)} dupes")
    )

    # 6. Sources >= 2
    low_src = sum(1 for c in cards if len(c.sources) < 2)
    checks.append(
        ("Every card >= 2 sources",
         low_src == 0,
         f"{low_src} cards under 2 sources")
    )

    # 7. Sources fresh (<= 90 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    stale = sum(1 for c in cards for s in c.sources if s.fetched_at < cutoff)
    checks.append(
        ("Sources fetched <= 90 days ago",
         stale == 0,
         f"{stale} stale sources")
    )

    # Report
    table = Table(title="Corpus validation")
    table.add_column("Check")
    table.add_column("Result")
    table.add_column("Detail")
    failed = 0
    for name, ok, detail in checks:
        mark = "[green]PASS[/]" if ok else "[red]FAIL[/]"
        table.add_row(name, mark, detail)
        if not ok:
            failed += 1
    console.print(table)
    console.print(f"\n[bold]{len(checks) - failed}/{len(checks)} checks passed.[/]")

    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(run())
