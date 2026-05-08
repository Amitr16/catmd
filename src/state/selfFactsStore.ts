/**
 * Self-Facts store — the cat's durable self-knowledge.
 *
 * ── Why this exists ────────────────────────────────────────────────
 * The chat is now first-person ("the cat is talking to you"). When a
 * user tells their cat something about itself — "you love tuna",
 * "you hate the vacuum", "you always sleep on my laptop after work" —
 * the cat needs to REMEMBER this beyond the 14-turn rolling chat
 * window. These accumulated user-asserted facts make the
 * cat-in-the-app increasingly *that specific cat*: a sketch on day 1,
 * a self-aware journaling presence by day 90.
 *
 * Self-facts feed into:
 *   - Chat system prompt (the cat references them naturally)
 *   - Diary prompt (the cat may mention "the tuna I love" in entries)
 *   - Postcards / posters (future — caption tone awareness)
 *   - Personality refinement (low-weight signal alongside the quiz)
 *
 * Two ingestion paths:
 *   1. Background LLM extraction from each user chat turn — when the
 *      user states a fact about the cat, services/selfFacts.ts pulls
 *      it out and writes it here. Idempotent, deduplicated.
 *   2. Manual entry via the Becoming screen's self-facts section —
 *      user can add / edit / delete directly.
 *
 * ── Privacy ─────────────────────────────────────────────────────────
 * Local-only. Self-facts can be deeply personal ("the cat sleeps on
 * grandma's chair since she died") — they never leave the device,
 * are not synced to Supabase, are not included in PostHog payloads.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Cloud sync helpers — lazy-imported (sync.ts imports SelfFact from
// this file, so static import would cycle). Fire-and-forget; errors
// are logged inside the helper, never surfaced.
function pushToCloud(fact: SelfFact): void {
  void import('../services/sync')
    .then((m) => m.syncSelfFactToCloud(fact))
    .catch(() => {});
}
function deleteFromCloud(factId: string): void {
  void import('../services/sync')
    .then((m) => m.deleteSelfFactFromCloud(factId))
    .catch(() => {});
}

/**
 * Categories help the diary / chat surface the right fact at the
 * right moment ("you love tuna" fits a food paragraph; "you hate the
 * vacuum" fits a stress moment). Free-form-ish but bounded so the
 * extractor can normalise.
 */
export type SelfFactCategory =
  | 'food'        // foods loved / hated
  | 'place'       // favourite spots, hated rooms
  | 'fear'        // things the cat is afraid of
  | 'love'        // people, objects, activities the cat loves
  | 'habit'       // recurring behaviours ("sleeps on the laptop after work")
  | 'history'     // past events ("rescued from the shelter at 8 weeks")
  | 'preference'  // softer preferences ("prefers the warm spot by the window")
  | 'other';

export type SelfFact = {
  /** Stable id, prefix `fact_`. */
  id: string;
  /** Owning cat. Each cat has its own fact set. */
  cat_id: string;

  /**
   * The fact, in first-person past/present from the cat's POV.
   * Examples: "I love tuna.", "I am afraid of the vacuum.",
   * "I sleep on the laptop after the human comes home."
   *
   * Stored already-normalised so we can render directly into prompts
   * and UI without further processing.
   */
  fact: string;

  category: SelfFactCategory;

  /**
   * How the fact entered the directory. Drives UI affordance:
   *   - `chat`   → small "the cat learned" chip below the chat turn
   *   - `manual` → user typed it on the Becoming screen
   *   - `auto`   → extracted from non-chat sources (future)
   */
  source: 'chat' | 'manual' | 'auto';

  /**
   * 0–1 confidence. user-asserted facts (chat / manual) start at 1.0;
   * auto-extracted facts start lower. Repeated assertions can lift
   * confidence (the user said it more than once → really true).
   */
  confidence: number;

  /** Optional source chat turn ID for traceability (extracted facts only). */
  source_turn_id?: string;

  /** ISO timestamps. */
  created_at: string;
  updated_at: string;
  /**
   * The number of times this fact has been asserted (from chat or
   * manual). Useful for ranking and confidence boosting — a fact the
   * user has stated three times across days deserves prime placement
   * in the diary prompt.
   */
  assertion_count: number;
};

const MAX_FACTS_PER_CAT = 80;

type State = {
  /** Per-cat self-facts. Keyed by cat_id; values are the cat's facts. */
  facts: Record<string, SelfFact[]>;

  /**
   * Add a fact (or merge if a near-duplicate already exists for the
   * same cat). Returns the resulting SelfFact (created or updated).
   * Dedup is on case-insensitive normalised text.
   */
  upsertFact: (input: {
    catId: string;
    fact: string;
    category: SelfFactCategory;
    source: SelfFact['source'];
    confidence?: number;
    sourceTurnId?: string;
  }) => SelfFact;

  /** Patch an existing fact (rename, recategorise). */
  patchFact: (
    catId: string,
    factId: string,
    patch: Partial<Pick<SelfFact, 'fact' | 'category'>>,
  ) => void;

  /** Delete a fact. Used by the user from the Becoming UI. */
  deleteFact: (catId: string, factId: string) => void;

  /** Read all facts for a cat, sorted by relevance (assertion_count desc). */
  getFactsForCat: (catId: string) => SelfFact[];

  /** GDPR / cat-removal sweep. */
  clearForCat: (catId: string) => void;
  clearAll: () => void;
};

function newFactId(): string {
  return `fact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalise(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function dedupKey(s: string): string {
  return normalise(s).toLowerCase().replace(/[.!?]+$/g, '');
}

const EMPTY_FACTS: SelfFact[] = Object.freeze([]) as never;

export const useSelfFactsStore = create<State>()(
  persist(
    (set, get) => ({
      facts: {},

      upsertFact: (input) => {
        const now = new Date().toISOString();
        const cleanFact = normalise(input.fact);
        if (!cleanFact) {
          throw new Error('Self-fact cannot be empty.');
        }
        const list = get().facts[input.catId] ?? [];
        const k = dedupKey(cleanFact);
        const existingIdx = list.findIndex((f) => dedupKey(f.fact) === k);

        if (existingIdx >= 0) {
          // Bump assertion count + confidence; don't replace the
          // wording (the original phrasing is what the cat
          // "remembers" — repeated assertions just reinforce it).
          const existing = list[existingIdx]!;
          const updated: SelfFact = {
            ...existing,
            // Allow recategorisation via repeated assertion (e.g.
            // initially marked 'preference', user clarifies it's
            // actually a 'fear').
            category: input.category,
            confidence: Math.min(
              1,
              Math.max(existing.confidence, input.confidence ?? existing.confidence),
            ),
            assertion_count: existing.assertion_count + 1,
            updated_at: now,
          };
          const nextList = [...list];
          nextList[existingIdx] = updated;
          set((s) => ({
            facts: { ...s.facts, [input.catId]: nextList },
          }));
          pushToCloud(updated);
          return updated;
        }

        // New fact — apply per-cat cap. When at cap, evict the
        // oldest LOW-confidence fact (or oldest overall if all are
        // user-asserted).
        let working = list;
        if (working.length >= MAX_FACTS_PER_CAT) {
          const sorted = [...working].sort((a, b) => {
            // Prefer to evict lower-confidence + lower-assertion
            // first, then older.
            const sa = a.confidence + a.assertion_count * 0.05;
            const sb = b.confidence + b.assertion_count * 0.05;
            if (sa !== sb) return sa - sb;
            return a.created_at.localeCompare(b.created_at);
          });
          working = sorted.slice(1); // drop the worst-ranked
        }

        const fresh: SelfFact = {
          id: newFactId(),
          cat_id: input.catId,
          fact: cleanFact,
          category: input.category,
          source: input.source,
          confidence: input.confidence ?? 1,
          ...(input.sourceTurnId ? { source_turn_id: input.sourceTurnId } : {}),
          created_at: now,
          updated_at: now,
          assertion_count: 1,
        };
        set((s) => ({
          facts: { ...s.facts, [input.catId]: [fresh, ...working] },
        }));
        pushToCloud(fresh);
        return fresh;
      },

      patchFact: (catId, factId, patch) => {
        let updated: SelfFact | null = null;
        set((s) => {
          const list = s.facts[catId] ?? [];
          const idx = list.findIndex((f) => f.id === factId);
          if (idx < 0) return s;
          const next = [...list];
          next[idx] = {
            ...next[idx]!,
            ...patch,
            ...(patch.fact ? { fact: normalise(patch.fact) } : {}),
            updated_at: new Date().toISOString(),
          };
          updated = next[idx]!;
          return { facts: { ...s.facts, [catId]: next } };
        });
        if (updated) pushToCloud(updated);
      },

      deleteFact: (catId, factId) => {
        set((s) => {
          const list = s.facts[catId] ?? [];
          return {
            facts: { ...s.facts, [catId]: list.filter((f) => f.id !== factId) },
          };
        });
        deleteFromCloud(factId);
      },

      getFactsForCat: (catId) => {
        const list = get().facts[catId] ?? [];
        return [...list].sort((a, b) => {
          // Sort by recency-weighted assertion count, then by
          // recency. Manually-entered facts get a small boost.
          const sa =
            a.assertion_count * a.confidence +
            (a.source === 'manual' ? 0.5 : 0);
          const sb =
            b.assertion_count * b.confidence +
            (b.source === 'manual' ? 0.5 : 0);
          if (sa !== sb) return sb - sa;
          return b.updated_at.localeCompare(a.updated_at);
        });
      },

      clearForCat: (catId) => {
        const idsToDelete = (get().facts[catId] ?? []).map((f) => f.id);
        set((s) => {
          const next = { ...s.facts };
          delete next[catId];
          return { facts: next };
        });
        for (const id of idsToDelete) deleteFromCloud(id);
      },

      clearAll: () => set({ facts: {} }),
    }),
    {
      name: 'catmd-self-facts',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

export function useSelfFactsForCat(catId: string | null | undefined): SelfFact[] {
  const facts = useSelfFactsStore((s) => s.facts);
  return useMemo(() => {
    if (!catId) return EMPTY_FACTS;
    const list = facts[catId];
    if (!list || list.length === 0) return EMPTY_FACTS;
    return [...list].sort((a, b) => {
      const sa =
        a.assertion_count * a.confidence + (a.source === 'manual' ? 0.5 : 0);
      const sb =
        b.assertion_count * b.confidence + (b.source === 'manual' ? 0.5 : 0);
      if (sa !== sb) return sb - sa;
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [facts, catId]);
}

/** Top-N facts for use in prompts. Same sorting as above. */
export function useTopSelfFactsForCat(
  catId: string | null | undefined,
  limit = 12,
): SelfFact[] {
  const all = useSelfFactsForCat(catId);
  return useMemo(() => all.slice(0, limit), [all, limit]);
}
