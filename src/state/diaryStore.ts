/**
 * Diary store — caches generated diary entries per cat per day.
 *
 * Cache key: `${catId}:${YYYY-MM-DD}`. Idempotent — if today's entry is
 * already cached, the screen renders it without regenerating. User can
 * force-regenerate via a "rewrite" button (costs a fresh LLM call).
 *
 * Generation lives in `services/diary.ts`. The store is a thin Zustand
 * persist layer + a `generateForToday(catId)` async action that wires
 * service → cache.
 *
 * Storage: AsyncStorage (same pattern as other stores). Entries persist
 * across launches so users have a real archive.
 */
import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  buildDeepContext,
  daysSinceLastActivity,
  generateDeepDiaryEntry,
  generateEmptyDayEntry,
  isReadyForEmptyDayEntries,
  pickCatVoiceHighlight,
  todayKey,
  type DiaryEntry,
} from '../services/diary';
import { useCatStore } from './catStore';
import { useHealthStore } from './healthStore';
import { useScanStore } from './scanStore';
import { usePersonalityStore } from './personalityStore';
import { usePhotoStudioStore } from './photoStudioStore';
import { useChatStore } from './chatStore';
import { useNotifPrefsStore } from './notifPrefsStore';
import { hasEnoughDataForReveal } from '../services/personality';
import {
  cancelNotification,
  setCatVoiceEveningPush,
} from '../services/notifications';
import { track } from '../services/analytics';

const MAX_CACHED_ENTRIES_PER_CAT = 365; // one year — Pro archive scope

type State = {
  /** Cache: key = `${catId}:${YYYY-MM-DD}` */
  entries: Record<string, DiaryEntry>;
  /** Whether a generation is currently in flight per cat. UI uses this for spinners. */
  generating: Record<string, boolean>;
  /**
   * Last-viewed date (YYYY-MM-DD) per cat. Used to compute the
   * "X new entries since you last visited" tab badge — every time the
   * user opens the diary screen we update this to today, then use the
   * stored value to count entries with date > lastViewed.
   */
  lastViewed: Record<string, string>;

  /**
   * Generate today's entry for the cat.
   *
   *   - If already cached AND not forced, returns the cached entry.
   *   - If `requireMaterial` is true AND today has no material AND
   *     the cat is NOT yet ready for empty-day entries (less than
   *     7 distinct activity-days), returns null.
   *   - If today has no material BUT the cat IS ready for empty-day
   *     entries, generates a short melancholic-aristocratic entry.
   *   - Otherwise calls the LLM with deep context (memory tiers,
   *     anticipations, life events) and caches.
   *
   * Throws on AI errors — caller catches and shows a retry CTA.
   */
  generateForToday: (
    catId: string,
    opts?: { force?: boolean; requireMaterial?: boolean },
  ) => Promise<DiaryEntry | null>;

  /**
   * Generate (or fetch cached) entry for a SPECIFIC date. Used by
   * `backfillMissingEntries` to fill gaps after the user comes back
   * from a multi-day absence. Idempotent — won't regenerate if cached.
   * Past-date generation skips today-specific data (no check-in, no
   * scans for that exact date — only memory + tier-2 landmarks).
   */
  generateForDate: (catId: string, dateKey: string) => Promise<DiaryEntry | null>;

  /**
   * Backfill diary entries for any missed days since the last cached
   * entry, up to and INCLUDING yesterday. Today is excluded — handled
   * by `generateForToday` (or the 7pm cron). Idempotent — only writes
   * dates that don't have entries yet. Designed to fire on app boot.
   */
  backfillMissingEntries: (catId: string) => Promise<{
    written: number;
    emptyDays: number;
    populatedDays: number;
  }>;

  /** Read cached entry for a specific date (YYYY-MM-DD). Null if not generated yet. */
  getEntryForDate: (catId: string, dateKey: string) => DiaryEntry | null;

  /** Read cached today's entry without generating. */
  getTodaysEntry: (catId: string) => DiaryEntry | null;

  /** All entries for a cat, newest first. Useful for the archive list. */
  getEntriesForCat: (catId: string) => DiaryEntry[];

  /**
   * Mark the diary as viewed up to today. Called when the user opens
   * the diary screen. Resets the unread count to 0.
   */
  markViewed: (catId: string) => void;

  /** Count of entries with date > lastViewed. Drives the tab badge. */
  getUnreadCount: (catId: string) => number;

  /** GDPR + cat removal cleanup. */
  clearForCat: (catId: string) => void;
  clearAll: () => void;
};

function entryKey(catId: string, date: string): string {
  return `${catId}:${date}`;
}

/**
 * Internal helper — builds the deep context + dispatches to the
 * appropriate generator (populated vs empty day). Shared by
 * `generateForToday` and `generateForDate` so both code paths benefit
 * from memory tiers, mood arcs, anticipation, etc.
 */
async function buildAndGenerate(opts: {
  catId: string;
  targetDate: string;
  isToday: boolean;
  forceMaterial?: boolean;
  allCachedEntries: DiaryEntry[];
}): Promise<DiaryEntry | null> {
  const { catId, targetDate, isToday, forceMaterial, allCachedEntries } = opts;

  const cat = useCatStore.getState().cats.find((c) => c.id === catId);
  if (!cat) throw new Error('No active cat');

  const events = useHealthStore.getState().events;
  const scans = useScanStore.getState().scans;
  const streakDays = countCheckinStreak(events, catId);

  const personalityProfile = usePersonalityStore.getState().getProfile(catId);
  const archetype =
    personalityProfile && hasEnoughDataForReveal(personalityProfile)
      ? personalityProfile.archetype
      : null;

  const todayKeyLocal = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const galleryPhotosToday = isToday
    ? usePhotoStudioStore
        .getState()
        .getPhotosForDate(catId, todayKeyLocal)
        .map((p) => ({ uri: p.uri, added_at: p.added_at }))
    : [];
  const chatTurnsToday = isToday
    ? (useChatStore.getState().threads[catId] ?? []).map((t) => ({
        role: t.role,
        content: t.content,
        created_at: t.created_at,
      }))
    : [];

  // Gallery dates across all time (for empty-day floor + days-since-active)
  const allGalleryPhotos = usePhotoStudioStore.getState().getPhotosForCat(catId);
  const allGalleryPhotoDates = allGalleryPhotos.map((p) => p.date);

  // Recent absence themes — pull from cached entries' empty_day_theme
  const recentAbsenceThemes = allCachedEntries
    .filter((e) => e.cat_id === catId && e.empty_day_theme)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((e) => e.empty_day_theme!)
    .filter(Boolean);

  // Subject directory — people & pets tagged in this cat's photos.
  // We pass the raw entries to buildDeepContext, which handles the
  // today / recurring split. Lazy-import the store to keep the
  // diaryStore importable in test contexts where the directory
  // store may not be initialised yet.
  //
  // Defensive identity-bug guard: filter out any directory entry that
  // matches the active cat's own name BEFORE projecting. Without this,
  // a user who tags photos of their own cat as a subject causes the
  // diary prompt to render the active cat as a "person/pet you know"
  // — and the model writes the cat in third person ("Even Lily, the
  // other creature of the household, seemed intrigued..."). See bug
  // surfaced 2026-05-07. Block-at-source lives in SubjectTagSheet;
  // this filter is belt-and-braces for already-polluted directories.
  const { useSubjectDirectoryStore, filterOutActiveCat } =
    await import('./subjectDirectoryStore');
  const rawDirectoryEntries = useSubjectDirectoryStore
    .getState()
    .getEntriesForCat(catId);
  const directoryEntries = filterOutActiveCat(rawDirectoryEntries, cat.name)
    .map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      ...(e.species ? { species: e.species } : {}),
      ...(e.relationship ? { relationship: e.relationship } : {}),
      total_appearances: e.total_appearances,
      last_seen: e.last_seen,
      appearances: e.appearances.map((a) => ({
        photo_id: a.photo_id,
        date: a.date,
      })),
      ...(e.vibe ? { vibe: e.vibe } : {}),
    }));

  // Today's photo ids — used to compute `subjectsToday` precisely
  // (which subjects appear in TODAY's tagged photos, not just
  // last_seen=today). For backfilled past dates, we resolve the
  // target date's photos similarly. We pull fresh from the photo
  // store (the `galleryPhotosToday` projection above only carries
  // uri+added_at, not the photo id we need for matching against
  // directory appearance refs).
  const todaysPhotoIds = usePhotoStudioStore
    .getState()
    .getPhotosForDate(catId, targetDate)
    .map((p) => p.id);

  // Becoming milestone — derive the cat's current 7-facet snapshot
  // and check whether it crossed into a new diary-hookable stage
  // since the last observation. Only fires once per (facet, stage)
  // crossing — the becoming store tracks consumed milestones.
  let becomingMilestone: { facet: string; stage: string; diaryHook: string } | null = null;
  if (isToday) {
    try {
      const { deriveBecoming, snapshotStages } = await import('../services/becoming');
      const { useBecomingStore, milestoneKey } = await import('./becomingStore');
      const { useChatStore } = await import('./chatStore');
      const becomingStore = useBecomingStore.getState();
      const previousStages = becomingStore.getLastStages(catId);

      // Inputs for the derivation. Reuse what we've already computed
      // where possible to avoid double work.
      const photoCount = (usePhotoStudioStore.getState().photos[catId] ?? []).length;
      const chatTurnCount = (useChatStore.getState().threads[catId] ?? []).length;
      const bodyLanguageSessionCount = events.filter(
        (e) => e.cat_id === catId && e.type === 'behavior_observation',
      ).length;
      const namedSubjectsCount = directoryEntries.length;

      // Personality answered? Lazy import the store.
      const { usePersonalityStore } = await import('./personalityStore');
      const personalityArchetypeSet =
        !!usePersonalityStore.getState().quizAnswers[catId];

      const becoming = deriveBecoming({
        photoCount,
        chatTurnCount,
        bodyLanguageSessionCount,
        checkinStreak: streakDays,
        namedSubjectsCount,
        personalityArchetypeSet,
        diaryEntryCount: allCachedEntries.filter((e) => e.cat_id === catId).length,
        previousStages,
      });

      // Persist the snapshot so the next call can detect crossings.
      becomingStore.setLastStages(catId, snapshotStages(becoming));

      if (becoming.milestoneToday) {
        const key = milestoneKey(
          becoming.milestoneToday.facet,
          becoming.milestoneToday.stage,
        );
        if (!becomingStore.hasConsumedMilestone(catId, key)) {
          becomingStore.markMilestoneConsumed(catId, key);
          becomingMilestone = {
            facet: becoming.milestoneToday.facet,
            stage: becoming.milestoneToday.stage,
            diaryHook: becoming.milestoneToday.diaryHook,
          };
        }
      }
    } catch (e) {
      console.warn('[diary] becoming milestone derivation failed:', e);
    }
  }

  // Self-facts — durable cat self-knowledge. Lazy import to keep
  // the diaryStore importable in test contexts.
  const { useSelfFactsStore } = await import('./selfFactsStore');
  const selfFactsRaw = useSelfFactsStore
    .getState()
    .getFactsForCat(catId)
    .slice(0, 12);
  const selfFacts = selfFactsRaw.map((f) => ({
    fact: f.fact,
    category: String(f.category),
    assertion_count: f.assertion_count,
  }));

  const deep = buildDeepContext({
    cat,
    events,
    scans,
    streakDays,
    galleryPhotosToday,
    chatTurnsToday,
    allCachedEntries,
    targetDate,
    allGalleryPhotoDates,
    recentAbsenceThemes,
    directoryEntries,
    todaysPhotoIds,
    becomingMilestone,
    selfFacts,
  });

  // EMPTY-DAY PATH — only fires when:
  //   1. The day has no material activity, AND
  //   2. We're generating for today (past empty days are just blanks),
  //   3. The cat is "ready" (≥7 distinct activity-days lifetime — so
  //      brand-new users don't get melancholic entries before the
  //      relationship is real),
  //   4. forceMaterial is not requested (user didn't manually demand
  //      a populated entry).
  if (deep.isEmptyDay) {
    const ready = isReadyForEmptyDayEntries({
      catId,
      events,
      scans,
      galleryPhotoDates: allGalleryPhotoDates,
    });
    if (!ready || forceMaterial) {
      // Not ready — skip silently (no entry).
      return null;
    }
    return generateEmptyDayEntry({ cat, deep, archetype });
  }

  return generateDeepDiaryEntry({ cat, deep, archetype });
}

export const useDiaryStore = create<State>()(
  persist(
    (set, get) => ({
      entries: {},
      generating: {},
      lastViewed: {},

      generateForToday: async (catId, opts = {}) => {
        const force = !!opts.force;
        // requireMaterial — when true and the day has no material, we
        // either skip (cat not yet ready for empty-day entries) OR
        // generate an empty-day melancholic entry. When false (user
        // manual rewrite), we always go through the populated path.
        const requireMaterial = opts.requireMaterial !== false;
        const today = todayKey();
        const key = entryKey(catId, today);

        if (!force) {
          const cached = get().entries[key];
          if (cached) return cached;
        }

        set((s) => ({ generating: { ...s.generating, [catId]: true } }));

        try {
          const allCached = Object.values(get().entries);
          const entry = await buildAndGenerate({
            catId,
            targetDate: today,
            isToday: true,
            forceMaterial: !requireMaterial,
            allCachedEntries: allCached,
          });

          if (!entry) return null;

          set((s) => {
            const next = { ...s.entries, [entryKey(catId, entry.date)]: entry };
            const forCat = Object.entries(next)
              .filter(([k]) => k.startsWith(`${catId}:`))
              .sort(([a], [b]) => b.localeCompare(a));
            if (forCat.length > MAX_CACHED_ENTRIES_PER_CAT) {
              for (const [oldKey] of forCat.slice(MAX_CACHED_ENTRIES_PER_CAT)) {
                delete next[oldKey];
              }
            }
            return { entries: next };
          });

          // Cloud backup — fire and forget, errors logged inside helper.
          // DiaryEntry has no `id` field; we synthesise a stable composite
          // key (cat_id + date) so the same entry upserts in place across
          // regenerations. Same for facets_referenced (not in the type).
          void import('../services/sync').then(({ syncDiaryEntryToCloud }) =>
            syncDiaryEntryToCloud({
              id: `diary:${entry.cat_id}:${entry.date}`,
              cat_id: entry.cat_id,
              date: entry.date,
              generated_at: entry.generated_at,
              entry: entry.entry,
              mood_word: entry.mood_word,
              is_empty_day: entry.is_empty_day,
            }).catch(() => {}),
          );

          track({
            type: 'diary_entry_generated',
            props: {
              is_empty_day: !!entry.is_empty_day,
              had_photo: !!entry.photo_uri,
              forced_rewrite: force,
              referenced_past_date: entry.referenced_past_date ?? null,
            },
          });

          // Cat-voice evening push: pull a punchy 1-liner from the
          // freshly-written diary and re-arm the 19:00 push. Best-
          // effort: failure here doesn't block the entry from
          // landing. See marketing/chat-as-viral-lever.md §2 — the
          // lock-screen push doubles as shareable content.
          void (async () => {
            try {
              const prefs = useNotifPrefsStore.getState();
              if (!prefs.enabled.cat_voice_evening) return;
              const cat = useCatStore
                .getState()
                .cats.find((c) => c.id === catId);
              if (!cat) return;
              const oneLiner = pickCatVoiceHighlight(entry);
              if (!oneLiner) return;
              const oldId = prefs.getScheduledId(
                catId,
                'cat_voice_evening',
              );
              await cancelNotification(oldId);
              const newId = await setCatVoiceEveningPush({
                catName: cat.name,
                catId,
                oneLiner,
              });
              prefs.setScheduledId(catId, 'cat_voice_evening', newId);
              track({
                type: 'cat_voice_push_armed',
                props: { length: oneLiner.length },
              });
            } catch (e) {
              console.warn('[Diary] cat-voice push schedule failed:', e);
            }
          })();

          return entry;
        } catch (e) {
          track({
            type: 'diary_entry_generation_failed',
            props: {
              reason: (e instanceof Error ? e.message : 'unknown').slice(0, 200),
              forced_rewrite: force,
            },
          });
          throw e;
        } finally {
          set((s) => {
            const generating = { ...s.generating };
            delete generating[catId];
            return { generating };
          });
        }
      },

      generateForDate: async (catId, dateKey) => {
        const key = entryKey(catId, dateKey);
        const cached = get().entries[key];
        if (cached) return cached;

        const today = todayKey();
        const isToday = dateKey === today;

        set((s) => ({ generating: { ...s.generating, [catId]: true } }));

        try {
          const allCached = Object.values(get().entries);
          const entry = await buildAndGenerate({
            catId,
            targetDate: dateKey,
            isToday,
            allCachedEntries: allCached,
          });

          if (!entry) return null;

          set((s) => {
            const next = { ...s.entries, [entryKey(catId, entry.date)]: entry };
            const forCat = Object.entries(next)
              .filter(([k]) => k.startsWith(`${catId}:`))
              .sort(([a], [b]) => b.localeCompare(a));
            if (forCat.length > MAX_CACHED_ENTRIES_PER_CAT) {
              for (const [oldKey] of forCat.slice(MAX_CACHED_ENTRIES_PER_CAT)) {
                delete next[oldKey];
              }
            }
            return { entries: next };
          });

          return entry;
        } finally {
          set((s) => {
            const generating = { ...s.generating };
            delete generating[catId];
            return { generating };
          });
        }
      },

      backfillMissingEntries: async (catId) => {
        // Find the most-recent cached entry. Backfill from THERE up
        // to (and including) yesterday. Today is included ONLY when the
        // local clock is past the 19:00 "writing hour" — this is the
        // silent-generate-then-notify substitute for true OS background
        // tasks. When the user opens the app at any point after 7pm,
        // today's entry is generated in the background as part of this
        // backfill, so when they tap the 7pm notification (or open the
        // diary screen later), the entry is already cached and renders
        // instantly. Before 7pm, today is excluded — generateForToday
        // handles fresh generation on screen-mount.
        const all = get().entries;
        const forCat = Object.values(all)
          .filter((e) => e.cat_id === catId)
          .sort((a, b) => b.date.localeCompare(a.date));
        const mostRecentCachedDate = forCat[0]?.date ?? null;

        // Determine the start date for backfill. If no cached entries
        // exist at all, look back at most 14 days (don't backfill years
        // of empty entries on first install). If cached entries exist,
        // start from the day AFTER the most recent.
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // The "writing hour" threshold — past this, today's entry is
        // considered eligible for silent pre-generation.
        const DIARY_WRITING_HOUR = 19;
        const includeToday = today.getHours() >= DIARY_WRITING_HOUR;
        const endDate = includeToday ? today : yesterday;

        let startDate: Date;
        if (mostRecentCachedDate) {
          startDate = new Date(`${mostRecentCachedDate}T12:00:00`);
          startDate.setDate(startDate.getDate() + 1);
        } else {
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 14);
        }

        const dates: string[] = [];
        const cursor = new Date(startDate);
        while (cursor <= endDate && dates.length < 30) {
          const y = cursor.getFullYear();
          const m = String(cursor.getMonth() + 1).padStart(2, '0');
          const d = String(cursor.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${d}`);
          cursor.setDate(cursor.getDate() + 1);
        }

        let written = 0;
        let emptyDays = 0;
        let populatedDays = 0;

        for (const dk of dates) {
          // Skip if already cached
          if (get().entries[entryKey(catId, dk)]) continue;
          try {
            const entry = await get().generateForDate(catId, dk);
            if (!entry) continue;
            written += 1;
            if (entry.is_empty_day) emptyDays += 1;
            else populatedDays += 1;
          } catch (e) {
            // Best-effort; failures don't break the whole backfill
            console.warn(`[CatMD] backfill failed for ${dk}:`, e);
          }
        }

        if (written > 0) {
          track({
            type: 'diary_backfill_completed',
            props: {
              days_written: written,
              empty_days: emptyDays,
              populated_days: populatedDays,
            },
          });
        }

        return { written, emptyDays, populatedDays };
      },

      markViewed: (catId) =>
        set((s) => ({
          lastViewed: { ...s.lastViewed, [catId]: todayKey() },
        })),

      getUnreadCount: (catId) => {
        const lastViewed = get().lastViewed[catId];
        if (!lastViewed) {
          // Never viewed — count all entries (capped at the recent window
          // so a brand-new user with old cached entries doesn't see "47 unread").
          return Object.values(get().entries).filter(
            (e) => e.cat_id === catId,
          ).length;
        }
        return Object.values(get().entries).filter(
          (e) => e.cat_id === catId && e.date > lastViewed,
        ).length;
      },

      getEntryForDate: (catId, dateKey) =>
        get().entries[entryKey(catId, dateKey)] ?? null,

      getTodaysEntry: (catId) =>
        get().entries[entryKey(catId, todayKey())] ?? null,

      getEntriesForCat: (catId) => {
        const all = get().entries;
        return Object.values(all)
          .filter((e) => e.cat_id === catId)
          .sort((a, b) => b.date.localeCompare(a.date));
      },

      clearForCat: (catId) =>
        set((s) => {
          const entries = { ...s.entries };
          for (const k of Object.keys(entries)) {
            if (k.startsWith(`${catId}:`)) delete entries[k];
          }
          const generating = { ...s.generating };
          delete generating[catId];
          const lastViewed = { ...s.lastViewed };
          delete lastViewed[catId];
          return { entries, generating, lastViewed };
        }),

      clearAll: () => set({ entries: {}, generating: {}, lastViewed: {} }),
    }),
    {
      name: 'catmd-diary',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2, // bumped from v1 for the lastViewed addition
      partialize: (state) => ({ entries: state.entries, lastViewed: state.lastViewed }),
    },
  ),
);

/**
 * Count consecutive days with ≥1 daily_checkin for the given cat, ending
 * today. Local copy of the same algorithm in healthStore — kept here so
 * the diary store doesn't reach into healthStore internals.
 */
function countCheckinStreak(
  events: ReturnType<typeof useHealthStore.getState>['events'],
  catId: string,
): number {
  const days = new Set<string>();
  for (const e of events) {
    if (e.type !== 'daily_checkin' || e.cat_id !== catId) continue;
    const d = new Date(e.ts);
    if (Number.isNaN(d.getTime())) continue;
    days.add(d.toISOString().slice(0, 10));
  }
  let count = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  for (let i = 0; i < 366; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      if (i === 0) {
        // Allow today as the first miss
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

/** Read today's cached entry for a cat (no generation). */
export function useTodaysDiaryEntry(catId: string | null | undefined) {
  return useDiaryStore((s) =>
    catId ? s.entries[entryKey(catId, todayKey())] ?? null : null,
  );
}

/**
 * All cached entries for a cat, newest first.
 *
 * IMPORTANT — Zustand selector pattern. Selectors that return a NEW
 * reference on every call (e.g. `Object.values(...).filter(...).sort(...)`)
 * trigger an infinite re-render loop because Zustand uses reference
 * equality by default. The fix is two-stage: subscribe to the raw
 * `entries` object (stable reference unless underlying state mutates),
 * then derive the filtered + sorted array via `useMemo` so the
 * derived array reference is also stable across renders that don't
 * change `entries` or `catId`.
 */
export function useDiaryEntriesForCat(catId: string | null | undefined) {
  const entries = useDiaryStore((s) => s.entries);
  return useMemo(() => {
    if (!catId) return [] as DiaryEntry[];
    return Object.values(entries)
      .filter((e) => e.cat_id === catId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, catId]);
}

/** Whether a generation is in flight for this cat. */
export function useDiaryGenerating(catId: string | null | undefined): boolean {
  return useDiaryStore((s) => (catId ? !!s.generating[catId] : false));
}

/**
 * Number of unread diary entries for a cat. Drives the Bond-tile
 * badge. Recomputes via useMemo from the raw `entries` + `lastViewed`
 * slices so referencial equality stays stable across renders.
 */
export function useDiaryUnreadCount(catId: string | null | undefined): number {
  const entries = useDiaryStore((s) => s.entries);
  const lastViewed = useDiaryStore((s) => s.lastViewed);
  return useMemo(() => {
    if (!catId) return 0;
    const lv = lastViewed[catId] ?? null;
    return Object.values(entries).filter((e) => {
      if (e.cat_id !== catId) return false;
      // If never viewed, every entry counts.
      if (!lv) return true;
      return e.date > lv;
    }).length;
  }, [entries, lastViewed, catId]);
}
