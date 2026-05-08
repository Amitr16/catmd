/**
 * Personality store — caches computed profiles + owner quiz answers.
 *
 * Design:
 *   - Per-cat: latest computed `PersonalityProfile` + the cat's quiz answers
 *   - Recompute is on-demand (no auto-recompute schedule yet — kept simple
 *     for v1; the personality screen calls `recompute` on mount, the Bond
 *     tile reads the cached value)
 *   - Quiz answers persist forever once given; profile re-runs whenever
 *     check-ins / behaviour observations change because the screen calls
 *     recompute fresh each time
 *
 * Storage: AsyncStorage via Zustand persist (same pattern as notifPrefsStore).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  computePersonalityProfile,
  type PersonalityProfile,
  type PersonalityQuizAnswers,
} from '../services/personality';
import { useCatStore } from './catStore';
import { useHealthStore } from './healthStore';
import { track } from '../services/analytics';

/**
 * Threshold at which an archetype is considered "stable" and revealed
 * to the user (also used in the Bond tile NEW badge logic). Match
 * `confidenceLabel('stable')` in the personality service.
 */
const REVEAL_CONFIDENCE_THRESHOLD = 0.7;

type State = {
  /** Last-computed profile per cat. Recomputed on demand. */
  profiles: Record<string, PersonalityProfile>;
  /** Owner's quiz answers per cat. Null until they take the quiz. */
  quizAnswers: Record<string, PersonalityQuizAnswers>;

  /** Save the cat's quiz answers (4-question intake). */
  saveQuiz: (catId: string, answers: PersonalityQuizAnswers) => void;

  /**
   * Clear the cat's quiz answers so the personality screen re-routes
   * to the quiz flow. Keeps the cached profile so the archetype card
   * doesn't visually disappear mid-retake — it'll get recomputed once
   * new answers land. Used by the "Retake the quiz" button.
   */
  clearQuiz: (catId: string) => void;

  /**
   * Re-run the algorithm against current cat + events + quiz, cache the
   * result, and return it. Always returns a fresh value — the cached one
   * is the side-effect, not the return.
   */
  recompute: (catId: string) => PersonalityProfile | null;

  /** Read the latest cached profile without recomputing. */
  getProfile: (catId: string) => PersonalityProfile | null;

  /** Forget everything for a cat (used by GDPR delete + cat removal). */
  clearForCat: (catId: string) => void;
  clearAll: () => void;
};

export const usePersonalityStore = create<State>()(
  persist(
    (set, get) => ({
      profiles: {},
      quizAnswers: {},

      saveQuiz: (catId, answers) => {
        set((s) => ({
          quizAnswers: { ...s.quizAnswers, [catId]: answers },
        }));
        // Cloud backup — quiz + latest profile pushed together.
        const profile = get().profiles[catId] ?? null;
        void import('../services/sync').then(({ syncPersonalityToCloud }) =>
          syncPersonalityToCloud({ catId, quizAnswers: answers, profile }).catch(() => {}),
        );
      },

      clearQuiz: (catId) => {
        set((s) => {
          const next = { ...s.quizAnswers };
          delete next[catId];
          return { quizAnswers: next };
        });
        // Cloud — push the cleared state so cross-device restore reflects
        // the retake. Keep the profile cached locally and on cloud (the
        // user is mid-retake; the profile will be recomputed when the
        // new answers save).
        const profile = get().profiles[catId] ?? null;
        void import('../services/sync').then(({ syncPersonalityToCloud }) =>
          syncPersonalityToCloud({ catId, quizAnswers: null, profile }).catch(() => {}),
        );
      },

      recompute: (catId) => {
        // Pull fresh state — don't memoise across the catStore / healthStore
        // because their state can change independently of this store.
        const cat = useCatStore.getState().cats.find((c) => c.id === catId);
        if (!cat) return null;
        const events = useHealthStore.getState().events;
        const quiz = get().quizAnswers[catId] ?? null;
        const previous = get().profiles[catId] ?? null;

        // Diary mood-words from the last 30 days — Personality v2 layer
        // (added 2026-05-02). Lazy import to avoid a circular dependency
        // (diaryStore → personalityStore for archetype-aware diaries).
        const diaryMoodWords = (() => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { useDiaryStore } = require('./diaryStore') as typeof import('./diaryStore');
            const cutoff = Date.now() - 30 * 86400 * 1000;
            return Object.values(useDiaryStore.getState().entries)
              .filter((e) => e.cat_id === catId)
              .filter((e) => {
                const ts = Date.parse(e.generated_at);
                return !Number.isNaN(ts) && ts >= cutoff;
              })
              .map((e) => e.mood_word)
              .filter((m): m is string => !!m);
          } catch {
            return [] as string[];
          }
        })();

        const profile = computePersonalityProfile({
          cat,
          events,
          quiz,
          diaryMoodWords,
        });
        set((s) => ({
          profiles: { ...s.profiles, [catId]: profile },
        }));

        // Cloud backup — profile + quiz answers pushed together.
        void import('../services/sync').then(({ syncPersonalityToCloud }) =>
          syncPersonalityToCloud({ catId, quizAnswers: quiz, profile }).catch(() => {}),
        );

        // Telemetry: archetype reveal milestone. Fires exactly once per
        // cat — when confidence transitions from below the reveal
        // threshold (or no prior profile) to at-or-above. Subsequent
        // recomputes won't re-fire because `previous.confidence` will
        // already be >= threshold by the next run.
        const wasBelow = !previous || previous.confidence < REVEAL_CONFIDENCE_THRESHOLD;
        const nowAtOrAbove = profile.confidence >= REVEAL_CONFIDENCE_THRESHOLD;
        if (wasBelow && nowAtOrAbove) {
          // Estimate days from quiz to reveal — useful for funnel timing
          let daysToReveal: number | null = null;
          if (quiz?.answered_at) {
            const ms = Date.now() - new Date(quiz.answered_at).getTime();
            if (Number.isFinite(ms) && ms >= 0) {
              daysToReveal = Math.round(ms / (24 * 60 * 60 * 1000));
            }
          }
          track({
            type: 'personality_archetype_revealed',
            props: {
              archetype: profile.archetype,
              days_to_reveal: daysToReveal,
            },
          });
        }
        return profile;
      },

      getProfile: (catId) => get().profiles[catId] ?? null,

      clearForCat: (catId) =>
        set((s) => {
          const profiles = { ...s.profiles };
          delete profiles[catId];
          const quizAnswers = { ...s.quizAnswers };
          delete quizAnswers[catId];
          return { profiles, quizAnswers };
        }),

      clearAll: () => set({ profiles: {}, quizAnswers: {} }),
    }),
    {
      name: 'catmd-personality',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      // Defensive migration. Schema bumped 2026-05-02 to add the
      // optional `inputs_used.diary_entry_count` field for the diary-
      // mood layer. Existing v1 profiles deserialise fine without it
      // because it's optional, but explicit migrate keeps us honest:
      //   - any future schema drift can be handled here without losing
      //     user data
      //   - never throw inside migrate — return a safe shape so the
      //     hydration step never fails (which would clear the store
      //     and surface as "personality data lost" — exactly the bug
      //     the user reported)
      migrate: (rawState: unknown, fromVersion: number) => {
        // Hydration safety: if the persisted blob is malformed or
        // wholly missing fields, return an empty-but-valid state
        // rather than letting Zustand throw + reset.
        const safe: { profiles: Record<string, unknown>; quizAnswers: Record<string, unknown> } = {
          profiles: {},
          quizAnswers: {},
        };
        if (rawState && typeof rawState === 'object') {
          const s = rawState as { profiles?: unknown; quizAnswers?: unknown };
          if (s.profiles && typeof s.profiles === 'object') {
            safe.profiles = s.profiles as Record<string, unknown>;
          }
          if (s.quizAnswers && typeof s.quizAnswers === 'object') {
            safe.quizAnswers = s.quizAnswers as Record<string, unknown>;
          }
        }
        // v1 → v2: no field changes required (diary_entry_count is
        // optional + reads as undefined for older profiles). Just
        // pass through the salvaged state.
        void fromVersion;
        return safe as unknown as ReturnType<typeof rawState extends never ? never : (...args: unknown[]) => unknown>;
      },
    },
  ),
);

/**
 * Convenience hook — read latest profile for a cat, or null if none yet.
 * Does NOT trigger recompute. The personality screen and the Bond tile
 * call `recompute` directly when they want fresh data.
 */
export function usePersonalityProfile(catId: string | null | undefined): PersonalityProfile | null {
  return usePersonalityStore((s) => (catId ? s.profiles[catId] ?? null : null));
}

/** Convenience hook — has the user taken the quiz for this cat? */
export function usePersonalityQuizAnswered(catId: string | null | undefined): boolean {
  return usePersonalityStore((s) => (catId ? !!s.quizAnswers[catId] : false));
}
