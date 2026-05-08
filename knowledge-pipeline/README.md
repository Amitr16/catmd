# CatMD Knowledge Pipeline

Builds ~500–800 feline veterinary **knowledge cards** for CatMD's RAG corpus.
Legally clean: our paraphrased summaries + source URLs, not verbatim scraped text.

See [`../docs/knowledge-pipeline-spec.md`](../docs/knowledge-pipeline-spec.md)
for the full design + rationale.

---

## Setup (one-time)

You have Anaconda Python 3.11 — simplest path:

```bash
cd D:\apps\catmd\knowledge-pipeline

# Create a dedicated conda env (isolates from base)
conda create -n catmd-kb python=3.11 -y
conda activate catmd-kb

# Install deps
pip install -e .
pip install -e ".[dev]"   # pytest, ruff, etc.

# Secrets
cp .env.example .env
# edit .env → fill OPENAI_API_KEY at minimum
```

Alternative (no conda) using `uv`:

```bash
pip install uv
uv venv
.venv\Scripts\activate
uv pip install -e ".[dev]"
```

---

## Pipeline stages

| Step | Script | Needs | Output | Cost |
|---|---|---|---|---|
| 1. Enumerate topics | `python -m src.enumerate_topics` | OpenAI | `data/topics.jsonl` | ~$0.01 |
| 2. Gather sources | `python -m src.gather_sources` | Brave/Serper + OpenAI | `data/raw_sources/*.json` | ~$0 |
| 3. Extract cards | `python -m src.extract_cards` | OpenAI | `data/cards_draft.jsonl` | ~$1 |
| 4. Verify cards | `python -m src.verify_cards` | OpenAI | `data/cards_verified.jsonl` | ~$1 |
| 5. Spot-check (CLI) | `python -m src.spotcheck` | you | `data/cards_final.jsonl` | $0 |
| 6. Embed + load | `python -m src.embed_and_load` | Supabase + OpenAI | DB populated | ~$0.01 |

Run all at once:

```bash
python scripts/run_pipeline.py
```

Total wall-clock: **6–12 hours** (LLM rate-limit bound).
Total $$$: **~$5** end-to-end.

---

## Structure

```
knowledge-pipeline/
├── pyproject.toml
├── .env / .env.example
├── README.md
├── src/
│   ├── config.py           # env + paths + constants
│   ├── schemas.py          # Pydantic models (single source of truth)
│   ├── llm_client.py       # OpenAI wrapper (retry, JSON mode, embeddings)
│   ├── enumerate_topics.py # STEP 1 ✅
│   ├── gather_sources.py   # STEP 2 (next)
│   ├── extract_cards.py    # STEP 3
│   ├── verify_cards.py     # STEP 4
│   ├── spotcheck.py        # STEP 5
│   ├── embed_and_load.py   # STEP 6
│   └── utils/jsonl.py      # tiny JSONL io
├── prompts/
│   └── enumerate_topics.md # STEP 1 prompt
├── data/                   # gitignored outputs
├── scripts/                # orchestrators
└── tests/
```

---

## Design principles (non-negotiable)

1. **Facts, not expression.** Pipeline paraphrases public vet sources into
   our own structured schema; it never stores verbatim source text. Facts
   are not copyrightable, expression is.
2. **Every card cites sources.** At query-time the app surfaces these links.
3. **Cat-specific is the core value.** `cat_specific_notes` field is
   mandatory — it's the thing we know that generic LLMs don't.
4. **Confidence thresholds gate auto-accept.** Step 4 score ≥0.80 → accept,
   0.60–0.80 → human review, <0.60 → reject.
5. **Emergency tags are keyword triggers.** Layer 1 of the runtime guardrails
   fires on these; be conservative but don't overtag.
6. **Respect robots.txt and rate-limit.** 1 req/sec per domain baseline.

---

## Running Step 1 now

After `.env` is set with `OPENAI_API_KEY`:

```bash
python -m src.enumerate_topics
```

Expect: ~30 seconds, ~$0.01, ~600 topics in `data/topics.jsonl`.

Then inspect `data/topics.jsonl` and adjust `TARGET_TOPIC_COUNT` or the prompt
if coverage is uneven. Iterate here before moving to step 2.
