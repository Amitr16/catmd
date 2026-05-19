/**
 * ReviewPromptStore — drives the "rate CatMD" in-app review prompt.
 *
 * Spec (2026-05-19): only ask for a review after the user has experienced
 * core CatMD value, never on first open. The earned-prompt rule:
 *
 *   meaningful_session_count >= 3
 *   AND useful_insight_count >= 1
 *   AND days_since_install >= 2
 *   AND not in a health-concern flow
 *   AND no prior click on review
 *   AND not dismissed within the last 30 days
 *
 * Counters are incremented from feature fire sites (services/reviewPrompt.ts).
 * Cooldown + click state persist in AsyncStorage so the rules survive app
 * kills and version bumps.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type State = {
  /** ms timestamp of the first time the store was hydrated (proxy for install). */
  firstSeenTs: number | null;
  /**
   * Number of sessions where the user did something meaningful (used a
   * core feature). Incremented at most once per app-foreground session
   * regardless of how many features were used in that session.
   */
  meaningfulSessionCount: number;
  /**
   * Number of times CatMD delivered an interpretive value moment (scan
   * result, body-language read, diary entry, pain check, etc.).
   */
  usefulInsightCount: number;
  /**
   * Per-session debounce: prevents a single session from counting as
   * multiple meaningful sessions even if the user navigates through
   * several core features within it.
   */
  currentSessionMarkedMeaningful: boolean;
  /** ms timestamp last time the user dismissed the prompt. */
  lastDismissedTs: number | null;
  /** ms timestamp last time the prompt was actually shown. */
  lastShownTs: number | null;
  /** True after the user has tapped "Leave a review" — never re-prompt. */
  clickedReview: boolean;

  ensureFirstSeen: () => void;
  /** Increment meaningful_session_count once per app-foreground session. */
  markMeaningfulSession: () => void;
  /** Reset the per-session debounce on app background → foreground. */
  resetSessionDebounce: () => void;
  /** Increment useful_insight_count. */
  incrementUsefulInsight: () => void;
  /** Record that the prompt was shown to the user. */
  markPromptShown: () => void;
  /** Record that the user dismissed (Not now or X). */
  markDismissed: () => void;
  /** Record that the user clicked Leave a review — locks the prompt out forever. */
  markClicked: () => void;
};

// Constants for the eligibility rule live in services/reviewPromptEligibility
// (re-exported here for any caller that still imports from this file).
export {
  DISMISS_COOLDOWN_MS,
  MIN_INSTALL_AGE_MS,
  MIN_MEANINGFUL_SESSIONS,
  MIN_USEFUL_INSIGHTS,
} from '../services/reviewPromptEligibility';

export const useReviewPromptStore = create<State>()(
  persist(
    (set, get) => ({
      firstSeenTs: null,
      meaningfulSessionCount: 0,
      usefulInsightCount: 0,
      currentSessionMarkedMeaningful: false,
      lastDismissedTs: null,
      lastShownTs: null,
      clickedReview: false,

      ensureFirstSeen: () => {
        if (get().firstSeenTs == null) {
          set({ firstSeenTs: Date.now() });
        }
      },

      markMeaningfulSession: () => {
        const s = get();
        if (s.currentSessionMarkedMeaningful) return;
        set({
          meaningfulSessionCount: s.meaningfulSessionCount + 1,
          currentSessionMarkedMeaningful: true,
        });
      },

      resetSessionDebounce: () => {
        set({ currentSessionMarkedMeaningful: false });
      },

      incrementUsefulInsight: () => {
        set((s) => ({ usefulInsightCount: s.usefulInsightCount + 1 }));
      },

      markPromptShown: () => {
        set({ lastShownTs: Date.now() });
      },

      markDismissed: () => {
        set({ lastDismissedTs: Date.now() });
      },

      markClicked: () => {
        set({ clickedReview: true, lastShownTs: Date.now() });
      },
    }),
    {
      name: '@catmd/review_prompt_v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
