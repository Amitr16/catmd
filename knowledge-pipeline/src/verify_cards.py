"""Step 4: Verify draft cards by fact-checking against original sources.

Reads `data/cards_draft.jsonl`, runs a second LLM pass for each card with
the same source excerpts used in extraction, scores confidence, and emits
`data/cards_verified.jsonl` with confidence filled in.

Run:
    python -m src.verify_cards
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path

from pydantic import ValidationError
from rich.console import Console
from rich.progress import BarColumn, MofNCompleteColumn, Progress, TextColumn, TimeElapsedColumn
from rich.table import Table

from . import config
from .extract_cards import _excerpts_from_cache, _load_topic_sources, _sources_block
from .llm_client import complete_json
from .schemas import KnowledgeCard, Topic, VerificationReport
from .utils.jsonl import read_jsonl_list, write_jsonl

console = Console()

SYSTEM = (
    "You are an independent fact-checker for veterinary knowledge cards. "
    "You cite evidence strictly from the provided sources. "
    "You output valid JSON."
)


def load_prompt() -> str:
    return (config.PROMPTS / "verify_card.md").read_text(encoding="utf-8")


LLM_FALLBACK_URL_PREFIX = "internal://"


async def _verify_with_index(
    card: KnowledgeCard,
    topic_sources: dict[str, list[str]],
    *,
    sem: asyncio.Semaphore,
):
    """Wrapper that returns (draft_id, result) so the main loop can recover
    the original draft on verifier failure instead of dropping the topic.
    """
    result = await verify_one(card, topic_sources, sem=sem)
    return id(card), result


async def verify_one(
    card: KnowledgeCard,
    topic_sources: dict[str, list[str]],
    *,
    sem: asyncio.Semaphore,
) -> tuple[KnowledgeCard, VerificationReport] | None:
    # LLM-fallback cards have no external sources to verify against —
    # pass them through with their pre-assigned 0.55 confidence. They'll
    # be flagged for human review downstream.
    if any(str(s.url).startswith(LLM_FALLBACK_URL_PREFIX) for s in card.sources):
        report = VerificationReport(
            topic=card.topic,
            confidence=card.confidence,
            unsupported_claims=[],
            corrections=[],
            emergency_tags_assessment="appropriate",
            recommend_action="flag_for_review",
        )
        return card, report

    urls = topic_sources.get(card.topic, [])
    excerpts = _excerpts_from_cache(urls) if urls else []
    if not excerpts:
        return None

    user = load_prompt().format(
        topic=card.topic,
        card_json=card.model_dump_json(indent=2),
        sources_block=_sources_block(excerpts[:5]),
    )

    async with sem:
        try:
            resp = await complete_json(
                system=SYSTEM,
                user=user,
                temperature=0.0,   # verification wants determinism
                max_tokens=1500,
            )
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]verify LLM fail[/] {card.topic!r}: {e}")
            return None

    try:
        report = VerificationReport.model_validate(resp)
    except ValidationError as e:
        console.print(f"[yellow]invalid verifier response[/] {card.topic!r}: {e.errors()[0].get('msg')}")
        return None

    # Stamp confidence into the card
    card.confidence = report.confidence
    return card, report


async def run(
    draft_path: Path | None = None,
    out_path: Path | None = None,
) -> tuple[int, int, int]:
    draft_path = draft_path or config.CARDS_DRAFT_PATH
    out_path = out_path or config.CARDS_VERIFIED_PATH
    if not draft_path.exists():
        raise FileNotFoundError(f"{draft_path} missing — run step 3 first.")

    drafts = read_jsonl_list(draft_path, KnowledgeCard)
    topic_sources = _load_topic_sources()
    console.print(f"[bold]Step 4[/] — verifying {len(drafts)} cards via {config.LLM_MODEL}")

    sem = asyncio.Semaphore(6)
    verified: list[KnowledgeCard] = []
    flagged: list[KnowledgeCard] = []
    rejected: list[KnowledgeCard] = []
    action_counts: dict[str, int] = {"accept": 0, "flag_for_review": 0, "reject": 0}

    # Map draft index → draft card so we can still forward on verifier failure.
    # Per user directive: no topic silently dropped.
    drafts_by_idx = {id(c): c for c in drafts}

    tasks = [
        asyncio.create_task(_verify_with_index(c, topic_sources, sem=sem))
        for c in drafts
    ]
    with Progress(
        TextColumn("[cyan]verify[/]"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        console=console,
    ) as prog:
        task_id = prog.add_task("", total=len(tasks))
        for fut in asyncio.as_completed(tasks):
            draft_id, result = await fut
            prog.advance(task_id)
            if result is None:
                # Verifier failed — preserve the draft as flagged so we
                # don't drop a topic. Stamp a conservative confidence.
                draft = drafts_by_idx[draft_id]
                if draft.confidence == 0.0:
                    draft.confidence = 0.55
                flagged.append(draft)
                continue
            card, report = result
            action_counts[report.recommend_action] = (
                action_counts.get(report.recommend_action, 0) + 1
            )
            # No-drop policy: every card is either auto-accepted (trusted) or
            # flagged (surface in app with lower authority + needs review).
            # Nothing is silently removed from the corpus.
            is_llm_fallback = any(
                str(s.url).startswith(LLM_FALLBACK_URL_PREFIX) for s in card.sources
            )
            if (
                not is_llm_fallback
                and report.recommend_action == "accept"
                and card.confidence >= config.CONFIDENCE_ACCEPT
            ):
                verified.append(card)
            else:
                flagged.append(card)
                # Track "would-have-been-rejected" for reporting
                if report.recommend_action == "reject" or card.confidence < config.CONFIDENCE_FLAG:
                    rejected.append(card)

    # Write verified + flagged (both go forward — flagged reviewed in step 5)
    forward = verified + flagged
    n = write_jsonl(out_path, forward)

    table = Table(title="Verification results")
    table.add_column("Bucket")
    table.add_column("Count", justify="right")
    table.add_row("accepted (auto)", f"[green]{len(verified)}[/]")
    table.add_row("flagged for review", f"[yellow]{len(flagged)}[/]")
    table.add_row("rejected", f"[red]{len(rejected)}[/]")
    table.add_row("verifier failed", str(len(drafts) - sum(action_counts.values())))
    console.print(table)

    console.print(f"[bold green]->[/] Wrote {n} cards to {out_path}")
    return len(verified), len(flagged), len(rejected)


if __name__ == "__main__":
    asyncio.run(run())
