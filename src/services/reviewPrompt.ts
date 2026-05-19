/**
 * Review-prompt domain logic — pure eligibility + side effects to mark
 * sessions/insights + native trigger via expo-store-review.
 *
 * The earned-prompt rule (2026-05-19 spec):
 *
 *   meaningful_session_count >= 3
 *   AND useful_insight_count >= 1
 *   AND days_since_install >= 2
 *   AND not in a health-concern flow
 *   AND !clickedReview (never re-prompt after a click)
 *   AND !dismissedWithin30Days
 *
 * Counters are bumped from feature fire sites — call:
 *   - markUsefulInsight(type)   after delivering a value moment
 *   - markMeaningfulSessionIfCoreFeatureUsed()  after a core feature event
 *
 * The trigger function maybeTriggerReviewPrompt() reads eligibility,
 * checks the health-concern guard against the scan store, and (if ok)
 * sets a flag that the ReviewPromptModal subscribes to. The modal then
 * renders. On Leave-a-review tap, the native in-app review API fires.
 *
 * Why expo-store-review's API and NOT a Play Store deep link: the in-app
 * review dialog (a) keeps the user in the app, (b) is throttled by
 * Google (max ~1/yr per user), (c) does not require us to navigate
 * away. It's the right primitive for "earned prompt" UX.
 *
 * Pure-function eligibility (isEligibleForReviewPrompt) is the testable
 * surface — see scripts/test-review-prompt-eligibility.mjs.
 */
import * as StoreReview from 'expo-store-review';
import { create } from 'zustand';
import { useReviewPromptStore } from '../state/reviewPromptStore';
import { useScanStore } from '../state/scanStore';
import { isEligibleForReviewPrompt } from './reviewPromptEligibility';
import { track } from './analytics';

// Re-export so callers can import everything from this file if needed.
export { isEligibleForReviewPrompt } from './reviewPromptEligibility';

/** All recognised useful-insight types we count toward the prompt rule. */
export type UsefulInsightType =
  | 'scan_result'
  | 'pain_check'
  | 'health_rhythm_drift'
  | 'body_language'
  | 'meow_translation'
  | 'diary'
  | 'memory_chat_reply'
  | 'vet_pdf';

// Pure eligibility function lives in ./reviewPromptEligibility — re-exported above.

/**
 * Visibility of the review-prompt modal lives in a tiny standalone store
 * so the modal mounts globally (rendered once at the root) and any
 * feature fire site can flip the visibility. Keeping this separate from
 * the persisted store keeps the modal state in-memory only — it should
 * never persist across app launches.
 */
export const useReviewPromptVisibility = create<{
  visible: boolean;
  lastInsightType: UsefulInsightType | null;
  show: (insightType: UsefulInsightType) => void;
  hide: () => void;
}>((set) => ({
  visible: false,
  lastInsightType: null,
  show: (insightType) => set({ visible: true, lastInsightType: insightType }),
  hide: () => set({ visible: false }),
}));

/**
 * Bump useful_insight_count, then attempt to trigger the review prompt.
 * Call this from the value-delivery moment — AFTER the user has seen
 * the result, not before.
 */
export function markUsefulInsight(insightType: UsefulInsightType): void {
  useReviewPromptStore.getState().incrementUsefulInsight();
  // Defer the eligibility check by one tick so any pending UI update
  // (the result card appearing, the diary entry rendering) lands first.
  // The user gets a beat to read the result, then the modal slides up.
  setTimeout(() => {
    maybeTriggerReviewPrompt(insightType);
  }, 1200);
}

/**
 * Bump meaningful_session_count once per app-foreground session. The
 * store's currentSessionMarkedMeaningful debounce prevents repeated
 * increments within a single session no matter how many core features
 * are used.
 */
export function markMeaningfulSessionIfCoreFeatureUsed(): void {
  useReviewPromptStore.getState().markMeaningfulSession();
}

/**
 * Read all current state, check eligibility, and (if eligible) flip the
 * modal visibility. Fires the `review_prompt_eligible` and (if shown)
 * `review_prompt_shown` analytics events.
 */
export function maybeTriggerReviewPrompt(insightType: UsefulInsightType): void {
  const s = useReviewPromptStore.getState();
  // Health-concern guard: suppress for 7 days after any urgent or
  // concern-tier scan (or any hard-urgency scan). The marketing rule
  // is "never ask for a review during a serious health moment" — that
  // includes the recovery window where the user is still anxious about
  // the cat.
  const inHealthConcernFlow = (() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const scans = useScanStore.getState().scans;
    for (const scan of scans) {
      const ageMs = now - new Date(scan.created_at).getTime();
      if (ageMs >= sevenDays) continue;
      if (scan.urgency === 'concern' || scan.urgency === 'urgent' || scan.hard_urgency) {
        return true;
      }
    }
    return false;
  })();

  const eligible = isEligibleForReviewPrompt({
    firstSeenTs: s.firstSeenTs,
    meaningfulSessionCount: s.meaningfulSessionCount,
    usefulInsightCount: s.usefulInsightCount,
    lastDismissedTs: s.lastDismissedTs,
    lastShownTs: s.lastShownTs,
    clickedReview: s.clickedReview,
    inHealthConcernFlow,
    now: Date.now(),
  });

  if (!eligible) return;

  try {
    track({
      type: 'review_prompt_eligible',
      props: {
        meaningful_sessions_count: s.meaningfulSessionCount,
        useful_insights_count: s.usefulInsightCount,
        days_since_install: s.firstSeenTs
          ? Math.floor((Date.now() - s.firstSeenTs) / (24 * 60 * 60 * 1000))
          : 0,
        last_insight_type: insightType,
      },
    });
  } catch {
    // analytics best-effort
  }

  useReviewPromptVisibility.getState().show(insightType);
  useReviewPromptStore.getState().markPromptShown();

  try {
    track({
      type: 'review_prompt_shown',
      props: {
        meaningful_sessions_count: s.meaningfulSessionCount,
        useful_insights_count: s.usefulInsightCount,
        days_since_install: s.firstSeenTs
          ? Math.floor((Date.now() - s.firstSeenTs) / (24 * 60 * 60 * 1000))
          : 0,
        trigger: 'meaningful_session_after_insight',
        last_insight_type: insightType,
      },
    });
  } catch {
    // analytics best-effort
  }
}

/**
 * Fire the native Google in-app review dialog. Google heavily throttles
 * this — at most ~1 prompt per user per ~1yr — so it's safe to call
 * even if the user already saw a prompt recently (Google will silently
 * suppress). Our own cooldown rules already gate this further.
 *
 * Best-effort: if expo-store-review isn't available (iOS simulator,
 * older Android, missing native module), we silently fall back to
 * marking the click + closing the modal. The user's intent was
 * recorded, that's the analytics signal.
 */
export async function requestNativeReview(): Promise<void> {
  try {
    const isAvailable = await StoreReview.isAvailableAsync();
    if (isAvailable) {
      await StoreReview.requestReview();
    }
  } catch {
    // best-effort
  }
}
