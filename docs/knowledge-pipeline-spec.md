# CatMD Knowledge Pipeline Spec

**Goal:** automated pipeline to build ~500–800 high-quality feline medical knowledge cards, legally clean (our paraphrase + source URLs, not verbatim scraped text), stored in Supabase pgvector, ready for RAG.

**Language:** Python 3.11+ (Anaconda env already available on user's machine)
**Location:** `D:\apps\catmd\knowledge-pipeline\`
**Run cadence:** once for v1, quarterly thereafter.
**Total cost per run:** ~$5 (gpt-4o-mini, ~3M tokens).

---

## 1. Pipeline Stages (6 steps)

```
┌────────────────────────────────────────────────────────────┐
│ STEP 1: Topic enumeration                                  │
│   • LLM brainstorm comprehensive feline topic taxonomy     │
│   • Categories: derm / ophth / respiratory / GI / urinary /│
│     neuro / endocrine / oncology / behavioral / toxicology /│
│     breed-specific / pediatric / geriatric / emergency     │
│   • ~500–800 topics output as topics.jsonl                 │
└────────────────────┬───────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────┐
│ STEP 2: Source gathering                                   │
│   • For each topic, fetch 3–5 authoritative URLs:          │
│     - Merck Vet Manual online (feline sections)            │
│     - Cornell Feline Health Center                         │
│     - ASPCA Poison Control list                            │
│     - ICatCare public pages                                │
│     - AAFP consumer handouts                               │
│     - PMC open-access feline articles (CC-BY only)         │
│   • Respect robots.txt, rate-limit 1 req/sec               │
│   • Store raw HTML in cache/ (not persisted to DB)         │
└────────────────────┬───────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────┐
│ STEP 3: Structured extraction (LLM)                        │
│   • gpt-4o-mini extracts facts into Knowledge Card schema  │
│   • Output = OUR paraphrase, NOT verbatim text             │
│   • Sources listed as URLs + titles (attribution)          │
│   • JSON Schema validation                                 │
└────────────────────┬───────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────┐
│ STEP 4: Verification (second LLM pass)                     │
│   • Fact-check: "Do the cited sources support each claim?" │
│   • LLM fetches source URL, confirms each assertion        │
│   • Cards with <0.8 confidence → flagged for human review  │
│   • Output: cards_verified.jsonl                           │
└────────────────────┬───────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────┐
│ STEP 5: Human spot-check (5% sample)                       │
│   • Random sample reviewed manually (25–40 cards)          │
│   • Use simple CLI tool: print card → accept/reject/edit   │
│   • Flag systematic errors → refine step-3 prompt → re-run │
└────────────────────┬───────────────────────────────────────┘
                     ▼
┌────────────────────────────────────────────────────────────┐
│ STEP 6: Embed + load into Supabase                         │
│   • text-embedding-3-small (1536 dims)                     │
│   • Embed serialized JSON (topic + body + cat-notes)       │
│   • Batch upsert to knowledge_cards table via pgvector     │
│   • Build indexes (ivfflat cosine, emergency_tags gin)     │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Folder Structure

```
D:\apps\catmd\knowledge-pipeline\
├── pyproject.toml               # uv/pip deps
├── .env                         # OPENAI_API_KEY, SUPABASE_*
├── .env.example
├── README.md
├── src/
│   ├── __init__.py
│   ├── config.py                # env loading, paths, constants
│   ├── schemas.py               # Pydantic models (Topic, KnowledgeCard, Source)
│   ├── enumerate_topics.py      # STEP 1
│   ├── gather_sources.py        # STEP 2 (httpx + trafilatura + robots)
│   ├── extract_cards.py         # STEP 3 (LLM extraction)
│   ├── verify_cards.py          # STEP 4 (fact-check pass)
│   ├── spotcheck.py             # STEP 5 (CLI review tool)
│   ├── embed_and_load.py        # STEP 6 (Supabase upsert)
│   ├── llm_client.py            # OpenAI client with retry/backoff
│   ├── supabase_client.py       # Supabase SDK wrapper
│   └── utils/
│       ├── html_extract.py      # trafilatura wrapper
│       ├── rate_limit.py        # token bucket
│       └── cache.py             # disk cache for fetched HTML
├── data/
│   ├── topics.jsonl             # output of step 1
│   ├── raw_sources/             # cached HTML (gitignored)
│   ├── cards_draft.jsonl        # output of step 3
│   ├── cards_verified.jsonl     # output of step 4
│   └── cards_final.jsonl        # after spotcheck
├── prompts/
│   ├── enumerate_topics.md
│   ├── extract_card.md
│   └── verify_card.md
├── scripts/
│   ├── run_pipeline.py          # orchestrator: runs all 6 steps
│   ├── validate_corpus.py       # sanity checks on DB state
│   └── dump_emergencies.py      # emergency-tag audit
└── tests/
    ├── test_schemas.py
    ├── test_extract.py
    └── fixtures/
```

---

## 3. Python Dependencies (`pyproject.toml`)

```toml
[project]
name = "catmd-knowledge-pipeline"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "openai>=1.40",
  "supabase>=2.10",
  "httpx>=0.27",
  "trafilatura>=1.12",         # clean HTML → text
  "pydantic>=2.9",
  "python-dotenv>=1.0",
  "tenacity>=9.0",             # retry with backoff
  "rich>=13.9",                # CLI pretty-print for spotcheck
  "tiktoken>=0.8",             # token counting
  "robotexclusionrulesparser", # robots.txt compliance
  "pypdf>=5.0",                # for vet PDF chunking (also reused in app flow)
]

[project.optional-dependencies]
dev = ["pytest>=8.3", "pytest-asyncio>=0.24", "ruff>=0.6"]
```

---

## 4. Knowledge Card Schema (Pydantic)

```python
# src/schemas.py
from pydantic import BaseModel, Field, HttpUrl
from typing import Literal, Optional
from datetime import datetime

Category = Literal[
    'derm','ophth','respiratory','gi','urinary','neuro','endocrine',
    'oncology','behavioral','toxicology','breed','pediatric','geriatric',
    'emergency','dental','musculoskeletal','reproductive','infectious',
]

UrgencyTier = Literal['routine','monitor','concern','urgent']

class Source(BaseModel):
    url: HttpUrl
    title: str
    fetched_at: datetime
    license: Optional[str] = None

class TimeToVet(BaseModel):
    urgent: Optional[str] = None
    concern: Optional[str] = None
    monitor: Optional[str] = None
    routine: Optional[str] = None

class KnowledgeCardBody(BaseModel):
    topic: str
    aliases: list[str] = []
    symptoms: list[str]
    emergency_threshold: Optional[str] = None
    time_to_vet: TimeToVet
    breed_risks: list[str] = []
    age_risks: Optional[str] = None   # "kitten" | "adult" | "senior" | free text
    toxicology: Optional[dict] = None  # for toxic substances
    differentials: list[str] = []
    cat_specific_notes: str            # THE key field — why cats differ
    related_topics: list[str] = []

class KnowledgeCard(BaseModel):
    topic: str
    category: Category
    body: KnowledgeCardBody
    sources: list[Source] = Field(min_length=1)
    emergency_tags: list[str] = []     # for Layer-1 keyword matching
    confidence: float = Field(ge=0, le=1)
    generated_at: datetime
    version: int = 1
```

---

## 5. Step 1: Topic Enumeration

**Prompt (`prompts/enumerate_topics.md`):**
```
You are a feline veterinary curriculum designer. Generate a comprehensive,
deduplicated list of topics a cat-parent triage AI must know.

Requirements:
- Target 500–800 topics total
- Cover all categories: {CATEGORIES}
- Each topic = ONE condition, symptom complex, or toxic substance
- NOT too broad ("illness") or too narrow ("inflammation of left ureter")
- Include: common conditions (80%), rare-but-critical emergencies (15%),
  breed-specific risks (5%)
- For toxicology: list each substance separately (lily, chocolate, xylitol,
  lilium, onion, garlic, grapes, raisins, paracetamol, ibuprofen, ...)
- For emergencies: urinary obstruction, respiratory distress, seizure,
  trauma, heatstroke, hypothermia, poisoning, GDV-equivalent, ...

Output JSONL, one topic per line:
{"topic": "Feline Lower Urinary Tract Disease", "category": "urinary",
 "priority": "high", "emergency_related": true}

Generate now:
```

Cost: 1 LLM call, ~20K tokens output → **$0.01**.

---

## 6. Step 2: Source Gathering

Per topic, fetch 3–5 authoritative URLs. Primary source sets:

```python
AUTHORITATIVE_DOMAINS = [
    'msdvetmanual.com',           # Merck Vet Manual (feline sections)
    'vet.cornell.edu',            # Cornell Feline Health Center
    'icatcare.org',               # ICatCare / ISFM public
    'aspca.org',                  # ASPCA Poison Control
    'catvets.com',                # AAFP
    'avma.org',                   # American Veterinary Medical Assoc
    'pubmed.ncbi.nlm.nih.gov',    # PMC open-access
    'ncbi.nlm.nih.gov/pmc',
    'vcahospitals.com',           # VCA pet guides
    'petmd.com',                  # reputable consumer vet
]
```

**For each topic:**
1. Google-search-API (or brave/serper) query: `"{topic}" cat feline site:<domain>` across authoritative domains
2. Fetch top-5 results, respecting robots.txt
3. Extract main content via trafilatura
4. Cache to `data/raw_sources/{topic_slug}.json` (not committed)
5. Rate-limit: 1 request/sec per domain, token bucket

**Legal/ethical:**
- Never store raw HTML in DB
- Never redistribute raw text
- ONLY use content as LLM context for step 3 → produces OUR summary
- Record `fetched_at` and `license` (where declared) in Source

Cost: $0 (uses free APIs + 1-2K fetches).

---

## 7. Step 3: Extract Cards

**Prompt (`prompts/extract_card.md`):**
```
You are curating a structured knowledge card for CatMD, a cat-parent triage app.

INPUT:
- topic: {topic}
- category: {category}
- sources: {source_excerpts}  <!-- raw text from step 2 -->

TASK:
Extract factual information and write OUR OWN neutral summary. You are
paraphrasing facts into the schema below — do NOT reproduce source text
verbatim. Facts are not copyrightable; expression is. Write in YOUR voice.

CRITICAL RULES:
- Only include facts you can support from AT LEAST ONE provided source.
- If sources disagree, note it in cat_specific_notes.
- For toxicology: include ld50 if available, minimum_toxic_dose, symptoms.
- cat_specific_notes MUST explain how cats differ from dogs/humans when
  relevant. This is the highest-value field.
- For breed_risks: only include breeds with peer-reviewed or guideline-level
  evidence of elevated risk.
- emergency_tags: short keyword list (["lilium","urinary_obstruction","seizure"])
  used by the app's emergency detector. Only add tags that would justify
  a Layer-1 emergency route.

OUTPUT:
Valid JSON matching the KnowledgeCard schema. Do not output anything else.
```

**Cost per card:** ~3K input + 500 output tokens = ~$0.001. For 800 cards = **$0.80**.

---

## 8. Step 4: Verification

Second LLM pass. Given the draft card + sources again, LLM scores how well each claim is supported.

**Prompt (`prompts/verify_card.md`):**
```
You are an independent verifier. Given:
- A CatMD knowledge card draft
- The source excerpts used to create it

For each factual claim in the card, rate 0-1 whether it's supported by the
sources. Return overall confidence = mean of claim scores.

Also check:
- Does cat_specific_notes actually capture a cat-specific fact?
- Are emergency_tags appropriate (not over/under-tagged)?
- Any hallucinated drug names, doses, or thresholds?

Output JSON:
{
  "confidence": 0.0-1.0,
  "unsupported_claims": [...],
  "corrections": [...],
  "emergency_tags_assessment": "appropriate" | "overtagged" | "undertagged",
  "recommend_action": "accept" | "flag_for_review" | "reject"
}
```

**Decision rule:**
- `confidence >= 0.8` → auto-accept
- `0.6 <= confidence < 0.8` → flag for spot-check
- `confidence < 0.6` → reject (discard or regenerate)

**Cost per card:** ~3.5K input + 300 output = ~$0.001. For 800 cards = **$0.80**.

---

## 9. Step 5: Spot-Check CLI

Simple `rich`-powered terminal tool for reviewing 5% sample + all flagged cards.

```bash
python -m src.spotcheck --sample-pct 5 --include-flagged
```

Shows card body + sources, prompts: `[A]ccept / [R]eject / [E]dit / [S]kip / [F]lag pattern`.

Saves decisions to `data/cards_final.jsonl`.

---

## 10. Step 6: Embed + Load

```python
# src/embed_and_load.py
from openai import OpenAI
from supabase import create_client

def embed_card(card: KnowledgeCard) -> list[float]:
    # Serialize the semantically-meaningful parts
    text = f"""
    Topic: {card.topic}
    Category: {card.category}
    Symptoms: {', '.join(card.body.symptoms)}
    Emergency threshold: {card.body.emergency_threshold or ''}
    Cat-specific notes: {card.body.cat_specific_notes}
    Differentials: {', '.join(card.body.differentials)}
    """
    resp = openai.embeddings.create(
        model='text-embedding-3-small',
        input=text.strip(),
        dimensions=1536,
    )
    return resp.data[0].embedding

def load_all(cards: list[KnowledgeCard]):
    rows = [{
        'topic': c.topic,
        'category': c.category,
        'body': c.body.model_dump(),
        'sources': [s.model_dump() for s in c.sources],
        'embedding': embed_card(c),
        'emergency_tags': c.emergency_tags,
        'confidence': c.confidence,
        'generated_at': c.generated_at,
        'version': c.version,
    } for c in cards]
    supabase.table('knowledge_cards').upsert(rows).execute()
```

Cost: 800 × 300 tokens × $0.02/1M = **$0.01**.

---

## 11. Orchestrator (`scripts/run_pipeline.py`)

```python
import asyncio
from src.enumerate_topics import run as step1
from src.gather_sources import run as step2
from src.extract_cards import run as step3
from src.verify_cards import run as step4
from src.embed_and_load import run as step6

async def main():
    topics = await step1()                              # 1 LLM call
    sources = await step2(topics)                       # 2-5K fetches
    draft_cards = await step3(topics, sources)          # 800 LLM calls
    verified = await step4(draft_cards, sources)        # 800 LLM calls
    # step 5 is manual (spot-check CLI)
    final = load_jsonl('data/cards_final.jsonl')
    await step6(final)                                  # 800 embeddings + upsert

if __name__ == '__main__':
    asyncio.run(main())
```

Total runtime estimate: 6–12 hours (mostly LLM rate-limit bound).

---

## 12. Supabase Setup (prerequisite)

```sql
-- Run once before step 6
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic text NOT NULL UNIQUE,
    category text NOT NULL,
    body jsonb NOT NULL,
    sources jsonb NOT NULL,
    embedding vector(1536),
    emergency_tags text[],
    confidence float,
    generated_at timestamptz DEFAULT now(),
    version int DEFAULT 1
);

CREATE INDEX knowledge_cards_embedding_idx
  ON knowledge_cards USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX knowledge_cards_category_idx ON knowledge_cards (category);
CREATE INDEX knowledge_cards_emergency_tags_idx
  ON knowledge_cards USING gin (emergency_tags);

-- RLS: only service role can write, authenticated can read
ALTER TABLE knowledge_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all_authenticated" ON knowledge_cards
  FOR SELECT USING (auth.role() = 'authenticated');
```

---

## 13. Validation + Sanity Checks (`scripts/validate_corpus.py`)

Before declaring corpus ready for production:

- [ ] ≥500 cards total
- [ ] Every category has ≥10 cards
- [ ] Toxicology category has ≥30 substances (everything in emergency keyword list)
- [ ] Average confidence ≥0.85
- [ ] No duplicate topics (exact or fuzzy match)
- [ ] Every card has ≥2 sources
- [ ] All sources fetched in last 90 days
- [ ] Random 10 emergency-tagged cards: manual read-through, pass
- [ ] Semantic query test: 20 canonical queries return relevant top-3

---

## 14. Future Iterations (v2+)

- **Multi-language corpus** (Spanish, Portuguese — high cat-owner markets)
- **Vet-reviewed gold-standard sub-corpus** (hire vet to author 50 cards at highest authority)
- **Dynamic re-rank** based on user feedback signals (thumbs-down → lower rank)
- **Automated refresh** on source-url change detection (quarterly cron)
- **Peer-reviewed journal integration** (auto-ingest new CC-BY feline papers from PMC)
