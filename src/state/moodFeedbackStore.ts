/**
 * Mood-feedback store — adaptive layer for the daily mood lottery.
 *
 * Per cat × mood, we track three counters that together let
 * `computeFeedbackMod` in `moodWeights.ts` learn which moods this
 * specific user actually values:
 *
 *   - exposureCount    : days this mood was the active mood (one
 *                        increment per day, regardless of how many times
 *                        the screen reads it)
 *   - shareCount       : times the user shared a daily card / postcard
 *                        / story attributed to this mood. Strongest
 *                        signal — sharing is high-cost, deliberate.
 *   - chatSessionCount : chat sessions opened on a day with this mood.
 *                        Lighter signal (weight 0.5 in the modifier
 *                        formula) — opening chat is ambient, not
 *                        intentional preference.
 *
 * Idempotency:
 *   - Exposure is keyed (catId, moodId, dateKey) — recording the same
 *     trio twice is a no-op. Lets us call `recordExposure` liberally
 *     on screen mount without inflating counts.
 *   - Chat session is keyed (catId, moodId, dateKey) — same pattern,
 *     one session per day even if the user opens chat multiple times.
 *   - Shares are NOT idempotent — every share counts. Users sharing
 *     three times in one day signals strong preference for that mood.
 *
 * Persistence: AsyncStorage via Zustand persist, same pattern as
 * personalityStore. Survives app restarts. Survives "forget everything"
 * via the standard clear-on-forget flow (caller invokes `clearAll`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DailyMoodId } from '../services/dailyMood';
import { localDateKey } from '../services/dailyMood';
import type { CatMoodFeedback, CatFeedbackTable } from '../services/moodWeights';

/**
 * Fire-and-forget Supabase mirror for a single row. Called from every
 * mutator after the local write succeeds. Wrapped in try/catch + lazy
 * import so:
 *   - The store stays usable when offline / when Supabase auth fails
 *     (local AsyncStorage is the fast-path source of truth)
 *   - We avoid a top-level circular import (sync.ts → moodFeedbackStore
 *     for applyPulledMoodFeedback)
 */
function pushRowToCloud(
  catId: string,
  moodId: DailyMoodId,
  row: CatMoodFeedback,
): void {
  void import('../services/sync').then(({ syncMoodFeedbackToCloud }) => {
    syncMoodFeedbackToCloud({
      catId,
      moodId,
      exposureCount: row.exposureCount,
      shareCount: row.shareCount,
      chatSessionCount: row.chatSessionCount,
    }).catch((e) => {
      console.warn('[moodFeedbackStore] cloud sync failed:', e);
    });
  });
}

/** Per-cat idempotency keys we've already counted. */
type SeenKeys = {
  /** `${dateKey}:${moodId}` strings we've already counted toward exposure. */
  exposureKeys: string[];
  /** Same for chat-session-per-day. */
  chatSessionKeys: string[];
};

type State = {
  /** Per-cat counters → mood. */
  feedback: Record<string, CatFeedbackTable>;
  /** Per-cat idempotency seen-sets. */
  seen: Record<string, SeenKeys>;

  /**
   * Record that mood M was active for cat C on date D. Idempotent per
   * (cat, mood, date) — repeat calls are no-ops.
   */
  recordExposure: (catId: string, moodId: DailyMoodId, dateKey?: string) => void;

  /**
   * Record that the user opened a chat session for cat C while mood M
   * was active on date D. Idempotent per (cat, mood, date) — one count
   * per day even across multiple session opens.
   */
  recordChatSession: (catId: string, moodId: DailyMoodId, dateKey?: string) => void;

  /**
   * Record that the user shared a daily card / postcard / story
   * attributed to mood M on cat C. NOT idempotent — every share counts,
   * since repeat sharing is itself signal that the user is enjoying
   * this mood.
   */
  recordShare: (catId: string, moodId: DailyMoodId) => void;

  /** Read the feedback table for a cat (empty `{}` if none yet). */
  getFeedback: (catId: string) => CatFeedbackTable;

  /** Wipe everything (called from settings "Forget everything"). */
  clearAll: () => void;
};

const EMPTY_FB: CatMoodFeedback = {
  exposureCount: 0,
  shareCount: 0,
  chatSessionCount: 0,
};

function ensureRow(
  table: CatFeedbackTable,
  moodId: DailyMoodId,
): CatMoodFeedback {
  const existing = table[moodId];
  if (existing) return { ...existing };
  return { ...EMPTY_FB };
}

export const useMoodFeedbackStore = create<State>()(
  persist(
    (set, get) => ({
      feedback: {},
      seen: {},

      recordExposure: (catId, moodId, dateKey) => {
        const dk = dateKey ?? localDateKey();
        const seenKey = `${dk}:${moodId}`;
        const catSeen = get().seen[catId] ?? { exposureKeys: [], chatSessionKeys: [] };
        if (catSeen.exposureKeys.includes(seenKey)) return; // idempotent

        const table = { ...(get().feedback[catId] ?? {}) };
        const row = ensureRow(table, moodId);
        row.exposureCount += 1;
        table[moodId] = row;

        set({
          feedback: { ...get().feedback, [catId]: table },
          seen: {
            ...get().seen,
            [catId]: {
              ...catSeen,
              exposureKeys: [...catSeen.exposureKeys, seenKey].slice(-365),
            },
          },
        });
        // Mirror to Supabase so the cat's learned preferences survive
        // reinstalls + sync across devices. Fire-and-forget.
        pushRowToCloud(catId, moodId, row);
      },

      recordChatSession: (catId, moodId, dateKey) => {
        const dk = dateKey ?? localDateKey();
        const seenKey = `${dk}:${moodId}`;
        const catSeen = get().seen[catId] ?? { exposureKeys: [], chatSessionKeys: [] };
        if (catSeen.chatSessionKeys.includes(seenKey)) return; // idempotent

        const table = { ...(get().feedback[catId] ?? {}) };
        const row = ensureRow(table, moodId);
        row.chatSessionCount += 1;
        table[moodId] = row;

        set({
          feedback: { ...get().feedback, [catId]: table },
          seen: {
            ...get().seen,
            [catId]: {
              ...catSeen,
              chatSessionKeys: [...catSeen.chatSessionKeys, seenKey].slice(-365),
            },
          },
        });
        pushRowToCloud(catId, moodId, row);
      },

      recordShare: (catId, moodId) => {
        const table = { ...(get().feedback[catId] ?? {}) };
        const row = ensureRow(table, moodId);
        row.shareCount += 1;
        table[moodId] = row;

        set({
          feedback: { ...get().feedback, [catId]: table },
        });
        pushRowToCloud(catId, moodId, row);
      },

      getFeedback: (catId) => get().feedback[catId] ?? {},

      clearAll: () => set({ feedback: {}, seen: {} }),
    }),
    {
      name: 'catmd-mood-feedback-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
