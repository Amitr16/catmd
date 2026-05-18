/**
 * Unified scan quota — free tier gets a single pool of scans per UTC
 * month that covers both cat-body and litter-box triage. The server
 * (scan_usage table + increment_scan_usage RPC) is the source of truth;
 * this hook is just a reactive mirror with optimistic local caching.
 *
 * Previous version used local scan-count computed from `scanStore.scans`.
 * That was exploitable — `forget_me` or app reinstall would reset the
 * pool. Server-side counting closes both loopholes for signed-in users.
 * (A fresh anonymous session on reinstall still resets its own counter;
 * gated separately by requiring email beyond the first scan.)
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { fetchScanUsage } from '../services/quota';
import { FREE_SCANS_PER_MONTH } from '../services/purchases';
import { useEntitlement } from './useEntitlement';

export type ScanQuota = {
  isPro: boolean;
  limit: number;
  used: number;
  remaining: number;
  canScan: boolean;
  /** True while waiting on the first server fetch. UI should avoid
   *  gating the primary CTA on this — show the button as enabled and
   *  let the server reject over-quota requests if needed. */
  loading: boolean;
  refresh: () => Promise<void>;
  /** Called by scan.tsx after a successful scan to reflect the new count
   *  without waiting for the next server round-trip. The next refresh
   *  call reconciles against authoritative state. */
  incrementOptimistic: () => void;
};

export function useScanQuota(): ScanQuota {
  // 2026-05-12: gate on the unified `hasProAccess` flag (paid OR
  // in-trial OR whitelisted) — not raw isPro. Otherwise trial users
  // would hit the 3/month cap on day 1.
  const { hasProAccess } = useEntitlement();
  const isPro = hasProAccess; // alias preserved for the rest of this hook
  const [used, setUsed] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const n = await fetchScanUsage();
      if (n != null) setUsed(n);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const incrementOptimistic = useCallback(() => {
    setUsed((n) => n + 1);
  }, []);

  if (isPro) {
    return {
      isPro: true,
      limit: Infinity,
      used,
      remaining: Infinity,
      canScan: true,
      loading: false,
      refresh,
      incrementOptimistic,
    };
  }

  return {
    isPro: false,
    limit: FREE_SCANS_PER_MONTH,
    used,
    remaining: Math.max(0, FREE_SCANS_PER_MONTH - used),
    canScan: used < FREE_SCANS_PER_MONTH,
    loading,
    refresh,
    incrementOptimistic,
  };
}
