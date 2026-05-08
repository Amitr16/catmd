/**
 * World Memory store — per-cat registry of OBJECTS, PLACES, and TOYS
 * that exist in the cat's actual world.
 *
 * ── Why this exists ────────────────────────────────────────────────
 * Before this store, the cat would hallucinate details to make replies
 * feel grounded — "the cup is closer to the edge", "the radiator was
 * cold", "the green chair is still mine." None of those existed in
 * any data; the model produced them because they sounded plausible.
 *
 * Real cats reference real things. The user knows what their cat
 * actually has — the orange blanket, the cat tree by the window, the
 * garden, the tortoise across the road. World Memory is the registry
 * of those real items, fed into:
 *   - the chat prompt (so replies cite REAL objects, not invented ones)
 *   - the diary (so entries reference real surroundings)
 *   - the pinned-facts retrieval (so questions about objects/places
 *     pull the right entry)
 *
 * ── How entries land here (2026-05-05 pivot) ───────────────────────
 * Pre-pivot: the user typed entries into a form on /world. Friction.
 * Felt like work. Users didn't bother.
 *
 * Post-pivot: entries land SILENTLY from vision passes on photos and
 * behaviour-observation video frames. The user uploads pictures of
 * their cat → the model extracts objects/places/environment → recurring
 * sightings (≥2 in 30 days) graduate from `candidates` → visible
 * `entries`. The cat then references them in chat. The user thinks:
 * "wait, how does Lily know about the green chair?" — that's the magic.
 *
 * The chat-side LOG_OBJECT marker (see services/chat.ts) is the OTHER
 * input path: when the user themselves mentions a real object in
 * conversation, the model emits a marker and we add it directly as a
 * confirmed entry (skipping the candidate pool — the user's mention is
 * its own evidence).
 *
 * ── Distinction from subjectDirectoryStore ─────────────────────────
 * subjectDirectory = NAMED PEOPLE & PETS, primarily photo-tag driven
 * worldStore       = OBJECTS, PLACES, TOYS, FURNITURE, ENVIRONMENT —
 *                    primarily vision-derived (no manual entry form)
 *
 * Both feed the cat's memory; they're sibling tiers, not subtypes.
 *
 * ── Pattern ─────────────────────────────────────────────────────────
 * Zustand + AsyncStorage persist (same pattern as the rest of the
 * codebase). Per-mutation cloud sync via fire-and-forget helpers.
 * Stable-reference empty arrays for hook outputs.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { track } from '../services/analytics';

// Cloud sync — lazy-imported to avoid a circular dep at module-load
// (sync.ts imports WorldEntry from this file).
function pushToCloud(entry: WorldEntry): void {
  void import('../services/sync')
    .then((m) => m.syncWorldEntryToCloud(entry))
    .catch(() => {});
}
function deleteFromCloud(entryId: string): void {
  void import('../services/sync')
    .then((m) => m.deleteWorldEntryFromCloud(entryId))
    .catch(() => {});
}

/**
 * The kinds of world entries the cat can know about. Different from
 * SubjectKind which is for named beings (person, pet, other).
 *
 *   - object:      generic non-furniture thing ("the orange blanket")
 *   - furniture:   chair, table, bed, sofa, rug, cat tree
 *   - toy:         wand, mouse, laser, ball, scratching post
 *   - place:       room or location ("the garden", "the porch", "by the
 *                  kitchen window") — somewhere the cat goes or watches
 *   - environment: ephemeral world state ("snow today", "thunderstorm",
 *                  "the radiator just turned off") — meant to roll off,
 *                  lower priority in retention
 */
export type WorldKind = 'object' | 'furniture' | 'toy' | 'place' | 'environment';

/**
 * The cat's sentiment toward this thing. Drives the voice register
 * when the cat references it ("loves the green chair" → warm tone;
 * "fears the vacuum" → guarded tone).
 */
export type WorldSentiment =
  | 'loves'
  | 'likes'
  | 'curious'
  | 'tolerates'
  | 'dislikes'
  | 'fears';

export type WorldEntry = {
  /** Stable id, prefix `world_`. */
  id: string;
  /** Owning cat. Each cat has its own world. */
  cat_id: string;
  /**
   * Display name. For auto-detected entries this is the canonical
   * model-emitted phrase ("the green chair", "the garden"). For
   * user-mentioned entries (chat LOG_OBJECT marker) it's whatever
   * the user said, normalized. The article matters because the cat
   * references the entry verbatim — "the chair" reads differently
   * than "chair".
   */
  name: string;
  kind: WorldKind;

  // ── Optional descriptive fields ────────────────────────────────
  // All optional. Auto-detection fills these when vision can; chat-
  // derived entries might only have name + kind.

  /** Free-form description, ≤ 200 chars. */
  description?: string;
  /** Color hint, e.g. "green", "orange + cream stripe". */
  color?: string;
  /** Spatial hint, e.g. "by the window", "in the kitchen". */
  location?: string;
  /** How the cat feels about it. Drives reference tone. */
  sentiment?: WorldSentiment;
  /** When the cat got it / discovered it (ISO date). Used for "the
   *  new rug" framing in the diary or chat. */
  acquired_at?: string;

  // ── Provenance ─────────────────────────────────────────────────
  /**
   * How this entry landed in the store:
   *   - 'auto_detected' → vision pass on photo / video frames promoted
   *      a candidate after recurrence threshold met
   *   - 'chat_extracted' → user mentioned it in chat, cat-side
   *      LOG_OBJECT marker fired (high-confidence input)
   *   - 'user_added'    → legacy: user typed it into the now-removed
   *      AddEntryForm. Kept for migration; surfaced same as others.
   */
  source_type?: 'auto_detected' | 'chat_extracted' | 'user_added';
  /**
   * For auto-detected entries — number of distinct photo / video
   * sightings that contributed evidence. Used for the "X photos
   * contributed" chip on /world. ≥ recurrence threshold by definition.
   */
  evidence_count?: number;

  // ── Telemetry / prioritization ────────────────────────────────
  /** Last time this entry was used in a prompt (ISO ts). Lets the
   *  retrieval layer prefer fresh entries over stale ones. */
  last_referenced_at?: string;
  /** Total times referenced. Drives "your favourite chair" framing
   *  for high-reference entries. */
  reference_count: number;

  created_at: string;
  updated_at: string;
};

/**
 * A pending sighting from a vision pass. Lives in a candidate pool
 * separate from the visible `entries`. Promotes to a real WorldEntry
 * once `observation_count >= RECURRENCE_THRESHOLD` AND the spread
 * across observations is ≤ RECURRENCE_WINDOW_DAYS.
 *
 * Why the recurrence requirement: a one-off sighting could be a guest
 * cat's toy, a dog visiting from a friend's, a one-time prop in a
 * birthday photo. Two sightings in 30 days strongly suggests the item
 * actually lives in the cat's world. Cheaper than inventing fancy
 * confidence scoring — recurrence IS the confidence signal.
 *
 * `observations` is bounded — we only need a handful to make the
 * graduation decision. After promotion the candidate is deleted; the
 * resulting WorldEntry carries the evidence_count.
 */
export type WorldCandidate = {
  /** Stable id, prefix `worldcand_`. Local-only; never synced. */
  id: string;
  cat_id: string;
  /** Canonical name as observed (verbatim from vision). */
  name: string;
  /** Lowercased, article-stripped key used for dedup matching. */
  match_key: string;
  kind: WorldKind;
  description?: string;
  color?: string;
  location?: string;
  /** ISO timestamps of the observations, oldest → newest, capped at MAX_OBSERVATIONS_TRACKED. */
  observations: string[];
  /** Convenience cache of observations.length. */
  observation_count: number;
  first_observed_at: string;
  last_observed_at: string;
};

/**
 * A single observation extracted from a vision pass. The store batches
 * observations into the candidate pool and decides per-observation
 * whether to promote.
 */
export type WorldObservation = {
  name: string;
  kind: WorldKind;
  description?: string;
  color?: string;
  location?: string;
  /** ISO timestamp the observation was made (defaults to now). */
  observed_at?: string;
};

// Cap to keep the store bounded — power users could add hundreds of
// items, but the cat's prompt only has so much attention budget.
const MAX_ENTRIES_PER_CAT = 60;

/** Cap on the candidate pool — observations beyond this drop oldest first. */
const MAX_CANDIDATES_PER_CAT = 200;

/** Per-candidate cap on tracked observation timestamps. */
const MAX_OBSERVATIONS_TRACKED = 8;

/**
 * Threshold for graduating a candidate → visible WorldEntry. Two
 * sightings within RECURRENCE_WINDOW_DAYS strongly implies the item
 * lives in the cat's world (vs being a one-off prop in a single photo).
 *
 * Tuning notes:
 *   - 1 → too many false positives (every random object the model
 *     mentions in one photo becomes "the cat's world")
 *   - 2 → balance: catches the actual recurring fixtures (the chair,
 *     the rug, the food bowl) without surfacing one-off props
 *   - 3+ → too slow; users wouldn't see the magic for weeks
 */
const RECURRENCE_THRESHOLD = 2;
const RECURRENCE_WINDOW_DAYS = 30;

type State = {
  entriesByCat: Record<string, WorldEntry[]>;
  /** Candidate pool — silent, not user-visible. */
  candidatesByCat: Record<string, WorldCandidate[]>;

  // ── Selectors ──────────────────────────────────────────────────
  getEntriesForCat: (catId: string) => WorldEntry[];
  getEntryById: (catId: string, entryId: string) => WorldEntry | null;
  getCandidatesForCat: (catId: string) => WorldCandidate[];

  // ── Mutators ───────────────────────────────────────────────────
  addEntry: (entry: Omit<WorldEntry, 'id' | 'created_at' | 'updated_at' | 'reference_count'>) => WorldEntry;
  updateEntry: (entryId: string, fields: Partial<WorldEntry>) => void;
  removeEntry: (entryId: string) => void;
  /** Mark this entry as referenced — bumps last_referenced_at + count.
   *  Called by retrieval layer when an entry is pinned to a prompt. */
  markReferenced: (entryId: string) => void;

  /**
   * Submit a batch of vision-derived observations. Each one either:
   *   - merges into an existing visible entry (bumps evidence_count), or
   *   - merges into an existing candidate (extends observations[]) and
   *     promotes it if the recurrence threshold is now satisfied, or
   *   - creates a fresh candidate.
   *
   * Returns the count of entries that were freshly promoted on this
   * call so the caller can fire telemetry / surface the moment.
   */
  ingestObservations: (catId: string, observations: WorldObservation[]) => number;

  clearForCat: (catId: string) => void;
  clearAll: () => void;
};

function newId(): string {
  // Stable-enough random id — same shape as subject ids
  return `world_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function newCandidateId(): string {
  return `worldcand_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Normalize a raw observation name into a stable matching key. Strips
 * leading articles ("the ", "a ", "my ", "our "), lowercases, and
 * collapses whitespace. Used for de-dup against existing entries AND
 * candidates so "the green chair" and "Green chair" match.
 */
export function worldMatchKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(the|a|an|my|our)\s+/i, '')
    .replace(/\s+/g, ' ');
}

/**
 * Decide whether a candidate has enough recurrence to graduate. Two
 * sightings within RECURRENCE_WINDOW_DAYS = ready. Single sighting,
 * or sightings spread too far apart, = stay in candidate pool.
 *
 * The window check uses oldest vs newest; with low MAX_OBSERVATIONS_TRACKED
 * the oldest in the buffer is effectively a moving floor that re-resets
 * after enough fresh sightings push it out.
 */
function shouldPromote(candidate: WorldCandidate): boolean {
  if (candidate.observation_count < RECURRENCE_THRESHOLD) return false;
  if (candidate.observations.length === 0) return false;
  const oldest = Date.parse(candidate.observations[0]);
  const newest = Date.parse(candidate.observations[candidate.observations.length - 1]);
  if (!Number.isFinite(oldest) || !Number.isFinite(newest)) return false;
  const spreadDays = (newest - oldest) / 86400000;
  return spreadDays <= RECURRENCE_WINDOW_DAYS;
}

export const useWorldStore = create<State>()(
  persist(
    (set, get) => ({
      entriesByCat: {},
      candidatesByCat: {},

      getEntriesForCat: (catId) => get().entriesByCat[catId] ?? [],
      getEntryById: (catId, entryId) =>
        (get().entriesByCat[catId] ?? []).find((e) => e.id === entryId) ?? null,
      getCandidatesForCat: (catId) => get().candidatesByCat[catId] ?? [],

      addEntry: (input) => {
        const now = nowIso();
        const fresh: WorldEntry = {
          ...input,
          id: newId(),
          reference_count: 0,
          created_at: now,
          updated_at: now,
        };
        // Compute the entry that will actually land in the store, side
        // effects (pushToCloud) deferred until after set() returns so
        // we don't run them inside the state-update callback. The
        // resolved entry is what we return — accurate even when the
        // de-dup path merges into an existing row with the OLD id.
        let resolved: WorldEntry = fresh;
        set((s) => {
          const existing = s.entriesByCat[fresh.cat_id] ?? [];
          const dupIdx = existing.findIndex(
            (e) => e.name.toLowerCase().trim() === fresh.name.toLowerCase().trim(),
          );
          if (dupIdx >= 0) {
            // Merge into the existing row — preserve id, created_at,
            // and reference_count. updated_at refreshes.
            const merged: WorldEntry = {
              ...existing[dupIdx],
              ...input,
              id: existing[dupIdx].id,
              created_at: existing[dupIdx].created_at,
              reference_count: existing[dupIdx].reference_count,
              updated_at: now,
            };
            resolved = merged;
            const next = [...existing.slice(0, dupIdx), merged, ...existing.slice(dupIdx + 1)];
            return {
              entriesByCat: { ...s.entriesByCat, [fresh.cat_id]: next },
            };
          }
          resolved = fresh;
          const next = [fresh, ...existing].slice(0, MAX_ENTRIES_PER_CAT);
          return {
            entriesByCat: { ...s.entriesByCat, [fresh.cat_id]: next },
          };
        });
        // Side effect outside the set() callback — Zustand convention.
        pushToCloud(resolved);
        return resolved;
      },

      updateEntry: (entryId, fields) => {
        set((s) => {
          const updatedByCat: Record<string, WorldEntry[]> = {};
          let pushedEntry: WorldEntry | null = null;
          for (const [catId, list] of Object.entries(s.entriesByCat)) {
            const idx = list.findIndex((e) => e.id === entryId);
            if (idx < 0) {
              updatedByCat[catId] = list;
              continue;
            }
            const merged: WorldEntry = {
              ...list[idx],
              ...fields,
              id: list[idx].id, // never overwrite id
              cat_id: list[idx].cat_id, // never overwrite cat_id
              created_at: list[idx].created_at,
              updated_at: nowIso(),
            };
            updatedByCat[catId] = [...list.slice(0, idx), merged, ...list.slice(idx + 1)];
            pushedEntry = merged;
          }
          if (pushedEntry) pushToCloud(pushedEntry);
          return { entriesByCat: updatedByCat };
        });
      },

      removeEntry: (entryId) => {
        set((s) => {
          const updatedByCat: Record<string, WorldEntry[]> = {};
          for (const [catId, list] of Object.entries(s.entriesByCat)) {
            updatedByCat[catId] = list.filter((e) => e.id !== entryId);
          }
          return { entriesByCat: updatedByCat };
        });
        deleteFromCloud(entryId);
      },

      markReferenced: (entryId) => {
        // Lightweight bump. Called from the retrieval layer; we DON'T
        // push every reference to cloud (would be wasteful — this fires
        // on every chat turn). Cloud syncs on the next mutator that
        // actually changes user-visible fields.
        set((s) => {
          const updatedByCat: Record<string, WorldEntry[]> = {};
          for (const [catId, list] of Object.entries(s.entriesByCat)) {
            const idx = list.findIndex((e) => e.id === entryId);
            if (idx < 0) {
              updatedByCat[catId] = list;
              continue;
            }
            const bumped: WorldEntry = {
              ...list[idx],
              reference_count: list[idx].reference_count + 1,
              last_referenced_at: nowIso(),
            };
            updatedByCat[catId] = [...list.slice(0, idx), bumped, ...list.slice(idx + 1)];
          }
          return { entriesByCat: updatedByCat };
        });
      },

      ingestObservations: (catId, observations) => {
        if (!catId || observations.length === 0) return 0;
        const now = nowIso();
        let promotedCount = 0;
        const promotionsForTelemetry: Array<{ kind: WorldKind; obs: number }> = [];

        // Build the bulk update inside a single set() so ingestion is
        // atomic — no partial state visible to consumers if multiple
        // observations come in for the same name in the same call.
        let pendingPushes: WorldEntry[] = [];

        set((s) => {
          let entries = [...(s.entriesByCat[catId] ?? [])];
          let candidates = [...(s.candidatesByCat[catId] ?? [])];

          for (const obs of observations) {
            const cleanName = obs.name.trim();
            if (!cleanName || cleanName.length > 80) continue;
            const matchKey = worldMatchKey(cleanName);
            if (!matchKey) continue;
            const observedAt = obs.observed_at ?? now;

            // 1. Already a visible entry? Just bump evidence_count and
            //    refresh updated_at. Don't overwrite the user-edited
            //    name / sentiment — auto-detection is the floor, user
            //    edits are the ceiling.
            const entryIdx = entries.findIndex(
              (e) => worldMatchKey(e.name) === matchKey,
            );
            if (entryIdx >= 0) {
              const existing = entries[entryIdx]!;
              const merged: WorldEntry = {
                ...existing,
                // Fill empty optional fields opportunistically — don't
                // clobber user-set values.
                description: existing.description || obs.description,
                color: existing.color || obs.color,
                location: existing.location || obs.location,
                evidence_count: (existing.evidence_count ?? 0) + 1,
                updated_at: observedAt,
              };
              entries[entryIdx] = merged;
              pendingPushes.push(merged);
              continue;
            }

            // 2. Already a candidate? Push the observation, evict
            //    oldest beyond cap, evaluate promotion.
            const candIdx = candidates.findIndex((c) => c.match_key === matchKey);
            if (candIdx >= 0) {
              const cand = candidates[candIdx]!;
              const nextObservations = [...cand.observations, observedAt].slice(
                -MAX_OBSERVATIONS_TRACKED,
              );
              const updatedCand: WorldCandidate = {
                ...cand,
                description: cand.description || obs.description,
                color: cand.color || obs.color,
                location: cand.location || obs.location,
                observations: nextObservations,
                observation_count: nextObservations.length,
                last_observed_at: observedAt,
              };

              if (shouldPromote(updatedCand)) {
                // Graduate → real entry. Drop the candidate.
                candidates.splice(candIdx, 1);
                const promoted: WorldEntry = {
                  id: newId(),
                  cat_id: catId,
                  name: updatedCand.name,
                  kind: updatedCand.kind,
                  description: updatedCand.description,
                  color: updatedCand.color,
                  location: updatedCand.location,
                  source_type: 'auto_detected',
                  evidence_count: updatedCand.observation_count,
                  reference_count: 0,
                  created_at: updatedCand.first_observed_at,
                  updated_at: observedAt,
                };
                entries = [promoted, ...entries].slice(0, MAX_ENTRIES_PER_CAT);
                pendingPushes.push(promoted);
                promotedCount += 1;
                promotionsForTelemetry.push({
                  kind: promoted.kind,
                  obs: updatedCand.observation_count,
                });
              } else {
                candidates[candIdx] = updatedCand;
              }
              continue;
            }

            // 3. Brand-new sighting → fresh candidate.
            const fresh: WorldCandidate = {
              id: newCandidateId(),
              cat_id: catId,
              name: cleanName,
              match_key: matchKey,
              kind: obs.kind,
              description: obs.description,
              color: obs.color,
              location: obs.location,
              observations: [observedAt],
              observation_count: 1,
              first_observed_at: observedAt,
              last_observed_at: observedAt,
            };
            candidates = [fresh, ...candidates].slice(0, MAX_CANDIDATES_PER_CAT);

            // Edge case: a single sighting can promote IF the threshold
            // is set to 1 (it isn't today, but defensively support it).
            if (RECURRENCE_THRESHOLD <= 1 && shouldPromote(fresh)) {
              candidates = candidates.filter((c) => c.id !== fresh.id);
              const promoted: WorldEntry = {
                id: newId(),
                cat_id: catId,
                name: fresh.name,
                kind: fresh.kind,
                description: fresh.description,
                color: fresh.color,
                location: fresh.location,
                source_type: 'auto_detected',
                evidence_count: 1,
                reference_count: 0,
                created_at: observedAt,
                updated_at: observedAt,
              };
              entries = [promoted, ...entries].slice(0, MAX_ENTRIES_PER_CAT);
              pendingPushes.push(promoted);
              promotedCount += 1;
              promotionsForTelemetry.push({ kind: promoted.kind, obs: 1 });
            }
          }

          return {
            entriesByCat: { ...s.entriesByCat, [catId]: entries },
            candidatesByCat: { ...s.candidatesByCat, [catId]: candidates },
          };
        });

        // Side effects after set() returns — push to cloud + telemetry.
        for (const entry of pendingPushes) pushToCloud(entry);
        for (const p of promotionsForTelemetry) {
          track({
            type: 'world_entry_auto_promoted',
            props: { kind: p.kind, observations_at_promotion: p.obs },
          });
        }
        return promotedCount;
      },

      clearForCat: (catId) => {
        const list = get().entriesByCat[catId] ?? [];
        set((s) => {
          const nextEntries = { ...s.entriesByCat };
          delete nextEntries[catId];
          const nextCandidates = { ...s.candidatesByCat };
          delete nextCandidates[catId];
          return { entriesByCat: nextEntries, candidatesByCat: nextCandidates };
        });
        // Cloud cleanup — fire deletes per entry
        for (const e of list) deleteFromCloud(e.id);
      },

      clearAll: () => set({ entriesByCat: {}, candidatesByCat: {} }),
    }),
    {
      name: 'catmd-world',
      storage: createJSONStorage(() => AsyncStorage),
      // Bumped 1 → 2 alongside the candidate-pool addition. Migration
      // is forward-compatible: missing `candidatesByCat` defaults to {}
      // and existing user-added entries gain `source_type: 'user_added'`
      // implicitly via the schema (the optional field stays undefined,
      // and the UI treats undefined as 'user_added' for back-compat).
      version: 2,
      migrate: (persisted: unknown, fromVersion: number) => {
        const state =
          (persisted as Partial<{
            entriesByCat: Record<string, WorldEntry[]>;
            candidatesByCat: Record<string, WorldCandidate[]>;
          }>) ?? {};
        if (fromVersion < 2) {
          return {
            ...state,
            entriesByCat: state.entriesByCat ?? {},
            candidatesByCat: state.candidatesByCat ?? {},
          };
        }
        return state;
      },
    },
  ),
);

// ─── Stable-reference selector hook (avoids re-render loops) ──────────
const STABLE_EMPTY: WorldEntry[] = Object.freeze([]) as unknown as WorldEntry[];

/**
 * Hook returning the entries for a cat, with stable empty-array
 * fallback so React doesn't see a new reference on every render when
 * the cat has no world entries yet.
 */
export function useWorldEntries(catId: string | null | undefined): WorldEntry[] {
  const list = useWorldStore((s) => (catId ? s.entriesByCat[catId] : undefined));
  return useMemo(() => list ?? STABLE_EMPTY, [list]);
}

// ─── Convenience helpers used across the app ─────────────────────────

/** Group entries by kind for the world screen's section list. */
export function groupEntriesByKind(entries: WorldEntry[]): Record<WorldKind, WorldEntry[]> {
  const out: Record<WorldKind, WorldEntry[]> = {
    object: [],
    furniture: [],
    toy: [],
    place: [],
    environment: [],
  };
  for (const e of entries) {
    if (out[e.kind]) out[e.kind].push(e);
  }
  return out;
}

/** Pretty label for a WorldKind — used in UI section headers. */
export function worldKindLabel(kind: WorldKind): string {
  switch (kind) {
    case 'object': return 'Things';
    case 'furniture': return 'Furniture';
    case 'toy': return 'Toys';
    case 'place': return 'Places';
    case 'environment': return 'Today';
  }
}

/** Pretty label for a sentiment — used in UI + voice rendering. */
export function sentimentLabel(s: WorldSentiment | undefined): string | null {
  if (!s) return null;
  switch (s) {
    case 'loves': return 'loves';
    case 'likes': return 'likes';
    case 'curious': return 'is curious about';
    case 'tolerates': return 'tolerates';
    case 'dislikes': return 'dislikes';
    case 'fears': return 'fears';
  }
}
