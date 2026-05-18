/**
 * Paywall gate — the single function every AI feature calls before
 * doing work that costs AI tokens.
 *
 * Usage:
 *   import { useProGate } from '../src/services/paywallGate';
 *   const gate = useProGate();
 *   const onRecord = async () => {
 *     if (!gate.check('translate')) return; // routes to /paywall
 *     // ... proceed with the expensive AI call
 *   };
 *
 * Why a hook (vs a plain function): the entitlement state lives in
 * useEntitlement's React state. A plain function can't read that
 * without re-running the RPCs every call, which is wasteful. The hook
 * gives the calling component a stable `check()` that reads the cached
 * entitlement.
 *
 * The check does two things:
 *   1. Returns `true` when the user can proceed (Pro / in-trial / whitelisted)
 *   2. Routes to `/paywall?source=<feature>` + fires the
 *      `paywall_gate_blocked` analytics event when they can't
 *
 * Source tags are bounded to a closed enum so PostHog dashboards
 * stay clean. Add new variants here when you wire a new gate.
 */
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useEntitlement } from '../hooks/useEntitlement';

export type ProGateSource =
  | 'scan'              // triage scan
  | 'behavior'          // body-language reader
  | 'translate'         // meow translator
  | 'diary'             // diary generation
  | 'postcard'          // postcard generation
  | 'cat_studio'        // poster generation
  | 'chat'              // chat reply
  | 'pain'              // FGS pain check
  | 'pdf_export'        // vet-ready PDF
  | 'multi_cat'         // adding a 2nd cat
  | 'scan_quota'        // scan cap hit (legacy paywall source)
  | 'settings'
  | 'cats';

/**
 * Hook returning a `check` function that gates an AI action.
 *
 * `check(source)` returns:
 *   - `true` when the user has Pro access (paid / in-trial / whitelisted)
 *   - `false` when blocked — AND simultaneously navigates to the
 *     paywall + fires the `paywall_gate_blocked` analytics event so
 *     the caller just early-returns
 */
export function useProGate() {
  const router = useRouter();
  const { hasProAccess, loading } = useEntitlement();

  const check = useCallback(
    (source: ProGateSource): boolean => {
      // During the first-paint loading window we OPTIMISTICALLY allow
      // through. Otherwise legitimate Pro / trial users see the
      // paywall flash for a fraction of a second on every cold start.
      // The downside: a non-Pro user could theoretically squeeze one
      // call through in the first 200ms before useEntitlement settles.
      // Acceptable trade — UX > one bypassed call.
      if (loading) return true;
      if (hasProAccess) return true;

      // Block + route + telemetry.
      void import('./analytics').then(({ track }) =>
        track({
          type: 'paywall_gate_blocked',
          props: { source },
        }),
      );
      router.push({ pathname: '/paywall', params: { source } } as never);
      return false;
    },
    [router, hasProAccess, loading],
  );

  return { check, hasProAccess, loading };
}
