# Chat Memory Recall — Research Log (2026-05-07)

Living document for the ongoing investigation into how the cat-chat
module surfaces facts from the per-cat memory store. Findings here
inform when (and whether) to evolve the current heuristic scorer
toward semantic retrieval, summarization, or hybrid approaches.

## TL;DR

After three benchmark runs (15 prompts × multiple variants each),
**the production keyword + intent scorer is competitive with or
better than embedding-based ranking on every fixture we've tested
so far.** Don't ship the embedding scorer based on current
evidence. Keep it behind the `EXPO_PUBLIC_FACT_SCORER` flag for
future re-testing as the data shape evolves.

---

## Architecture context (snapshot at time of research)

The chat module assembles its system prompt from:

1. **Voice rules** (`VOICE_RULES` constant + per-mood + per-archetype overlays)
2. **Per-cat memory tiers**, structured-rendered by `renderCatContextForPrompt`:
   - `today` (mood + appetite check-in)
   - `medical` (recent triage scans, with a hard override for severe-recent)
   - `mood_arc` (last 7 days)
   - `diary` (top 7 entries)
   - `subject` (named people & pets)
   - `world` (objects/places/toys)
   - `self_fact` (user-told preferences)
   - `vaccination`, `medication_log`, `weight_log`, `appointment`, `pain_score`
   - `anticipation` (upcoming birthday / vet / gotcha-day)
   - `life_event` (landmark moments)
3. **Vector RAG** for the static vet knowledge base (`embedding_rag`
   activity) — top 6 cards via cosine over text-embedding-3-small.
4. **Pinned-facts header** at the END of the system prompt — top 7
   facts ranked by the keyword + intent heuristic in
   `factRetrieval.ts:scoreFact`. Pinning is the recall booster — the
   model often had the data in tier sections but didn't pull it out.

The research below probed whether replacing step 4's keyword scorer
with embedding similarity would lift recall further.

## Hypothesis at outset

The keyword + intent scorer fails on synonyms, paraphrase, and
vocabulary it hasn't been hand-tuned for. Embedding similarity
should win on natural language that doesn't hit the regex
patterns. Cost ~$0.0001/turn; recall lift expected at ~10-15pp.

## Methodology

15 fixed recall prompts (`scripts/bench-recall*.py`), gpt-4o-mini at
temp=0.7, max_tokens=300. Each prompt has a `must_mention` array of
expected fact strings; recall is `(hits / total expected)` averaged
across prompts. Three variants per fixture:

- **Baseline** — no pinned-facts header at all
- **Keyword** — pin top 7 ranked by `scoreFact` (current production)
- **Embedding** — pin top 7 ranked by cosine over text-embedding-3-small

All three see the identical BASE_SYSTEM data block; only the pinned
header changes (or is absent for baseline).

## Experiments

### Experiment 1 — Original 16 facts, literal-language prompts

Script: `scripts/bench-recall-embedding.py`
Output: `scripts/bench-output-embedding/`

| Variant   | Recall | Hallucinations |
|-----------|--------|---------------:|
| Baseline  | 46.8%  | 0              |
| Keyword   | 55.8%  | 1              |
| Embedding | 54.5%  | 0              |

**Result:** Keyword and embedding essentially tied; embedding 1.3pp lower.

**Why:** Per-tier caps with a small pool mean both rankers usually
pick the same items per tier. Keyword wins on `subjects_recall`
because literal name match (+6 keyword bonus) is more decisive than
semantic similarity. Embedding wins on `self_facts` (100% vs 75%)
because semantic clustering correctly groups "where do you nap?"
with both `self-greenchair` and `self-blanket`.

### Experiment 2 — Original 16 facts, paraphrase-heavy prompts

Script: `scripts/bench-recall-paraphrase.py`
Output: `scripts/bench-output-paraphrase/`

Same 15 questions rewritten as natural paraphrase that **avoids
every keyword and intent pattern in factRetrieval.ts**:

| Original                                  | Paraphrase                                          |
|-------------------------------------------|-----------------------------------------------------|
| "Are you feeling better now?"             | "Body holding up after that rough patch?"          |
| "Tell me about Lucas."                    | "Give me the rundown on the live-in human."         |
| "What's your favourite food?"             | "Top tier munchies?"                                |
| "Catch me up — what's happening?"         | "Hit me with a download."                           |

Trigger audit confirmed 13/15 prompts hit zero keyword/intent triggers.

| Variant   | Recall | Hallucinations |
|-----------|--------|---------------:|
| Baseline  | 41.6%  | 0              |
| Keyword   | 50.6%  | 1              |
| Embedding | 48.1%  | 0              |

**Result:** Keyword still wins by 2.5pp despite having no keywords to fire on.

**Why this surprised me:** I expected embedding to dominate here. It
didn't — and the explanation is **the keyword scorer's priority
fallback is doing more work than I credited.** When no keywords
match, the scorer falls back to base priority order:

```
medical (9) → anticipations (7) → today/mood_arc (6) →
subjects/life_event (5) → diary/self_fact (4)
```

Combined with per-tier caps (medical: 2, subject: 3, diary: 2, …)
the priority fallback selects 7-9 facts spanning 8 different tiers
— **broad coverage that happens to contain the right answer on the
small fixture.** Embedding tries to be smarter and sometimes
substitutes in semantically-near-but-wrong facts (subject-Mom for
"the live-in human", self-greenchair for "what's bouncing through
your head").

### Experiment 3 — Large pool (86 facts), literal prompts

Script: `scripts/bench-recall-largepool.py`
Output: `scripts/bench-output-largepool/`

Same 16 answer facts plus 70 noise facts (additional diary entries,
subjects, self-facts, older medical events, etc.) so that within-tier
discrimination matters — picking the right 2 of 30 diary entries vs
the right 2 of 3.

Pool composition (caps in parens):

| Tier         | Facts | Cap |
|--------------|-------|-----|
| diary        | 30    | 2   |
| self_fact    | 25    | 2   |
| subject      | 15    | 3   |
| anticipation | 5     | 2   |
| life_event   | 5     | 2   |
| medical      | 4     | 2   |
| today        | 1     | 1   |
| mood_arc     | 1     | 1   |

The data block in BASE_SYSTEM was also expanded to include the
noise so both pinning approaches and baseline see the same
expanded context. (Note: this over-feeds the data block vs
production, which slices diary to top 7. See "Caveats" below.)

| Variant   | Recall | Hallucinations |
|-----------|--------|---------------:|
| **Baseline** | **55.8%** | 0 |
| Keyword   | 53.2%  | 2              |
| Embedding | 48.1%  | 1              |

**Result:** Baseline (no pinning) WINS. Both pinning approaches HURT.
Embedding hurts most.

**The unexpected pattern:** with a richer data block, the model can
find answers natively. Pinning then *injects distractors* — wrong
facts that pull the model's attention away from correct facts in
the data section. Embedding is hurt more because it's better at
picking semantically-similar-but-wrong items.

By-tier breakdown reveals embedding's split personality:

| Tier                | Baseline | Keyword | Embedding | Notes                                |
|---------------------|----------|---------|-----------|--------------------------------------|
| medical_recall      | 41.7%    | 33.3%   | **58.3%** | EMB pulled `diary-04-29` ("vomiting")|
| subjects_recall     | 71.4%    | 64.3%   | **78.6%** | EMB picked correct subject + supporting diary |
| **diary_recall**    | **60.0%**| 50.0%   | **10.0%** | EMB catastrophically picked wrong-day diaries |
| anticipation_recall | 70.0%    | **80.0%** | 50.0%   | KW won via input-order tiebreak      |
| **combined_recall** | **66.7%**| 44.4%   | **33.3%** | All pinning hurt; EMB worst          |

Embedding is sharper when the right answer is semantically distinct
(medical, subjects). It's catastrophic when multiple facts cluster
together semantically (diary entries about Lucas all read alike;
embedding picks the wrong one).

## Findings

### F1 — The keyword scorer has a hidden ordering prior

`buildFactsFromChatContext` builds the `Fact[]` tier-by-tier in a
fixed order, and `scoreFact` ties break by input position. This
creates an **implicit recency/freshness preference** that the
keyword scorer benefits from but embedding doesn't. Worth
documenting and being deliberate about.

### F2 — Pinning has a domain of usefulness, not a universal lift

Pinning gives **+9pp** in the small-pool literal benchmark (baseline
46.8% → keyword 55.8%) but **-2.6pp** in the large-pool benchmark
(baseline 55.8% → keyword 53.2%). The crossover is somewhere
between 16 and 86 facts in the data block.

**Hypothesis:** pinning helps when the data block is sparse enough
that the model needs help finding facts. As the data block grows
richer, the model finds answers natively, and pinning's
distractor-injection cost overtakes its focusing benefit.

This is testable in production via `chat_prompt_size` telemetry
(shipped in vc 72) — A/B with-pinning vs without-pinning at
different prompt-size buckets.

### F3 — Embedding's strengths and weaknesses are real but mixed

Wins on `medical_recall` and `subjects_recall` (semantic clustering
helps when right answer is distinct).
Loses on `diary_recall` and `combined_recall` (semantic clustering
hurts when multiple facts cluster — picks the wrong nearest
neighbor).
Net: a wash in current experiments.

### F4 — Hybrid (keyword-primary, embedding-fallback-when-no-trigger) wouldn't help here

The proposed hybrid was: use embedding only when the user message
fires no keyword/intent pattern. Experiment 2 explicitly tested
this regime (13/15 prompts had no triggers) and embedding still
lost. The signal isn't there at current model + prompt
sophistication.

### F5 — Temporal language is an open weakness

EMB picked `diary-2026-04-10` for "What did you do on Wednesday?"
because Lucas appears in both. Adding temporal anchors to fact
text (embed `"3 days ago [smug]: ..."` instead of
`"2026-05-03 [smug]: ..."`) might let embedding distinguish when
relative time is in the query. **Worth a future experiment.**

### F6 — Pinning may be doing harm when prompts are large

The combined-recall tier dropped 66.7% → 44.4% with keyword pinning
on the large-pool fixture. The model was finding all the answer
facts in the data block on its own; pinning a SUBSET of them
narrowed the focus and lost facts. **A "skip pinning when
total_chars > N" heuristic may be a no-op recall improvement.**

## Recommendation

**Don't ship the embedding scorer.** Keep the flag wiring in place
for future re-tests. The production keyword scorer is competitive
with or better than embedding on every fixture we've tested.

**Higher-leverage next experiments** (in order):

1. **Test conditional pinning.** Use `chat_prompt_size` telemetry to
   identify production-realistic prompt sizes. A/B with-pinning vs
   without-pinning at different size thresholds. If pinning hurts
   above some size, ship the threshold gate. Cheap, sync, no new
   API calls.

2. **Try temporal-aware fact text.** Re-embed facts as "3 days ago"
   instead of "2026-05-03". Re-run experiment 3. This could fix
   embedding's diary-recall collapse without changing the architecture.

3. **Try section-level pinning instead of fact-level.** Right now
   we pin individual facts. What if we instead surface the
   relevant tier headers ("WORLD section is most relevant for this
   reply" → re-render that section at the end)? Keeps the cohesion
   of full-tier rendering while still focusing attention.

4. **Revisit when input shape changes.** If we move to a smaller
   on-device model, or to a richer data block per turn, or to
   user-conversational rather than command-style prompts, retest.
   The keyword scorer's edge is fragile to those changes.

## What's in the repo

### Source (production, behind flag)

- `src/services/factRetrieval.ts` — `selectRelevantFactsByEmbedding`,
  cosine helper, fact-embedding cache
- `src/services/chat.ts` — flag-driven scorer selection
- `src/services/analytics.ts` — `embedding_fact_score` LLMActivity,
  `scorer` prop on `chat_relevant_facts_picked`
- `EXPO_PUBLIC_FACT_SCORER` env var — defaults to `keyword`; set to
  `embedding` to flip on the alternate scorer at chat time

### Benchmarks (Python, all reproducible with `OPENAI_API_KEY`)

- `scripts/bench-recall-embedding.py` — small fixture, literal prompts
- `scripts/bench-recall-paraphrase.py` — small fixture, paraphrase prompts
- `scripts/bench-recall-largepool.py` — large fixture, literal prompts

### Outputs (regenerated each run)

- `scripts/bench-output-embedding/`
- `scripts/bench-output-paraphrase/`
- `scripts/bench-output-largepool/`

## Caveats / threats to validity

- **15 prompts is a small sample.** A 100-prompt fixture might
  reveal patterns we missed. Building one is the most expensive
  part of this work; cost on each retest is ~$0.30 in OpenAI calls.
- **Single random seed.** gpt-4o-mini at temp=0.7 has run-to-run
  variance. Each variant should ideally be averaged over 3-5
  reruns. Single-run noise could explain a couple percentage
  points of the embedding-vs-keyword delta.
- **Large-pool fixture over-feeds the data block.** Production caps
  diary at 7 entries in the rendered data; my fixture rendered all
  30. The "baseline 55.8%" win in experiment 3 is partly an
  artifact of that over-feed. **Future experiment: rebuild the
  large-pool fixture with production-realistic data-block slicing
  (top 7 diary, etc.) but keep the full pool for ranking.** This
  would isolate "pool size effect on ranking" from "data-block
  size effect on baseline".
- **must_mention scoring is permissive.** A reply containing
  "twelve" passes "12 days" check. A more rigorous scorer
  (judge-LLM grading) would change the absolute numbers but
  probably not the relative ordering.

## How to re-run

```bash
# All three benchmarks (consumes ~$0.50-1.00 in OpenAI credits)
OPENAI_API_KEY=sk-... python scripts/bench-recall-embedding.py
OPENAI_API_KEY=sk-... python scripts/bench-recall-paraphrase.py
OPENAI_API_KEY=sk-... python scripts/bench-recall-largepool.py
```

Each writes `summary.md`, `summary.json`, `results.json` into its
output directory. The per-prompt details in `summary.md` are the
most useful debugging tool — they show exactly which facts each
scorer picked and what the resulting reply looked like.
