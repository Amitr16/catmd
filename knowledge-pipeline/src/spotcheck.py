"""Step 5: Human spot-check CLI.

Reviews a random 5% sample + all flagged cards. You approve/edit/reject
each. Final accepted set is written to `data/cards_final.jsonl`.

Keyboard shortcuts per card:
  a   accept
  r   reject
  s   skip (come back later)
  q   quit + save progress

Run:
    python -m src.spotcheck --sample-pct 5
"""
from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table

from . import config
from .schemas import KnowledgeCard
from .utils.jsonl import read_jsonl_list, write_jsonl

console = Console()


def pick_review_set(
    cards: list[KnowledgeCard],
    sample_pct: float,
) -> list[KnowledgeCard]:
    """Always include low-confidence cards + random sample of auto-accepted."""
    flagged = [c for c in cards if c.confidence < config.CONFIDENCE_ACCEPT]
    auto = [c for c in cards if c.confidence >= config.CONFIDENCE_ACCEPT]
    sample_size = max(1, int(len(auto) * sample_pct / 100))
    sample = random.sample(auto, min(sample_size, len(auto)))
    # Dedup while preserving order: flagged first, then random sample
    seen: set[str] = set()
    combined: list[KnowledgeCard] = []
    for c in flagged + sample:
        if c.topic in seen:
            continue
        seen.add(c.topic)
        combined.append(c)
    return combined


def render_card(card: KnowledgeCard) -> None:
    color = {
        "high": "green",
        "medium": "yellow",
        "low": "dim",
    }
    conf_color = "green" if card.confidence >= 0.8 else "yellow" if card.confidence >= 0.6 else "red"

    table = Table(show_header=False, box=None, padding=(0, 1))
    table.add_row("Topic", f"[bold]{card.topic}[/]")
    table.add_row("Category", card.category)
    table.add_row("Confidence", f"[{conf_color}]{card.confidence:.2f}[/]")
    table.add_row("Emergency tags", ", ".join(card.emergency_tags) or "[dim]none[/]")
    console.print(Panel(table, title="CARD", border_style="cyan"))

    b = card.body
    console.print(f"[bold]Symptoms:[/] {', '.join(b.symptoms) or '[dim]—[/]'}")
    if b.emergency_threshold:
        console.print(f"[bold]Emergency threshold:[/] {b.emergency_threshold}")
    if b.time_to_vet.urgent:
        console.print(f"[bold red]URGENT:[/] {b.time_to_vet.urgent}")
    if b.time_to_vet.concern:
        console.print(f"[bold yellow]CONCERN:[/] {b.time_to_vet.concern}")
    if b.breed_risks:
        console.print(f"[bold]Breed risks:[/] {', '.join(b.breed_risks)}")
    if b.age_risks:
        console.print(f"[bold]Age risks:[/] {b.age_risks}")
    if b.toxicology:
        console.print(Panel(
            f"substance: {b.toxicology.substance}\n"
            f"ld50_mg_per_kg: {b.toxicology.ld50_mg_per_kg}\n"
            f"min_toxic_dose: {b.toxicology.minimum_toxic_dose_mg_per_kg}\n"
            f"onset_hours: {b.toxicology.onset_hours}\n"
            f"mechanism: {b.toxicology.mechanism}",
            title="Toxicology",
            border_style="red",
        ))
    if b.differentials:
        console.print(f"[bold]Differentials:[/] {', '.join(b.differentials)}")
    console.print(Panel(b.cat_specific_notes, title="Cat-specific notes",
                        border_style="magenta"))
    console.print("[bold]Sources:[/]")
    for s in card.sources:
        console.print(f"  - {s.title}")
        console.print(f"    [dim]{s.url}[/]")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample-pct", type=float, default=5.0)
    parser.add_argument("--in", dest="in_path", type=Path, default=config.CARDS_VERIFIED_PATH)
    parser.add_argument("--out", type=Path, default=config.CARDS_FINAL_PATH)
    args = parser.parse_args()

    if not args.in_path.exists():
        console.print(f"[red]{args.in_path} missing — run step 4 first.[/]")
        sys.exit(1)

    all_cards = read_jsonl_list(args.in_path, KnowledgeCard)
    to_review = pick_review_set(all_cards, args.sample_pct)
    review_topics = {c.topic for c in to_review}

    console.print(
        f"[bold]Step 5 spot-check[/] — {len(to_review)} cards to review "
        f"({len([c for c in to_review if c.confidence < config.CONFIDENCE_ACCEPT])} flagged, "
        f"rest random sample at {args.sample_pct}%).\n"
        "Keys: [bold]a[/]ccept [bold]r[/]eject [bold]s[/]kip [bold]q[/]uit"
    )

    decisions: dict[str, str] = {}  # topic -> accept/reject/skip
    try:
        for i, card in enumerate(to_review, start=1):
            console.rule(f"[bold]Card {i}/{len(to_review)}")
            render_card(card)
            choice = Prompt.ask(
                "[bold cyan]Decision[/]",
                choices=["a", "r", "s", "q"],
                default="a",
            )
            if choice == "q":
                break
            decisions[card.topic] = {
                "a": "accept", "r": "reject", "s": "skip"
            }[choice]
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted — saving progress…[/]")

    # Final set: every non-reviewed card is auto-accepted; reviewed ones follow decision
    final: list[KnowledgeCard] = []
    for c in all_cards:
        if c.topic in review_topics:
            d = decisions.get(c.topic, "skip")
            if d == "accept":
                final.append(c)
            # skip: exclude to be safe; reject: exclude
        else:
            # Only keep auto-accepts (>= threshold)
            if c.confidence >= config.CONFIDENCE_ACCEPT:
                final.append(c)

    n = write_jsonl(args.out, final)
    console.print(
        f"[bold green]OK[/] {n} cards accepted into {args.out} "
        f"(reviewed={len(decisions)}, auto-accepted={n - sum(1 for d in decisions.values() if d == 'accept')})"
    )


if __name__ == "__main__":
    main()
