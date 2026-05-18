/**
 * Self-facts conflict resolver (added 2026-05-14 per audit finding #7).
 *
 * The base `upsertFact` action in `selfFactsStore` dedups by normalised
 * exact text — so "I love tuna" and "I love tuna." merge, but "I love
 * tuna" and "I hate tuna" both persist. That makes the cat sound
 * inconsistent over time, which is the #1 enemy of the "this is MY
 * cat" illusion that drives retention.
 *
 * This resolver adds a two-layer pre-check before calling the store's
 * synchronous upsert:
 *
 *   1. **Semantic similarity** (text-embedding-3-small via `embed()`).
 *      Cosine similarity between the new fact and each existing fact.
 *      Same infra as `embedding_fact_score` — already in production.
 *
 *   2. **Antonym / sentiment-opposition** check on the two fact texts
 *      when similarity is in the contradiction-candidate range.
 *
 * Resolution rules:
 *   - similarity ≥ 0.95         → near-duplicate. Forward to the
 *                                  store's existing exact-dedup path
 *                                  (which bumps assertion_count).
 *                                  Embedding-based dedup catches
 *                                  paraphrases that exact-text dedup
 *                                  misses ("loves the kitchen" ≈
 *                                  "the kitchen is loved").
 *   - 0.80 ≤ similarity < 0.95
 *     AND opposing-verb pattern → contradiction. The NEWER fact wins:
 *                                  delete the older one, insert the new.
 *                                  Fires the `self_fact_contradiction_resolved`
 *                                  analytics event so we can track how
 *                                  often this triggers.
 *   - otherwise                 → independent (or related-but-compatible
 *                                  like "I love tuna" + "I love
 *                                  sardines"). Insert the new fact
 *                                  normally.
 *
 * Cost: one embedding per new fact (~$0.0001). When the cat has cached
 * embeddings for prior facts, comparisons are local-only.
 *
 * Honest tradeoffs:
 *   - The antonym dictionary catches common cases (love/hate, like/
 *     dislike, fears/loves) but misses paraphrase contradictions
 *     ("the vacuum is the enemy" vs "the vacuum brings joy"). Acceptable
 *     for v1 — wrong-positive is worse than miss for an automated
 *     resolver. We err on the side of keeping both facts when unsure.
 *   - We do NOT call the LLM for disambiguation. That would catch
 *     paraphrases but costs ~$0.0002 per fact and adds latency. Punt
 *     to Phase 2 if heuristic miss rate proves too high.
 */
import { embed } from '../ai/client';
import {
  useSelfFactsStore,
  type SelfFact,
  type SelfFactCategory,
} from '../state/selfFactsStore';

// ---------------------------------------------------------------------------
// Similarity thresholds
// ---------------------------------------------------------------------------

/** Above this cosine, treat as paraphrase / duplicate. */
const DUPLICATE_THRESHOLD = 0.95;

/** Between this and DUPLICATE_THRESHOLD = contradiction candidate. */
const CONTRADICTION_CANDIDATE_THRESHOLD = 0.8;

// ---------------------------------------------------------------------------
// Antonym dictionary
// ---------------------------------------------------------------------------
//
// Two parallel families — POSITIVE_VERBS describes affinity / drawing
// closer; NEGATIVE_VERBS describes aversion / drawing away. A fact pair
// where one text contains a positive root AND the other contains a
// negative root is a contradiction candidate. Word-boundary regex
// matching so "fearless" doesn't fire on "fear".
//
// Keep lowercase + base form. The matcher applies word-boundary regex
// so morphological variants ("loved", "fears", "afraid") need their
// own entries if we want them caught.

const POSITIVE_VERBS: ReadonlyArray<string> = [
  'love',
  'loves',
  'loved',
  'like',
  'likes',
  'liked',
  'enjoy',
  'enjoys',
  'enjoyed',
  'adore',
  'adores',
  'prefer',
  'prefers',
  'preferred',
  'crave',
  'craves',
  'want',
  'wants',
];

const NEGATIVE_VERBS: ReadonlyArray<string> = [
  'hate',
  'hates',
  'hated',
  'dislike',
  'dislikes',
  'disliked',
  'fear',
  'fears',
  'feared',
  'afraid',
  'scared',
  'terrified',
  'loathe',
  'loathes',
  'avoid',
  'avoids',
  'avoided',
  'dread',
  'dreads',
];

/** True iff the text contains any of `words` as a whole-word match. */
function containsAny(text: string, words: ReadonlyArray<string>): boolean {
  const lower = text.toLowerCase();
  for (const w of words) {
    const re = new RegExp(`\\b${w}\\b`, 'i');
    if (re.test(lower)) return true;
  }
  return false;
}

/**
 * Detect whether two fact texts assert opposing sentiments. Heuristic:
 * one contains a POSITIVE_VERB AND the other contains a NEGATIVE_VERB.
 *
 * False-positive guard: if one fact contains BOTH a positive and a
 * negative verb (e.g. "I love tuna but I hate sardines"), don't flag —
 * the verbs aren't necessarily in opposition.
 */
export function detectOpposingSentiment(a: string, b: string): boolean {
  const aPos = containsAny(a, POSITIVE_VERBS);
  const aNeg = containsAny(a, NEGATIVE_VERBS);
  const bPos = containsAny(b, POSITIVE_VERBS);
  const bNeg = containsAny(b, NEGATIVE_VERBS);
  // Guard: skip if either fact contains both polarities
  if ((aPos && aNeg) || (bPos && bNeg)) return false;
  return (aPos && bNeg) || (aNeg && bPos);
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Embedding cache
// ---------------------------------------------------------------------------
//
// Process-lifetime cache: per-fact-text → embedding vector. Survives
// for the duration of the app session. The same fact text being
// re-asserted produces a cache hit, so a chatty week with the same
// "I love tuna" reasserted 5 times costs only one embedding compute.
//
// Cache key is the lowercased trimmed fact text. Crash-safe — failures
// to embed return null and we just skip the similarity check (false-
// negative on contradiction detection, never blocks fact insertion).

const factEmbeddingCache = new Map<string, number[] | 'pending'>();

function cacheKey(text: string): string {
  return text.trim().toLowerCase();
}

async function getEmbedding(text: string): Promise<number[] | null> {
  const key = cacheKey(text);
  const cached = factEmbeddingCache.get(key);
  if (cached && cached !== 'pending') return cached;
  if (cached === 'pending') {
    // Another caller is computing this same text; busy-wait briefly.
    // In practice the embed() call below resolves in <200ms so this
    // collision is rare.
    return null;
  }
  factEmbeddingCache.set(key, 'pending');
  try {
    const vec = await embed(text, 'embedding_fact_score');
    if (!vec || vec.length === 0) {
      factEmbeddingCache.delete(key);
      return null;
    }
    factEmbeddingCache.set(key, vec);
    return vec;
  } catch (e) {
    console.warn('[selfFactsResolver] embedding failed:', e);
    factEmbeddingCache.delete(key);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ResolverOutcome =
  | { kind: 'inserted'; fact: SelfFact }
  | { kind: 'merged'; fact: SelfFact }
  | { kind: 'replaced'; fact: SelfFact; supersededId: string; supersededText: string };

/**
 * Resolve a new fact against the cat's existing fact set and persist
 * the appropriate outcome (insert, merge, or replace).
 *
 * Falls back to the store's exact-text dedup path on any embedding
 * failure — embedding errors must never block fact ingestion.
 *
 * Returns:
 *   - `inserted`  if the fact is genuinely new (no high-similarity
 *                 neighbour found)
 *   - `merged`    if a near-duplicate existed and was bumped
 *   - `replaced`  if a contradicting fact existed and was superseded
 */
export async function resolveAndUpsertFact(opts: {
  catId: string;
  fact: string;
  category: SelfFactCategory;
  source: SelfFact['source'];
  confidence?: number;
  sourceTurnId?: string;
}): Promise<ResolverOutcome> {
  const store = useSelfFactsStore.getState();
  const existing = store.getFactsForCat(opts.catId);

  // Cheap pre-filter: if there are no existing facts, skip the
  // embedding round-trip entirely.
  if (existing.length === 0) {
    const fact = store.upsertFact({
      catId: opts.catId,
      fact: opts.fact,
      category: opts.category,
      source: opts.source,
      ...(opts.confidence !== undefined ? { confidence: opts.confidence } : {}),
      ...(opts.sourceTurnId ? { sourceTurnId: opts.sourceTurnId } : {}),
    });
    return { kind: 'inserted', fact };
  }

  // Compute embedding for the new fact + existing candidates in
  // parallel. Cache hits return immediately.
  const newVecPromise = getEmbedding(opts.fact);
  const existingVecPromises = existing.map((f) => getEmbedding(f.fact));
  const [newVec, ...existingVecs] = await Promise.all([
    newVecPromise,
    ...existingVecPromises,
  ]);

  // If embedding for the new fact failed, fall back to exact-dedup.
  if (!newVec) {
    const fact = store.upsertFact({
      catId: opts.catId,
      fact: opts.fact,
      category: opts.category,
      source: opts.source,
      ...(opts.confidence !== undefined ? { confidence: opts.confidence } : {}),
      ...(opts.sourceTurnId ? { sourceTurnId: opts.sourceTurnId } : {}),
    });
    return { kind: 'inserted', fact };
  }

  // Find the highest-similarity existing fact (skip those whose
  // embedding failed to compute).
  let bestSim = -1;
  let bestIdx = -1;
  for (let i = 0; i < existing.length; i++) {
    const v = existingVecs[i];
    if (!v) continue;
    const sim = cosineSim(newVec, v);
    if (sim > bestSim) {
      bestSim = sim;
      bestIdx = i;
    }
  }

  // No comparable existing fact (every embedding failed). Plain insert.
  if (bestIdx < 0) {
    const fact = store.upsertFact({
      catId: opts.catId,
      fact: opts.fact,
      category: opts.category,
      source: opts.source,
      ...(opts.confidence !== undefined ? { confidence: opts.confidence } : {}),
      ...(opts.sourceTurnId ? { sourceTurnId: opts.sourceTurnId } : {}),
    });
    return { kind: 'inserted', fact };
  }

  const bestExisting = existing[bestIdx]!;

  // Duplicate / paraphrase: forward to the store's exact-dedup path
  // BUT only if the texts also dedup-key the same way (i.e. the
  // existing entry's normalised text matches). If embedding says
  // "duplicate" but the texts are surface-different ("loves the
  // kitchen" vs "the kitchen is loved"), upsertFact will create a
  // new row anyway — call patchFact on the existing entry to absorb
  // the new wording without duplicating, then bump assertion_count
  // via re-asserting through upsertFact on the existing text.
  if (bestSim >= DUPLICATE_THRESHOLD) {
    // Reassert the existing fact's text to bump its assertion_count
    // and refresh updated_at. The original phrasing is what the cat
    // "remembers" — paraphrases just reinforce, not rewrite.
    const fact = store.upsertFact({
      catId: opts.catId,
      fact: bestExisting.fact,
      category: opts.category,
      source: opts.source,
      ...(opts.confidence !== undefined ? { confidence: opts.confidence } : {}),
      ...(opts.sourceTurnId ? { sourceTurnId: opts.sourceTurnId } : {}),
    });
    return { kind: 'merged', fact };
  }

  // Contradiction candidate: similarity is in the medium band AND
  // opposing sentiment detected. Newer wins — delete old, insert new.
  if (
    bestSim >= CONTRADICTION_CANDIDATE_THRESHOLD &&
    detectOpposingSentiment(bestExisting.fact, opts.fact)
  ) {
    const supersededId = bestExisting.id;
    const supersededText = bestExisting.fact;
    store.deleteFact(opts.catId, supersededId);
    const fact = store.upsertFact({
      catId: opts.catId,
      fact: opts.fact,
      category: opts.category,
      source: opts.source,
      ...(opts.confidence !== undefined ? { confidence: opts.confidence } : {}),
      ...(opts.sourceTurnId ? { sourceTurnId: opts.sourceTurnId } : {}),
    });
    // Analytics — track how often the resolver fires so we can tune
    // thresholds + antonym dictionary against real data.
    void import('./analytics').then(({ track }) => {
      try {
        track({
          type: 'self_fact_contradiction_resolved',
          props: {
            old_fact: supersededText.slice(0, 120),
            new_fact: opts.fact.slice(0, 120),
            similarity: Math.round(bestSim * 1000) / 1000,
            category: opts.category,
          },
        });
      } catch {
        // analytics failures are silent
      }
    });
    return {
      kind: 'replaced',
      fact,
      supersededId,
      supersededText,
    };
  }

  // Independent (or related-but-compatible) fact — insert normally.
  const fact = store.upsertFact({
    catId: opts.catId,
    fact: opts.fact,
    category: opts.category,
    source: opts.source,
    ...(opts.confidence !== undefined ? { confidence: opts.confidence } : {}),
    ...(opts.sourceTurnId ? { sourceTurnId: opts.sourceTurnId } : {}),
  });
  return { kind: 'inserted', fact };
}
