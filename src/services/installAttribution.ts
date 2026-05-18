/**
 * Install attribution — first-launch capture of the Play Install
 * Referrer + UTM parse. Runs once per install, caches the parsed
 * result in AsyncStorage so subsequent launches just read the cache.
 *
 * Architecture:
 *   1. On every cold boot, check the AsyncStorage flag
 *      `@catmd/install_attribution_v1`.
 *   2. If present → parse and return the cached attribution (no native
 *      call). Sub-millisecond.
 *   3. If absent (first launch ever) → call the native Install Referrer
 *      module, parse the referrerUrl query string for UTM params +
 *      campaign/creative IDs, persist the result, and return it.
 *   4. Any failure → return the organic default and persist it so we
 *      don't keep retrying on every cold boot.
 *
 * The "organic default" is { utm_source: 'organic' }. Google Play's own
 * referrer for organic discoveries usually carries 'utm_source=google-
 * play-organic' or no referrer at all; either way our default is what
 * surfaces in PostHog.
 *
 * Timeout: the native call has no client-side cap. We wrap with a 2s
 * race here so `app_opened` isn't blocked indefinitely on cold start.
 * If we time out, we return organic for THIS session but DON'T cache —
 * next cold boot will retry the native fetch so a transient Play-
 * services lag doesn't permanently mark a real campaign install as
 * organic.
 *
 * Pure parsing is extracted to ./installAttributionParser so it can be
 * fixture-tested in pure Node (no native dep import chain).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getReferrerDetails } from '../../modules/install-referrer';
import {
  ORGANIC_DEFAULT,
  parseReferrerUrl,
  type InstallAttribution,
} from './installAttributionParser';

export { parseReferrerUrl, type InstallAttribution } from './installAttributionParser';

const STORAGE_KEY = '@catmd/install_attribution_v1';
const NATIVE_CALL_TIMEOUT_MS = 2000;

/**
 * Race a promise against a timeout. Returns a discriminated-union
 * outcome so callers can distinguish three cases (audit P1-2
 * 2026-05-16):
 *   - `{ kind: 'ok', value }` — promise resolved cleanly
 *   - `{ kind: 'rejected' }` — promise rejected (e.g. native module
 *     returned a clean "feature not supported" error)
 *   - `{ kind: 'timeout' }`  — we hit the wall-clock cap; the
 *     underlying promise may still resolve later, but we've moved on
 *
 * Why the distinction matters: a clean rejection (device without
 * Play Services, sideloaded APK, etc.) is permanent — we can cache
 * organic and stop retrying. A timeout is transient (Play Services
 * was slow today) — we should NOT cache, so next cold boot retries.
 * Pre-fix the two cases were conflated, so every cold boot on a
 * Huawei-style device would pay the 2s timeout penalty forever.
 */
type TimeoutOutcome<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'rejected' }
  | { kind: 'timeout' };

// Generic param T is the NON-NULL value type. The input promise may
// resolve to `T | null` (null is treated as a clean rejection).
function withTimeout<T>(
  p: Promise<T | null>,
  ms: number,
): Promise<TimeoutOutcome<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ kind: 'timeout' });
    }, ms);
    p.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        // `v` is `T | null` from getReferrerDetails — preserve the null
        // as a clean rejection so the caller treats "iOS / no native
        // module" as permanent (cache organic + stop retrying).
        if (v == null) {
          resolve({ kind: 'rejected' });
        } else {
          resolve({ kind: 'ok', value: v });
        }
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        resolve({ kind: 'rejected' });
      },
    );
  });
}

/**
 * Get the install attribution for this device. First call ever fetches
 * + caches; subsequent calls read the cache. Always resolves (never
 * throws) — returns the organic default on any failure path.
 */
export async function getOrCaptureInstallAttribution(): Promise<InstallAttribution> {
  // Cache check first — sub-ms hot path for every cold boot after the
  // first ever.
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as InstallAttribution;
        if (parsed && typeof parsed.utm_source === 'string') {
          return parsed;
        }
      } catch {
        // Corrupt cache — fall through and re-fetch.
      }
    }
  } catch {
    // AsyncStorage failure — fall through to native fetch.
  }

  // First launch (or corrupt/missing cache) — fetch the native referrer
  // with a hard 2s timeout so we don't block app_opened.
  const outcome = await withTimeout(getReferrerDetails(), NATIVE_CALL_TIMEOUT_MS);

  // Three outcomes (audit P1-2 2026-05-16):
  //   (a) 'ok'        → real referrer payload. Parse + cache.
  //   (b) 'rejected'  → permanent failure (iOS / no Play Services /
  //                     sideloaded APK / feature not supported). Cache
  //                     organic so we never re-fetch — this device
  //                     can't capture a referrer, period.
  //   (c) 'timeout'   → transient lag (Play Services slow today).
  //                     Return organic for THIS session but DO NOT
  //                     cache. Next cold boot retries, so a real
  //                     campaign install doesn't get permanently
  //                     branded as organic by a slow first boot.
  if (outcome.kind === 'timeout') {
    return ORGANIC_DEFAULT;
  }

  const attribution: InstallAttribution =
    outcome.kind === 'ok' && outcome.value.referrerUrl
      ? parseReferrerUrl(outcome.value.referrerUrl)
      : ORGANIC_DEFAULT;

  // Persist for clean-ok and clean-rejected paths.
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Best-effort.
  }

  return attribution;
}

/**
 * Clear the cached attribution. Exposed for debugging + the "forget me"
 * flow that nukes all per-device state. Not called from any production
 * path other than that one.
 */
export async function resetInstallAttribution(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}
