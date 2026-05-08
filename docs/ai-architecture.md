# CatMD AI Architecture

**Status:** locked 2026-04-21. This is the implementation bible for the intelligence layer.

---

## 1. First Principles

**Pure-LLM is wrong for CatMD.** Reasons:
1. **Hallucination on specifics** — LLMs fabricate toxicity thresholds, drug dosages, emergency thresholds. Lethal for medical.
2. **Training data bias** — feline medicine under-represented vs human + canine in LLM training sets.
3. **No citations** — triage without sources = FTC-risky and low-trust.
4. **No version control** — medicine evolves; LLM is frozen at training cutoff.
5. **Per-cat context lost** — can't remember "Mittens had CKD flagged last year."
6. **Prompt injection risk** — user can manipulate freely.

**Architecture:** RAG (curated feline knowledge cards) + tool use (deterministic lookups) + per-cat memory (pgvector) + deterministic guardrails (pre + post LLM).

---

## 2. Six-Layer Pipeline

```
USER INPUT (photo + text + voice)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: INPUT GUARDRAILS (deterministic, no LLM)           │
│   • Species guard: non-cat → redirect                       │
│   • Emergency keyword detector (force urgency=urgent)       │
│   • Prompt-injection sanitizer                              │
│   • Profanity / off-topic filter                            │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: CONTEXT ASSEMBLY (the "memory")                    │
│   • Cat profile (breed, age, weight, conditions, meds)      │
│   • Recent scans (30d pgvector similarity)                  │
│   • Vet record excerpts (user-uploaded PDFs, chunked)       │
│   • Conversation history (last 6 turns)                     │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: RAG RETRIEVAL (the "knowledge")                    │
│   • pgvector semantic search over Knowledge Cards           │
│   • Top-k = 8, re-ranked by relevance + recency             │
│   • Always include: emergency-tagged chunks if keywords hit │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: LLM + TOOL USE (the "reasoning")                   │
│   • gpt-4o-mini (default) / Claude Sonnet 4.6 (emergency)   │
│   • Tool calls (deterministic, not LLM judgment):           │
│       - lookup_cat_toxicity(substance)                      │
│       - lookup_drug_safety(drug, weight_kg, age)            │
│       - lookup_breed_risks(breed, age)                      │
│       - recall_past_scans(cat_id, keywords)                 │
│   • Structured JSON output schema                           │
│   • Streaming enabled                                       │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5: OUTPUT GUARDRAILS (post-filter)                    │
│   • Urgency override: emergency keywords force urgent tier  │
│   • Strip forbidden phrases ("diagnosed with", "treatment") │
│   • Inject "informational only" footer                      │
│   • Validate structured schema                              │
│   • Redact any PII that slipped through                     │
└────────────────────┬────────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 6: PERSIST + LEARN                                    │
│   • Save event → Supabase                                   │
│   • Embed interaction → pgvector (future context)           │
│   • Update cat symptom timeline                             │
│   • Telemetry: user contradictions flagged for prompt tuning│
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Model Routing (Hybrid)

**Default: `gpt-4o-mini`** — $0.15/1M input + $0.60/1M output.
- At 10K users × 4 scans/mo × 1.5K input + 600 output = ~40K scans × ~$0.002 = **~$80/mo**

**Emergency-tier escalation: `claude-sonnet-4-6-20250514`** — $3/1M input + $15/1M output.
- Route when Layer 1 emergency keywords fire OR Layer 4 returns `urgency=urgent`.
- At estimated 5% of scans = 2K emergency × ~$0.022 = **~$44/mo**

**Total LLM cost at 10K users: ~$124/mo** (+ $5 embeddings = ~$130/mo). Gross margin ~95% at $12.99/mo × 3% paid conversion.

---

## 4. RAG Knowledge Corpus

### Sources (P0, v1 launch)
All public-access, factual content. We paraphrase facts into our own structured cards — never store verbatim.

| Source | Type | License |
|---|---|---|
| **Merck Veterinary Manual** (feline) | Encyclopedia | Facts used; not stored verbatim |
| **Cornell Feline Health Center** | Consumer vet | Public; cite-back |
| **ICatCare / ISFM** (public pages) | Consensus statements | Open access |
| **AAFP consumer handouts** | Guidelines | Free |
| **ASPCA Animal Poison Control** | Toxicity database | Facts (not copyrightable) |
| **Open-access PubMed Central** (feline) | Peer-reviewed | CC-BY articles only |

### Storage: Supabase pgvector

```sql
-- Knowledge Cards (one row per curated topic)
CREATE TABLE knowledge_cards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic            text NOT NULL,               -- "Feline Lower Urinary Tract Disease"
  category         text NOT NULL,               -- derm/ophth/respiratory/GI/...
  body             jsonb NOT NULL,              -- structured fields (see below)
  sources          jsonb NOT NULL,              -- [{url, title, fetched_at}]
  embedding        vector(1536),                -- text-embedding-3-small
  emergency_tags   text[],                      -- ['lilium', 'urinary_obstruction']
  generated_at     timestamptz DEFAULT now(),
  version          int DEFAULT 1,
  confidence       float                        -- 0-1, verification score
);

CREATE INDEX ON knowledge_cards USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON knowledge_cards (category, confidence);
CREATE INDEX ON knowledge_cards USING gin (emergency_tags);
```

### Knowledge Card Schema (the `body` JSON)

```typescript
{
  topic: "Feline Lower Urinary Tract Disease (FLUTD)",
  aliases: ["FLUTD", "FIC", "urinary blockage"],
  symptoms: [
    "straining to urinate", "blood in urine", "crying in litter box",
    "urinating outside box", "excessive grooming of genital area"
  ],
  emergency_threshold: "complete obstruction = life-threatening < 24h",
  time_to_vet: {
    urgent: "blockage suspected — immediate",
    concern: "straining > 4h without urine output",
    monitor: "intermittent straining < 24h",
    routine: "preventive follow-up"
  },
  breed_risks: ["Persian", "male cats (anatomically higher risk)"],
  age_risks: "adult/senior; most common 1-10yr",
  toxicology: null,
  differentials: ["cystitis", "urinary stones/crystals", "tumor"],
  cat_specific_notes: "Males have narrower urethra — obstruction more common/fatal.",
  related_topics: ["urinary-stones", "FIC", "cystitis"],
  decision_tree: [/* optional structured branches */]
}
```

### Retrieval Strategy
1. **Semantic search** top-k=8 via cosine similarity on embedding
2. **Re-rank** by: (relevance × 0.7) + (recency × 0.15) + (confidence × 0.15)
3. **Force-include** emergency-tagged cards if Layer 1 fired any emergency keyword
4. **Deduplicate** by `related_topics`
5. **Context budget**: 4K tokens total for retrieved cards (≈ 3–4 cards expanded)

---

## 5. Per-Cat Memory (Longitudinal Context)

### Schema

```sql
CREATE TABLE cats (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES users,
  name        text, breed text, age_months int, weight_kg float,
  sex         text, spayed bool, indoor_outdoor text,
  conditions  text[], medications jsonb,
  photo_url   text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE cat_events (
  id          uuid PRIMARY KEY,
  cat_id      uuid REFERENCES cats ON DELETE CASCADE,
  type        text CHECK (type IN ('scan','chat','vet_record','symptom',
                                   'litter_box','weight','feeding','medication')),
  timestamp   timestamptz DEFAULT now(),
  payload     jsonb,
  embedding   vector(1536)      -- for semantic recall
);

CREATE TABLE vet_record_chunks (
  id              uuid PRIMARY KEY,
  cat_id          uuid REFERENCES cats,
  source_doc      text,
  chunk_text      text,
  embedding       vector(1536)
);

CREATE INDEX ON cat_events USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON cat_events (cat_id, timestamp DESC);
CREATE INDEX ON vet_record_chunks USING ivfflat (embedding vector_cosine_ops);
```

### Memory Retrieval at Query Time

**Always include in context:**
1. Cat profile (breed, age, weight, conditions, meds) — 150 tokens
2. Current conversation (last 6 turns) — up to 1K tokens
3. Cat's top-5 most similar past events (pgvector, filtered by cat_id) — 500 tokens
4. Vet record chunks relevant to query (top-3) — 750 tokens

**Time-weighted:** events in last 14 days up-weighted 2×.

**Emergency override:** if query matches emergency keywords, retrieve ALL emergency-tagged past events for this cat (overrides similarity ranking).

**Total memory budget:** ~2.5K tokens — leaves 1.5K for RAG + conversation.

---

## 6. Tool Use (Deterministic Backstops)

When accuracy matters more than language fluency, route to tools. LLM decides to call; tools return verified data.

```typescript
// ─────── Tool 1: Toxicity lookup ─────────────────────────
async lookup_cat_toxicity(substance: string): {
  toxic: boolean,
  severity: 'fatal' | 'severe' | 'moderate' | 'mild' | 'non-toxic',
  ld50_mg_per_kg?: number,
  minimum_toxic_dose_mg_per_kg?: number,
  symptoms: string[],
  time_to_onset_hours: number,
  time_to_vet: string,
  sources: string[]
}
// Backed by cat_toxicology table (ASPCA-derived facts + our summaries).
// CRITICAL: cats ≠ dogs ≠ humans. Tylenol kills cats at 10 mg/kg;
// dogs tolerate 100 mg/kg. LLM WILL get this wrong — do not trust it.

// ─────── Tool 2: Drug safety ─────────────────────────────
async lookup_drug_safety(drug: string, weight_kg: number, age: 'kitten'|'adult'|'senior'): {
  safe_for_cats: boolean,
  safe_dose_mg_per_kg?: [number, number],
  contraindications: string[],
  warning?: string,
  must_consult_vet: boolean     // defaults TRUE — LLM never suggests dosing
}

// ─────── Tool 3: Breed risk profile ──────────────────────
async lookup_breed_risks(breed: string, age_years: number): {
  high_risk_conditions: [{
    name: string,
    screening_age: number,
    early_signs: string[],
    prevalence_in_breed: string
  }]
}
// e.g. Persian → PKD, Maine Coon → HCM, Ragdoll → HCM, Siamese → asthma

// ─────── Tool 4: Past scan recall ────────────────────────
async recall_past_scans(cat_id: string, symptom_keywords: string[]): {
  related_events: [{ date, finding, urgency, outcome }]
}

// v2: emergency vet finder (deferred)
// async find_emergency_vet(lat, lon, max_km): { clinics: [...] }
```

**Rule:** whenever the LLM would speak about a toxin, drug, or breed risk, it **must** call the corresponding tool. System prompt enforces this.

---

## 7. Guardrails (10 locked rules)

| # | Guardrail | Implementation |
|---|---|---|
| 1 | **Species lock** | Reject queries about dogs/other species. Polite redirect: "CatMD only helps cats." |
| 2 | **No diagnosis language** | Post-filter strips "diagnosed with", "has [disease]", "confirmed" → rephrases to "symptoms consistent with". |
| 3 | **No drug dosages from LLM** | Dosage queries route to `lookup_drug_safety()`. Refuse if not in DB. |
| 4 | **Emergency override** | Keyword list forces `urgency=urgent` regardless of LLM: seizure, collapse, not breathing, blood in urine/stool, lily/lilium, antifreeze, chocolate >X g/kg, onion/garlic, paracetamol, ibuprofen, foreign body, prolonged straining. |
| 5 | **Cat-only toxicity tool** | Always use Tool 1 for substances. LLM cannot invent thresholds. |
| 6 | **Breed-aware context** | Auto-inject breed risks into system prompt when cat profile has breed. |
| 7 | **Age-stage thresholds** | Kitten / adult / senior (>10yr) / geriatric (>15yr) → lower "see vet" threshold for seniors. |
| 8 | **Prompt injection shield** | Wrap user input in `<user_input>` tags. System prompt uses XML-style instructions (Anthropic best practice). Test suite for known injections. |
| 9 | **Scope refusal** | Refuse: surgery opinions, euthanasia, prognosis/life-expectancy, definitive cancer claims, behavioral modification beyond basics. |
| 10 | **Citation enforcement** | Every clinical claim must reference a knowledge_card source. If no card supports → "consult your vet." |

---

## 8. Emergency Keyword Detector (Layer 1, deterministic)

Before the LLM runs, a fast classifier checks:

```python
IMMEDIATE_EMERGENCY = {
  # Critical — force urgency=urgent, skip LLM entirely and show urgent UI
  'respiratory': ['not breathing', 'cant breathe', 'struggling to breathe', 'gasping', 'open mouth breathing'],
  'neuro':       ['seizure', 'convulsion', 'collapsed', 'unresponsive', 'paralyzed'],
  'trauma':      ['hit by car', 'fell from height', 'attacked', 'bitten by'],
  'urinary':     ['blood in urine', 'straining to pee', 'cant urinate', 'no urine'],  # cat UTI→blockage = fatal <24h
  'toxic':       ['ate lily', 'ate lilium', 'ate antifreeze', 'ate rat poison',
                  'ate tylenol', 'ate paracetamol', 'ate acetaminophen',
                  'ate ibuprofen', 'ate chocolate', 'ate onion', 'ate garlic',
                  'ate xylitol', 'ate grapes', 'ate raisins'],
  'GI':          ['cant stop vomiting', 'bloated abdomen', 'eating string', 'eating thread'],
}

URGENT = {
  'duration': ['vomiting > 24h', 'diarrhea > 24h', 'not eating > 24h', 'not drinking > 24h'],
  'mobility': ['limping badly', 'cant walk', 'dragging leg'],
  'eye':      ['eye discharge with squinting', 'eye closed', 'cloudy eye'],
  'pregnancy':['in labor > 2h no progress'],
}
```

**Action on match:**
1. Tag event `emergency_flag=True`, urgency=`urgent`
2. Route LLM call to Claude Sonnet 4.6 (higher-quality model for higher-stakes response)
3. Force-include all emergency-tagged knowledge cards in RAG context
4. UI shows non-dismissible "Call your emergency vet now" banner
5. Log to emergency event table for monitoring

---

## 9. System Prompts

### Core Triage Prompt (`prompts/triage.md`)

```markdown
<role>
You are CatMD's AI triage assistant. You help cat parents understand their
cat's symptoms and decide whether to see a vet — you are NOT a vet.
</role>

<constraints>
- CATS ONLY. Refuse queries about other species politely.
- NEVER diagnose. Use "symptoms consistent with", "could suggest", "worth discussing with your vet".
- NEVER prescribe dosages. For any drug question, call lookup_drug_safety().
- NEVER answer toxicity questions without calling lookup_cat_toxicity().
- NEVER discuss euthanasia, prognosis, life expectancy, or definitive cancer.
- ALWAYS cite knowledge card sources when making a clinical claim.
- ALWAYS end with "Informational only — not veterinary advice."
</constraints>

<guardrail>
Cats hide pain by default (evolutionary). Be slightly more conservative than
you would for dogs — err toward "see vet sooner" especially for senior cats.
</guardrail>

<context>
Cat profile: {cat_profile_json}
Recent scans: {recent_scans_summary}
Knowledge cards: {rag_cards}
Emergency flag: {emergency_flag}  <!-- if true, DO NOT hedge -->
</context>

<output_schema>
Return JSON matching TriageResult:
{
  "urgency": "routine" | "monitor" | "concern" | "urgent",
  "score": 0-100,                          // health score for this observation
  "headline": string,                      // 1-sentence finding
  "explanation": string,                   // 2-3 sentences plain English
  "top_concerns": string[3],              // possible conditions (not diagnoses)
  "reassurances": string[3],              // what's NOT likely
  "vet_questions": string[],              // printable checklist
  "sources": [{url, title}],              // from knowledge cards
  "sub_scores": {                          // domain breakdown
    "eyes": 0-100, "teeth": 0-100, "coat": 0-100,
    "body_condition": 0-100, "behavior": 0-100, "weight": 0-100
  }
}
</output_schema>

<user_input>
{user_text_and_image_description}
</user_input>
```

### Tool-Use Prompt (appended)

```markdown
<tools>
You have access to:
- lookup_cat_toxicity(substance)
- lookup_drug_safety(drug, weight_kg, age)
- lookup_breed_risks(breed, age_years)
- recall_past_scans(cat_id, keywords)

Call tools when:
- User mentions a substance, plant, food, or chemical → lookup_cat_toxicity
- User asks about medication or dosing → lookup_drug_safety
- Cat has breed info and question touches breed-specific health → lookup_breed_risks
- User references past episode → recall_past_scans
</tools>
```

---

## 10. Cost Economics (10K MAU scenario)

| Component | Monthly Cost |
|---|---|
| gpt-4o-mini (95% of scans) | ~$80 |
| Claude Sonnet 4.6 (emergency 5%) | ~$44 |
| Embeddings (text-embedding-3-small) | ~$5 |
| Supabase (pgvector + auth + storage) | $0 (free tier) → $25 Pro at scale |
| **TOTAL** | **~$130/mo** |

At $12.99/mo × 3% conversion on 10K MAU = **$3.9K MRR** → **97% gross margin**.

---

## 11. Observability + Continuous Improvement

- **Log every event** (input, retrieved cards, tool calls, output, user feedback) to Supabase with RLS.
- **Flag for human review**: when user contradicts output ("no that's wrong"), low-confidence RAG (<0.6 similarity), emergency-flag triggered, scope-refusal fired.
- **Weekly prompt tuning loop**: batch flagged events, refine prompts, re-test on held-out set.
- **Eval suite**: 100 hand-labeled test cases covering all urgency tiers, emergency cases, scope-refusal traps, prompt-injection attempts. Run before every prompt change.
- **Red-team quarterly**: hire a veterinary professional to review 50 random outputs.

---

## 12. Legal Framing (copy rules)

**Never say:**
- "Your cat has [disease]"
- "Diagnose"
- "Treatment"
- "Cure"
- Specific drug dosages (unless tool returned them)
- Accuracy claims ("94% accurate")

**Always say:**
- "Symptoms consistent with…"
- "Worth discussing with your vet"
- "Triage only — not veterinary advice"
- "CatMD is not a substitute for professional veterinary care"

**Disclaimer placement:**
- Persistent footer on every result card (caption, muted)
- Non-dismissible modal at first scan (after emotional buy-in, before AI output)
- Verbose version in Settings → Legal
- Emergency tier: never a "dismiss" option on the emergency banner
