/**
 * Subject Directory store — the per-cat "people & pets in this cat's
 * life" registry.
 *
 * ── Why this exists ────────────────────────────────────────────────
 * The diary is a journal. Journals are richer when they reference the
 * same recurring characters across days: "Bella was here again",
 * "Mom held me this morning", "haven't seen Grandma in a week."
 * Without a way to *track* those characters, the diary can only
 * describe what the cat itself did. With a directory, the diary
 * gains a cast.
 *
 * ── How it works ───────────────────────────────────────────────────
 * - Each cat has its own directory (different households, different
 *   people). Keyed by `cat_id`.
 * - Each directory entry is a named subject: a person, another pet,
 *   or "other" (e.g. a vet, a frequent visitor).
 * - When the user tags a face/subject in a photo, the tag is added
 *   to the photo (`PhotoStudioPhoto.subjects`) AND an appearance is
 *   recorded on the directory entry (`DirectoryEntry.appearances`).
 * - Directory entries grow over time: appearance count, first/last
 *   seen, recent photo refs, optional vibe blurb (lazy-LLM-summarised
 *   from accumulated context).
 *
 * ── Privacy ─────────────────────────────────────────────────────────
 * Directory data is local-only by design. Names of family members
 * are sensitive — we don't sync them to Supabase, don't include them
 * in PostHog event payloads, and don't ship them to any third party.
 * The diary prompt does include them (they're the whole point) but
 * the cat's diary entry is also kept local-by-default.
 *
 * ── Pattern ─────────────────────────────────────────────────────────
 * Zustand + AsyncStorage persist, version 1. Stable-reference empty
 * arrays for hook outputs (matches the rest of the codebase). Pure
 * synchronous mutators — async work (vision detection, LLM summary)
 * lives in services/subjects.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SubjectKind } from '../services/photoStudio';
import type { PersonDescription, PetDescription } from '../services/subjects';

// Cloud sync helpers — lazy-imported to avoid a circular dep
// (sync.ts imports DirectoryEntry from this file). Each push is
// fire-and-forget; errors are swallowed inside the helper.
function pushToCloud(entry: DirectoryEntry): void {
  void import('../services/sync')
    .then((m) => m.syncSubjectToCloud(entry))
    .catch(() => {});
}
function deleteFromCloud(subjectId: string): void {
  void import('../services/sync')
    .then((m) => m.deleteSubjectFromCloud(subjectId))
    .catch(() => {});
}

/**
 * One named subject in a cat's life. Person, other pet, or "other"
 * (vet, frequent visitor, etc.). Persisted locally.
 */
export type DirectoryEntry = {
  /** Stable id, prefix `subj_`. */
  id: string;
  /** Owning cat. Each cat has its own directory. */
  cat_id: string;
  /** Display name as the user typed it. */
  name: string;
  kind: SubjectKind;

  /**
   * Optional per-kind detail. For pets: species ("dog", "rabbit",
   * "another cat"). For people: relationship hint ("mom", "vet",
   * "neighbor"). Helps the diary mention them naturally.
   */
  species?: string;
  relationship?: string;

  /**
   * All appearances of this subject across the cat's photos. Newest
   * first. Capped at MAX_APPEARANCES_PER_SUBJECT (recent N) so the
   * directory doesn't bloat indefinitely; older counts roll into the
   * `total_appearances` integer.
   */
  appearances: AppearanceRef[];

  /**
   * Total appearance count, including older ones beyond the
   * `appearances` window. The list is the "recent" cache; this is
   * the lifetime number the diary uses ("appears 24 times").
   */
  total_appearances: number;

  /** First and last seen dates (YYYY-MM-DD). */
  first_seen: string;
  last_seen: string;

  /**
   * Optional cached LLM-summarised "vibe" — a short phrase capturing
   * how this subject typically appears with the cat. Used by the
   * diary as memory texture: "Bella, the small black dog who always
   * smells like wet grass." Refreshed when appearances accumulate.
   *
   * Computed lazily by services/subjects.ts:summariseSubject(); not
   * required for the directory to function.
   */
  vibe?: string;
  /** ISO timestamp of the last vibe refresh. */
  vibe_updated_at?: string;

  /**
   * Vision-derived rich description — the ~10-attribute snapshot
   * (age band, hair, eyewear, build, distinguishing features, etc.)
   * captured from the FIRST photo where this subject was tagged.
   * Used by services/subjects.ts:matchDetectedToDirectory() to
   * recognise the same person in future photos without face ML.
   *
   * Shape matches PersonDescription for kind='person', PetDescription
   * for kind='pet'. Undefined for legacy entries created before
   * this field existed and for kind='other'.
   *
   * NOTE: stored as captured. We do NOT update on every appearance —
   * descriptions are stable enough that the first one is the
   * canonical anchor. If the user notices the matching gets worse
   * (e.g. Mom dyed her hair), they can re-tag with a fresh photo
   * and the description gets refreshed via patchEntry.
   */
  canonical_description?: PersonDescription | PetDescription | null;

  /** ISO timestamps for ordering / debugging. */
  created_at: string;
  updated_at: string;
};

export type AppearanceRef = {
  /** Photo id from photoStudioStore. */
  photo_id: string;
  /** Photo's logical date (YYYY-MM-DD). */
  date: string;
  /** Free-text context from vision at tag time, e.g. "with Lily on the couch". */
  context?: string;
  /** ISO timestamp the appearance was recorded. */
  recorded_at: string;
};

const MAX_APPEARANCES_PER_SUBJECT = 50;

type State = {
  /** Per-cat directory. Keyed by cat_id; values are the cat's entries. */
  entries: Record<string, DirectoryEntry[]>;

  /**
   * Add or update a subject from a tag operation. If a directory
   * entry with the same `cat_id` + `name` (case-insensitive) already
   * exists, returns its id and pushes the appearance. Otherwise
   * creates a new entry and returns the new id. The caller (UI tag
   * sheet) uses the id to write the SubjectTag into the photo.
   */
  upsertFromTag: (input: {
    catId: string;
    name: string;
    kind: SubjectKind;
    species?: string;
    relationship?: string;
    photoId: string;
    photoDate: string;
    context?: string;
    /**
     * Optional rich description from vision — captured per-person
     * or per-pet on photo capture. Stored as canonical_description
     * on the directory entry the FIRST time the subject is tagged.
     * Subsequent tags don't overwrite (descriptions are anchors,
     * not running averages).
     */
    canonicalDescription?: PersonDescription | PetDescription | null;
  }) => DirectoryEntry;

  /**
   * Patch directory metadata (name, kind, species, vibe, etc.).
   * Used by the People & Pets screen for renames + the lazy vibe
   * summariser.
   */
  patchEntry: (
    catId: string,
    subjectId: string,
    patch: Partial<Pick<DirectoryEntry, 'name' | 'kind' | 'species' | 'relationship' | 'vibe' | 'vibe_updated_at'>>,
  ) => void;

  /**
   * Remove a single appearance ref (called when the user untags a
   * subject from a photo). Decrements total_appearances and updates
   * last_seen if the removed ref was the most recent. If
   * total_appearances drops to zero, the entry is removed entirely
   * (so an accidentally-tagged subject the user immediately untags
   * doesn't leave a ghost in the directory).
   */
  removeAppearance: (catId: string, subjectId: string, photoId: string) => void;

  /** Drop a directory entry entirely (and all its appearances). */
  deleteEntry: (catId: string, subjectId: string) => void;

  /** Read all directory entries for a cat, sorted by total_appearances desc. */
  getEntriesForCat: (catId: string) => DirectoryEntry[];

  /** Look up a single entry by id within a cat's directory. */
  getEntry: (catId: string, subjectId: string) => DirectoryEntry | null;

  /**
   * Find an entry by case-insensitive name match. Returns the first
   * match or null. Used by the tag sheet's autocomplete to dedupe
   * "Bella" / "bella" / " Bella " into one directory entry.
   */
  findByName: (catId: string, name: string) => DirectoryEntry | null;

  /** GDPR / cat-removal cleanup. */
  clearForCat: (catId: string) => void;
  clearAll: () => void;
};

function newSubjectId(): string {
  return `subj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normaliseName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function nameKey(s: string): string {
  return normaliseName(s).toLowerCase();
}

const EMPTY_ENTRIES: DirectoryEntry[] = Object.freeze([]) as never;

export const useSubjectDirectoryStore = create<State>()(
  persist(
    (set, get) => ({
      entries: {},

      upsertFromTag: (input) => {
        const now = new Date().toISOString();
        const cleanName = normaliseName(input.name);
        if (!cleanName) {
          throw new Error('Subject name cannot be empty.');
        }
        const list = get().entries[input.catId] ?? [];
        const existingIdx = list.findIndex(
          (e) => nameKey(e.name) === nameKey(cleanName),
        );

        const appearance: AppearanceRef = {
          photo_id: input.photoId,
          date: input.photoDate,
          ...(input.context ? { context: input.context } : {}),
          recorded_at: now,
        };

        if (existingIdx >= 0) {
          // Update existing — push appearance, refresh metadata.
          const existing = list[existingIdx]!;
          // Idempotent: if the same photo is already tagged with
          // this subject, no-op (don't double-count).
          const alreadyTagged = existing.appearances.some(
            (a) => a.photo_id === input.photoId,
          );
          if (alreadyTagged) {
            return existing;
          }
          const nextAppearances = [appearance, ...existing.appearances].slice(
            0,
            MAX_APPEARANCES_PER_SUBJECT,
          );
          const updated: DirectoryEntry = {
            ...existing,
            // Allow user-led corrections via the tag sheet (e.g. they
            // re-tag with a different kind/species).
            kind: input.kind,
            ...(input.species ? { species: input.species } : {}),
            ...(input.relationship ? { relationship: input.relationship } : {}),
            appearances: nextAppearances,
            total_appearances: existing.total_appearances + 1,
            last_seen:
              input.photoDate > existing.last_seen
                ? input.photoDate
                : existing.last_seen,
            first_seen:
              input.photoDate < existing.first_seen
                ? input.photoDate
                : existing.first_seen,
            // Backfill canonical_description if the existing entry
            // doesn't have one yet AND the new tag carries one.
            // Doesn't overwrite an existing description — first one
            // wins as the stable anchor.
            ...(!existing.canonical_description && input.canonicalDescription
              ? { canonical_description: input.canonicalDescription }
              : {}),
            updated_at: now,
          };
          const nextList = [...list];
          nextList[existingIdx] = updated;
          set((s) => ({
            entries: { ...s.entries, [input.catId]: nextList },
          }));
          pushToCloud(updated);
          return updated;
        }

        // Create new entry. canonical_description is set ONLY on
        // initial creation — not overwritten on subsequent tags.
        // Stored as a stable identity anchor for cross-photo matching.
        const fresh: DirectoryEntry = {
          id: newSubjectId(),
          cat_id: input.catId,
          name: cleanName,
          kind: input.kind,
          ...(input.species ? { species: input.species } : {}),
          ...(input.relationship ? { relationship: input.relationship } : {}),
          appearances: [appearance],
          total_appearances: 1,
          first_seen: input.photoDate,
          last_seen: input.photoDate,
          ...(input.canonicalDescription
            ? { canonical_description: input.canonicalDescription }
            : {}),
          created_at: now,
          updated_at: now,
        };
        set((s) => ({
          entries: {
            ...s.entries,
            [input.catId]: [fresh, ...list],
          },
        }));
        pushToCloud(fresh);
        return fresh;
      },

      patchEntry: (catId, subjectId, patch) => {
        let updated: DirectoryEntry | null = null;
        set((s) => {
          const list = s.entries[catId] ?? [];
          const idx = list.findIndex((e) => e.id === subjectId);
          if (idx < 0) return s;
          const next = [...list];
          next[idx] = {
            ...next[idx]!,
            ...patch,
            // Normalise the name if it's being patched.
            ...(patch.name ? { name: normaliseName(patch.name) } : {}),
            updated_at: new Date().toISOString(),
          };
          updated = next[idx]!;
          return { entries: { ...s.entries, [catId]: next } };
        });
        if (updated) pushToCloud(updated);
      },

      removeAppearance: (catId, subjectId, photoId) => {
        let updated: DirectoryEntry | null = null;
        let removedSubjectId: string | null = null;
        set((s) => {
          const list = s.entries[catId] ?? [];
          const idx = list.findIndex((e) => e.id === subjectId);
          if (idx < 0) return s;
          const existing = list[idx]!;
          const wasTagged = existing.appearances.some(
            (a) => a.photo_id === photoId,
          );
          if (!wasTagged) return s;
          const filtered = existing.appearances.filter(
            (a) => a.photo_id !== photoId,
          );
          const nextTotal = Math.max(0, existing.total_appearances - 1);

          // If the subject has no appearances left, remove the entry
          // outright. This is the "user accidentally tagged Mom and
          // immediately untagged" path — don't leave a ghost.
          if (nextTotal === 0 && filtered.length === 0) {
            const without = list.filter((_, i) => i !== idx);
            removedSubjectId = subjectId;
            return { entries: { ...s.entries, [catId]: without } };
          }

          // Recompute last_seen from remaining appearances. first_seen
          // stays as-is (earliest historical sighting still counts).
          const newLastSeen =
            filtered.length > 0
              ? filtered.reduce(
                  (max, a) => (a.date > max ? a.date : max),
                  filtered[0]!.date,
                )
              : existing.last_seen;
          const next = [...list];
          next[idx] = {
            ...existing,
            appearances: filtered,
            total_appearances: nextTotal,
            last_seen: newLastSeen,
            updated_at: new Date().toISOString(),
          };
          updated = next[idx]!;
          return { entries: { ...s.entries, [catId]: next } };
        });
        if (removedSubjectId) deleteFromCloud(removedSubjectId);
        else if (updated) pushToCloud(updated);
      },

      deleteEntry: (catId, subjectId) => {
        set((s) => {
          const list = s.entries[catId] ?? [];
          const next = list.filter((e) => e.id !== subjectId);
          return { entries: { ...s.entries, [catId]: next } };
        });
        deleteFromCloud(subjectId);
      },

      getEntriesForCat: (catId) => {
        const list = get().entries[catId] ?? [];
        return [...list].sort(
          (a, b) => b.total_appearances - a.total_appearances,
        );
      },

      getEntry: (catId, subjectId) => {
        const list = get().entries[catId] ?? [];
        return list.find((e) => e.id === subjectId) ?? null;
      },

      findByName: (catId, name) => {
        const k = nameKey(name);
        if (!k) return null;
        const list = get().entries[catId] ?? [];
        return list.find((e) => nameKey(e.name) === k) ?? null;
      },

      clearForCat: (catId) => {
        // Capture ids before mutating so we can delete each from cloud
        // after the local wipe. Cloud cascade fires anyway when the cat
        // is deleted via deleteCatFromCloud (FK ON DELETE CASCADE), but
        // explicit per-row deletes keep the data consistent when this
        // helper is called for non-deletion reasons.
        const idsToDelete = (get().entries[catId] ?? []).map((e) => e.id);
        set((s) => {
          const next = { ...s.entries };
          delete next[catId];
          return { entries: next };
        });
        for (const id of idsToDelete) deleteFromCloud(id);
      },

      clearAll: () => set({ entries: {} }),
    }),
    {
      name: 'catmd-subject-directory',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

/**
 * All directory entries for a cat, sorted by total_appearances desc.
 * Stable-reference output for empty case to avoid Zustand re-render
 * loops (see diaryStore for the same pattern).
 */
export function useSubjectsForCat(
  catId: string | null | undefined,
): DirectoryEntry[] {
  const entries = useSubjectDirectoryStore((s) => s.entries);
  return useMemo(() => {
    if (!catId) return EMPTY_ENTRIES;
    const list = entries[catId];
    if (!list || list.length === 0) return EMPTY_ENTRIES;
    return [...list].sort(
      (a, b) => b.total_appearances - a.total_appearances,
    );
  }, [entries, catId]);
}

/**
 * Top-N most-frequent subjects, used by the tag sheet for the
 * quick-tap autocomplete chips.
 */
export function useTopSubjectsForCat(
  catId: string | null | undefined,
  limit = 5,
): DirectoryEntry[] {
  const all = useSubjectsForCat(catId);
  return useMemo(() => all.slice(0, limit), [all, limit]);
}

/**
 * Subjects seen in the last `days` days, sorted by recency. Powers
 * the diary's `recurring_subjects` memory tier.
 */
export function useRecentSubjectsForCat(
  catId: string | null | undefined,
  days = 30,
): DirectoryEntry[] {
  const all = useSubjectsForCat(catId);
  return useMemo(() => {
    if (all.length === 0) return EMPTY_ENTRIES;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    return all.filter((e) => e.last_seen >= cutoffKey);
  }, [all, days]);
}

// ---------------------------------------------------------------------------
// Defensive guard against the cat-as-its-own-subject identity bug
// (see diary screenshot 2026-05-07: "Even Lily, the other creature of
// the household, seemed intrigued by my prowess").
//
// Root cause: when the user tags a photo of their cat using
// SubjectTagSheet, they CAN type the cat's own name, which creates a
// directory entry for the active cat. Downstream prompts then render
// the active cat as a "person/pet you know" — and the LLM dutifully
// treats them as a separate household member, breaking first-person
// voice.
//
// The right long-term fix is to block tagging the active cat at the
// SubjectTagSheet level. But that doesn't help users who already
// have polluted directories. This filter is a belt-and-braces fix at
// every LLM-render boundary that consumes the directory: chat,
// diary, weekly reading, anywhere else.
//
// Match is case-insensitive, trimmed, exact. We deliberately don't
// fuzzy-match (e.g. "Lily" vs "Lils") — directory tagging is
// user-typed and the cat's own name is the obvious conflict; richer
// matching would risk dropping a real subject who happens to share
// part of the cat's name.
// ---------------------------------------------------------------------------

/**
 * Filter out any directory entry whose name matches the active cat's
 * name. Pure / sync — call this immediately before passing the list
 * into a chat / diary / reading prompt builder.
 *
 * Generic so it works on the raw `DirectoryEntry` shape AND on the
 * shapes downstream call sites map to (e.g. chat.ts builds a
 * lighter `{ name, kind, ... }` projection).
 */
export function filterOutActiveCat<T extends { name: string }>(
  entries: T[],
  activeCatName: string | null | undefined,
): T[] {
  const guard = (activeCatName ?? '').toLowerCase().trim();
  if (!guard) return entries;
  return entries.filter((e) => e.name.toLowerCase().trim() !== guard);
}
