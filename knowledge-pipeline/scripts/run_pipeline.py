"""Run the full CatMD knowledge pipeline: steps 1 -> 6.

Step 5 (spot-check CLI) is interactive — run it separately after step 4.

Usage:
    python scripts/run_pipeline.py              # runs all except step 5
    python scripts/run_pipeline.py --skip-2     # reuse existing raw_sources cache
    python scripts/run_pipeline.py --only 3     # re-run only step 3
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Make `src` importable when running as a script
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from src import enumerate_topics, extract_cards, gather_sources, verify_cards  # noqa: E402
from src.embed_and_load import run as step6_run  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip", type=str, default="",
                        help="Comma-separated step numbers to skip, e.g. 1,2")
    parser.add_argument("--only", type=str, default="",
                        help="Comma-separated step numbers to run, e.g. 3,4")
    parser.add_argument("--no-step6", action="store_true",
                        help="Skip Supabase upload (useful if DB isn't ready)")
    args = parser.parse_args()

    skip = {int(x) for x in args.skip.split(",") if x.strip()}
    only = {int(x) for x in args.only.split(",") if x.strip()}

    def should_run(n: int) -> bool:
        if only:
            return n in only
        return n not in skip

    if should_run(1):
        print("=" * 60, "\nSTEP 1 — enumerate topics\n", "=" * 60)
        await enumerate_topics.run()

    if should_run(2):
        print("=" * 60, "\nSTEP 2 — gather sources\n", "=" * 60)
        await gather_sources.run()

    if should_run(3):
        print("=" * 60, "\nSTEP 3 — extract draft cards\n", "=" * 60)
        await extract_cards.run()

    if should_run(4):
        print("=" * 60, "\nSTEP 4 — verify cards\n", "=" * 60)
        await verify_cards.run()

    print("\nSTEP 5 is interactive. Run:")
    print("  python -m src.spotcheck --sample-pct 5")
    print("to review flagged cards. After that:\n")

    if should_run(6) and not args.no_step6:
        print("=" * 60, "\nSTEP 6 — embed + load to Supabase\n", "=" * 60)
        await step6_run()
    else:
        print("STEP 6 skipped. Run later: python -m src.embed_and_load")


if __name__ == "__main__":
    asyncio.run(main())
