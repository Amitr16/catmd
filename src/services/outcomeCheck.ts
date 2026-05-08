/**
 * Outcome check-in — schedules a one-shot local push 6–36 hours after a
 * scan, asking the owner "how is {cat} doing now?". Answering feeds a
 * signal loop: we learn which triage advice actually helps and which
 * was off. This is the single biggest gap vs. Ada (human medicine) and
 * no feline app currently does it.
 *
 * Delay-by-urgency rationale:
 *   urgent  →  6h  (owner is probably at/returning from ER; we need
 *                    to know if it was handled; don't wait a full day)
 *   concern → 12h  (same-day vet visit expected)
 *   monitor → 24h  (classic "wait and watch" window)
 *   routine → 36h  (low-priority, don't nag)
 */
import type { UrgencyTier } from '../ai/triage';
import { scheduleOneTimeAt } from './notifications';
import { useNotifPrefsStore } from '../state/notifPrefsStore';

const HOUR = 60 * 60 * 1000;

const DELAY_MS_BY_URGENCY: Record<UrgencyTier, number> = {
  urgent: 6 * HOUR,
  concern: 12 * HOUR,
  monitor: 24 * HOUR,
  routine: 36 * HOUR,
};

// Dev-only override — fire the outcome push within a minute so it can
// actually be exercised in a Metro session without waiting hours.
// Opt-in via EXPO_PUBLIC_DEV_SHORT_DELAYS=true in .env.local.
const DEV_SHORT_DELAY_MS = 60 * 1000;
const useShortDelays =
  (process.env.EXPO_PUBLIC_DEV_SHORT_DELAYS ?? 'false').toLowerCase() === 'true';

export function outcomeCheckDelayMs(urgency: UrgencyTier): number {
  if (useShortDelays) return DEV_SHORT_DELAY_MS;
  return DELAY_MS_BY_URGENCY[urgency] ?? 24 * HOUR;
}

export async function scheduleOutcomeCheck(opts: {
  scanId: string;
  catId: string;
  catName: string;
  urgency: UrgencyTier;
}): Promise<string | null> {
  // Honour the per-category opt-out. If the user has switched off
  // outcome-check follow-ups in Settings → Notifications, we don't
  // schedule anything. Quiet-hours + queue handling already live inside
  // scheduleOneTimeAt below.
  if (!useNotifPrefsStore.getState().enabled.outcome_check) return null;

  const fireAt = new Date(Date.now() + outcomeCheckDelayMs(opts.urgency));
  const body =
    opts.urgency === 'urgent' || opts.urgency === 'concern'
      ? `Tap to let us know if the vet visit helped — or if things got worse.`
      : `A quick check-in helps us know if the advice worked.`;
  return scheduleOneTimeAt({
    fireAt,
    title: `How is ${opts.catName} doing?`,
    body,
    data: {
      type: 'outcome_check',
      scanId: opts.scanId,
      catId: opts.catId,
    },
  });
}
