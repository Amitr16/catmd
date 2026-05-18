/**
 * Reactive paywall entitlement hook — single source of truth for "can
 * this user use AI features right now?".
 *
 * Three ways to have Pro access:
 *   1. `isPro` — paid subscriber (RevenueCat entitlement is active)
 *   2. `inTrial` — first 14 days post-signup (server-stamped via
 *      Supabase `start_or_get_trial()` RPC)
 *   3. `isWhitelisted` — admin (you) added them to `pro_whitelist`
 *      table via SQL. Used to reward influencers / press / power
 *      testers without making them pay.
 *
 * The unified flag is `hasProAccess`. Every AI feature should gate on
 * THAT, not on `isPro` directly — otherwise trial users + whitelisted
 * users hit the paywall on day 1, which defeats the trial model.
 *
 * Refresh strategy:
 *   - On mount: full check (entitlement + trial state + whitelist)
 *   - On app foreground: full check (catches: trial day rollover, post-
 *     purchase entitlement update, whitelist admin add)
 *   - On explicit `refresh()` call (e.g. after a purchase action)
 *
 * Costs: 3 round-trips on every full check. Two RPC calls + one RC
 * SDK call. Acceptable on app-open (~once per session); too chatty
 * to do on every render. Hook caches the result and only re-checks
 * on the events above.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  getEntitlement,
  isCurrentUserWhitelisted,
  startOrGetTrial,
  TRIAL_LENGTH_DAYS,
  type TrialState,
} from '../services/purchases';
import { supabase } from '../services/supabase';

export type EntitlementState = {
  /** Authoritative "can use AI features right now" — gate on this. */
  hasProAccess: boolean;
  /** Paid subscriber (RevenueCat). */
  isPro: boolean;
  /** Within the 14-day free trial window. */
  inTrial: boolean;
  /** Email on the admin-controlled `pro_whitelist`. */
  isWhitelisted: boolean;
  /** Days until trial expiry. 0 when expired. Null while loading. */
  daysRemaining: number | null;
  /** Raw trial server state, exposed for downstream UI (banner copy). */
  trial: TrialState | null;
  /** True while the first check is in flight. UI should treat as Pro
   *  to avoid flashing the paywall before we know. */
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useEntitlement(): EntitlementState {
  const [isPro, setIsPro] = useState(false);
  const [inTrial, setInTrial] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [loading, setLoading] = useState(true);
  // Track the last fetch so a back-to-back foreground event doesn't
  // double-fire the RPCs. 30-second debounce.
  const lastFetchRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const now = Date.now();
      lastFetchRef.current = now;
      // Parallel — the three checks are independent.
      const [pro, trialState, whitelist] = await Promise.all([
        getEntitlement(),
        startOrGetTrial(),
        isCurrentUserWhitelisted(),
      ]);
      setIsPro(pro);
      setTrial(trialState);
      setInTrial(trialState?.in_trial ?? false);
      setIsWhitelisted(whitelist);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      // Debounce — back-to-back foreground events (notification opens
      // app then user taps tile, etc.) shouldn't trigger duplicate
      // RPCs. 30 sec is plenty fine-grained for entitlement state.
      if (Date.now() - lastFetchRef.current < 30_000) return;
      void refresh();
    });
    // Auth-state subscription — critical for cold-start correctness.
    // On the very first launch, supabase.auth.signInAnonymously() runs
    // in parallel with the hook's mount. If the trial RPC fires before
    // the anonymous session exists, it returns 'not_authenticated' and
    // hasProAccess stays false → user sees the paywall on day 1.
    // Re-firing refresh() on TOKEN_REFRESHED / SIGNED_IN catches it.
    const authSub = supabase.auth.onAuthStateChange((event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        void refresh();
      }
    });
    return () => {
      sub.remove();
      authSub.data.subscription.unsubscribe();
    };
  }, [refresh]);

  return {
    isPro,
    inTrial,
    isWhitelisted,
    hasProAccess: isPro || inTrial || isWhitelisted,
    daysRemaining: trial?.days_remaining ?? null,
    trial,
    loading,
    refresh,
  };
}

// Backward-compat: some legacy callers still destructure `isPro` and
// `loading` from this hook. Re-exporting the trial-length constant for
// convenience in trial-banner copy ("of 14").
export { TRIAL_LENGTH_DAYS };
