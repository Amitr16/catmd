/**
 * Clock-sanity check — defensive guard against device clock drift.
 *
 * ── Why this exists ─────────────────────────────────────────────────
 * Android devices occasionally report a wrong clock — after airplane
 * mode, SIM swap, network change, or a fresh boot before NTP sync.
 * When that happens, every part of CatMD that trusts `new Date()`
 * silently mis-behaves:
 *
 *   - The diary's "today" key gets the wrong YYYY-MM-DD; auto-generation
 *     fires for a date that's not actually today
 *   - The cat's chat replies reference "today / yesterday / 3 days ago"
 *     against a wrong reference frame, hallucinating events that
 *     never happened
 *   - World extraction tags photos with a wrong observed_at, polluting
 *     the recurrence-window check
 *
 * Real incident report 2026-05-08: a tester opened the diary and got
 * an auto-generated entry for a date 2 weeks in the past, with content
 * referencing photos that weren't there (because the app didn't even
 * exist then). Closing + reopening fixed it (Android's clock had
 * resynced via NTP). We now block these ops when the clock is clearly
 * wrong.
 *
 * ── How the check works ────────────────────────────────────────────
 * Issues a HEAD request to the Supabase REST endpoint and reads the
 * `Date` response header. Servers always return their current time
 * in this header — it's part of HTTP/1.1 (RFC 7231 §7.1.1.2).
 *
 * Compared against `Date.now()`. If the delta exceeds the threshold
 * (1 hour by default), we treat the device clock as broken.
 *
 * Cached for 30 minutes to avoid hammering on every chat turn. Stale
 * cache is fine — clock drift is a per-device condition, not per-turn.
 *
 * ── Failure modes ──────────────────────────────────────────────────
 * - Network unreachable → returns 0 delta (assume clock is fine).
 *   Better to let the user use the app than block them on a flaky
 *   network when the actual clock might be correct.
 * - Date header missing or malformed → returns 0 delta.
 * - Supabase URL not configured → returns 0 delta.
 *
 * In all failure cases we err on the side of NOT blocking. The check
 * is belt-and-braces, not a hard gate.
 */

import { track } from './analytics';

/** Threshold beyond which we declare the device clock "off". */
const CLOCK_DRIFT_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/** How long to cache the delta before re-checking. */
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

let cachedDelta: number | null = null;
let lastCheckedAt = 0;

/**
 * Returns the server-minus-local clock delta in milliseconds.
 * Positive = device is behind server. Negative = device is ahead.
 * Returns 0 on any error (assume clock is fine — fail open).
 */
export async function getClockDelta(): Promise<number> {
  if (cachedDelta !== null && Date.now() - lastCheckedAt < CACHE_TTL_MS) {
    return cachedDelta;
  }
  try {
    const baseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    if (!baseUrl) return 0;

    // HEAD on /rest/v1/ — minimal payload, just need the Date header.
    // Supabase's REST endpoint always returns one.
    const resp = await fetch(`${baseUrl}/rest/v1/`, {
      method: 'HEAD',
      // 5s timeout via AbortController so this never blocks the app
      // for long if the server is slow.
      signal: AbortSignal.timeout(5000),
    });
    const dateHeader = resp.headers.get('date');
    if (!dateHeader) return 0;

    const serverMs = new Date(dateHeader).getTime();
    if (!Number.isFinite(serverMs)) return 0;

    const delta = serverMs - Date.now();
    cachedDelta = delta;
    lastCheckedAt = Date.now();
    return delta;
  } catch {
    return 0;
  }
}

/**
 * True when the device clock differs from server time by more than
 * the threshold. False on any error (fail open — don't block legit
 * users on flaky networks).
 *
 * Side effect: emits `clock_anomaly_detected` telemetry on the FIRST
 * detection within a session, so we can see in PostHog how often
 * this affects real users.
 */
export async function isDeviceClockOff(opts: {
  surface: 'diary' | 'chat' | 'boot' | 'world';
}): Promise<boolean> {
  const delta = await getClockDelta();
  if (delta === 0) return false; // failure mode = assume fine
  if (Math.abs(delta) <= CLOCK_DRIFT_THRESHOLD_MS) return false;

  track({
    type: 'clock_anomaly_detected',
    props: {
      surface: opts.surface,
      delta_minutes: Math.round(delta / 60000),
      reason: 'server_delta',
    },
  });
  return true;
}

/**
 * Synchronous local check — does this proposed "today" key sit
 * earlier than the most-recent cached entry's date? If so, the
 * device clock has moved BACKWARDS since the last entry was
 * written, which only happens when the clock is wrong.
 *
 * Cheap (no network), instant. Catches the common case fast.
 *
 * `latestCachedDate` and `proposedToday` are both YYYY-MM-DD strings;
 * lexicographic comparison works because of ISO-style ordering.
 */
export function isClockMovingBackwards(
  proposedToday: string,
  latestCachedDate: string | null,
): boolean {
  if (!latestCachedDate) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(proposedToday)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(latestCachedDate)) return false;
  return proposedToday < latestCachedDate;
}

/** Resets the cache. Mostly for tests / hot-reload. */
export function resetClockCache(): void {
  cachedDelta = null;
  lastCheckedAt = 0;
}
