/**
 * Pure-function eligibility for the review prompt (2026-05-19 spec).
 *
 * Extracted from services/reviewPrompt.ts so the eligibility rule can
 * be fixture-tested in pure Node (no React Native / store deps in the
 * import chain). The store-using helpers + native dialog trigger live
 * in reviewPrompt.ts; this file is the testable surface.
 *
 * Constants are also exported here so the persistence store + the
 * service both pin to the same numbers.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const DISMISS_COOLDOWN_MS = 30 * DAY_MS;
export const MIN_INSTALL_AGE_MS = 2 * DAY_MS;
export const MIN_MEANINGFUL_SESSIONS = 3;
export const MIN_USEFUL_INSIGHTS = 1;
export const SAME_DAY_RESHOW_SUPPRESS_MS = 24 * 60 * 60 * 1000;

/**
 * Earned-prompt rule (all must be true to show the prompt):
 *
 *   meaningful_session_count >= 3
 *   AND useful_insight_count >= 1
 *   AND days_since_install >= 2
 *   AND !inHealthConcernFlow
 *   AND !clickedReview
 *   AND !dismissedWithin30Days
 *   AND !shownWithin24Hours
 */
export function isEligibleForReviewPrompt(opts: {
  firstSeenTs: number | null;
  meaningfulSessionCount: number;
  usefulInsightCount: number;
  lastDismissedTs: number | null;
  lastShownTs: number | null;
  clickedReview: boolean;
  inHealthConcernFlow: boolean;
  now: number;
}): boolean {
  const {
    firstSeenTs,
    meaningfulSessionCount,
    usefulInsightCount,
    lastDismissedTs,
    lastShownTs,
    clickedReview,
    inHealthConcernFlow,
    now,
  } = opts;

  if (clickedReview) return false;
  if (inHealthConcernFlow) return false;
  if (firstSeenTs == null) return false;
  if (now - firstSeenTs < MIN_INSTALL_AGE_MS) return false;
  if (meaningfulSessionCount < MIN_MEANINGFUL_SESSIONS) return false;
  if (usefulInsightCount < MIN_USEFUL_INSIGHTS) return false;
  if (lastDismissedTs != null && now - lastDismissedTs < DISMISS_COOLDOWN_MS) return false;
  if (lastShownTs != null && now - lastShownTs < SAME_DAY_RESHOW_SUPPRESS_MS) return false;
  return true;
}
