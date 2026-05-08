/**
 * Weekly reading store — caches the cat's weekly reading-of-the-human.
 *
 * One reading per cat per ISO week. Persisted via AsyncStorage so the
 * reading survives launches and the user always lands on the SAME
 * reading for the rest of the week (re-tapping the Sunday push or
 * the bond-tab tile reads from cache).
 *
 * See: services/weeklyReading.ts.
 */
import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  generateWeeklyReading,
  isoWeekKey,
  type WeeklyReading,
} from '../services/weeklyReading';
import { useCatStore } from './catStore';
import { useHealthStore } from './healthStore';
import { useChatStore } from './chatStore';
import { useDiaryStore } from './diaryStore';
import { usePersonalityStore } from './personalityStore';
import { hasEnoughDataForReveal } from '../services/personality';
import { track } from '../services/analytics';

const MAX_CACHED_READINGS_PER_CAT = 26; // ~6 months — enough archive

type State = {
  /** Key: `${catId}:${week_key}`. Value: WeeklyReading. */
  readings: Record<string, WeeklyReading>;
  /** Cat ids currently mid-generation. */
  generating: Record<string, boolean>;

  /**
   * Generate the reading for THIS WEEK (ISO week of `now`) for the
   * cat. Idempotent — if already cached, returns the cached value.
   * Pass `force` to regenerate.
   */
  generateForThisWeek: (
    catId: string,
    opts?: { force?: boolean },
  ) => Promise<WeeklyReading | null>;

  clearForCat: (catId: string) => void;
  clearAll: () => void;
};

function readingKey(catId: string, weekKey: string): string {
  return `${catId}:${weekKey}`;
}

// ---------------------------------------------------------------------------
// Context-builders — read from the various stores so the service stays
// pure (no zustand imports inside services/).
// ---------------------------------------------------------------------------

function buildContextForCat(catId: string) {
  // Last 7 days of mood-words from healthStore daily check-ins.
  const recentMoods: Array<'happy' | 'normal' | 'off'> = [];
  try {
    const checkins = useHealthStore
      .getState()
      .listByType(catId, 'daily_checkin');
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = checkins
      .filter((e) => new Date(e.ts).getTime() >= sevenDaysAgo)
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .slice(-7);
    for (const e of recent) {
      const m = (e.payload as { mood?: string })?.mood;
      if (m === 'happy' || m === 'normal' || m === 'off') {
        recentMoods.push(m);
      }
    }
  } catch {
    /* best-effort */
  }

  // Chat session signals — late nights, long sessions.
  const chat = useChatStore.getState();
  const thread = chat.threads[catId] ?? [];
  const humanActivitySignals: string[] = [];
  if (thread.length > 0) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = thread.filter(
      (t) => new Date(t.created_at).getTime() >= sevenDaysAgo,
    );

    // Group by local-date.
    const byDate: Record<string, number> = {};
    let lateNightDays = 0;
    const lateNightDates = new Set<string>();
    for (const t of recent) {
      const d = new Date(t.created_at);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDate[dk] = (byDate[dk] ?? 0) + 1;
      if (d.getHours() >= 23 || d.getHours() < 4) {
        lateNightDates.add(dk);
      }
    }
    lateNightDays = lateNightDates.size;

    const longSessionDays = Object.values(byDate).filter((c) => c >= 6).length;

    if (lateNightDays >= 3) humanActivitySignals.push('late_nights');
    if (longSessionDays >= 2) humanActivitySignals.push('long_chat_sessions');
  }

  // Recurring chat themes — shallow signal: words that appear in
  // 3+ user turns. Not perfect, good enough for a weekly hint.
  const recurringChatThemes: string[] = [];
  if (thread.length > 0) {
    const userTurns = thread.filter((t) => t.role === 'user');
    const wordCounts: Record<string, number> = {};
    for (const t of userTurns) {
      const words = t.content
        .toLowerCase()
        .replace(/[^\w\s']/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 4);
      const seen = new Set<string>();
      for (const w of words) {
        if (seen.has(w)) continue;
        seen.add(w);
        wordCounts[w] = (wordCounts[w] ?? 0) + 1;
      }
    }
    const STOP = new Set([
      'about', 'after', 'again', 'always', 'around', 'because', 'before',
      'doing', 'every', 'feels', 'maybe', 'might', 'never', 'other', 'really',
      'should', 'still', 'their', 'there', 'these', 'thing', 'think', 'those',
      'today', 'tomorrow', 'where', 'which', 'while', 'would', 'yesterday',
    ]);
    const themed = Object.entries(wordCounts)
      .filter(([w, c]) => c >= 3 && !STOP.has(w))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w);
    recurringChatThemes.push(...themed);
  }

  // Diary recap — last 3 entries' dates + mood-words. Use the public
  // selector so we don't couple to the diaryStore's internal key
  // format ("${catId}:${date}").
  const diaryEntries = useDiaryStore.getState().getEntriesForCat(catId);
  const recentDiarySnippets = diaryEntries
    .slice() // already newest-first per getEntriesForCat contract; copy before sort to be safe
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map((e) => ({ date: e.date, mood_word: e.mood_word }));

  // Subject directory — regular vs novel faces this week. We don't
  // have a clean store for this yet; pass empty arrays. Future: wire
  // in subjectStore once it lands.
  const regularSubjects: string[] = [];
  const novelSubjects: string[] = [];

  return {
    recentMoods,
    humanActivitySignals,
    regularSubjects,
    novelSubjects,
    recurringChatThemes,
    recentDiarySnippets,
  };
}

export const useWeeklyReadingStore = create<State>()(
  persist(
    (set, get) => ({
      readings: {},
      generating: {},

      generateForThisWeek: async (catId, opts = {}) => {
        const force = !!opts.force;
        const wk = isoWeekKey(new Date());
        const key = readingKey(catId, wk);

        if (!force) {
          const cached = get().readings[key];
          if (cached) return cached;
        }

        if (get().generating[catId]) return null;
        set((s) => ({ generating: { ...s.generating, [catId]: true } }));

        try {
          const cat = useCatStore.getState().cats.find((c) => c.id === catId);
          if (!cat) return null;

          const personality = usePersonalityStore
            .getState()
            .profiles[catId];
          const archetype =
            personality && hasEnoughDataForReveal(personality)
              ? personality.archetype
              : null;

          const ctx = buildContextForCat(catId);

          const reading = await generateWeeklyReading({
            catId,
            catName: cat.name,
            archetype,
            ctx,
          });

          set((s) => {
            const next = {
              ...s.readings,
              [readingKey(catId, reading.week_key)]: reading,
            };
            const forCat = Object.entries(next)
              .filter(([k]) => k.startsWith(`${catId}:`))
              .sort(([a], [b]) => b.localeCompare(a));
            if (forCat.length > MAX_CACHED_READINGS_PER_CAT) {
              for (const [oldKey] of forCat.slice(MAX_CACHED_READINGS_PER_CAT)) {
                delete next[oldKey];
              }
            }
            return { readings: next };
          });

          // Cloud backup — fire-and-forget. WeeklyReading has no `id`
          // field; we synthesise a stable key from cat_id + week_key so
          // the same reading upserts in place across regenerations.
          void import('../services/sync').then(({ syncWeeklyReadingToCloud }) =>
            syncWeeklyReadingToCloud({
              catId,
              reading: {
                id: `weekly_reading:${catId}:${reading.week_key}`,
                body: reading.reading,
                generated_at: reading.generated_at,
                consumed_at: null,
              },
            }).catch(() => {}),
          );

          track({
            type: 'weekly_reading_generated',
            props: {
              had_archetype: !!archetype,
              had_moods: ctx.recentMoods.length > 0,
              had_signals: ctx.humanActivitySignals.length > 0,
              had_themes: ctx.recurringChatThemes.length > 0,
            },
          });

          return reading;
        } catch (e) {
          track({
            type: 'weekly_reading_failed',
            props: {
              reason: (e instanceof Error ? e.message : 'unknown').slice(0, 200),
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

      clearForCat: (catId) =>
        set((s) => {
          const next = { ...s.readings };
          for (const k of Object.keys(next)) {
            if (k.startsWith(`${catId}:`)) delete next[k];
          }
          return { readings: next };
        }),

      clearAll: () => set({ readings: {}, generating: {} }),
    }),
    {
      name: 'catmd-weekly-readings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ readings: state.readings }),
    },
  ),
);

/** Hook: this week's reading for the cat (or null if not yet generated). */
export function useThisWeeksReading(
  catId: string | null | undefined,
): WeeklyReading | null {
  const wk = useMemo(() => isoWeekKey(new Date()), []);
  return useWeeklyReadingStore((s) =>
    catId ? s.readings[readingKey(catId, wk)] ?? null : null,
  );
}

export function useWeeklyReadingGenerating(
  catId: string | null | undefined,
): boolean {
  return useWeeklyReadingStore((s) =>
    catId ? !!s.generating[catId] : false,
  );
}
