/**
 * Thin wrappers around the Supabase scan-usage RPCs.
 *
 * Quota is the source of truth on the server. Clients may cache the last
 * known value locally for optimistic UI but should never treat their
 * cached value as authoritative — the RPCs return the post-increment
 * number so UI can update deterministically.
 */
import { supabase } from './supabase';

/**
 * Returns the current UTC-month scan count for the signed-in user, or 0
 * if no row exists. Returns null when offline or not signed in — the
 * caller should gracefully degrade rather than block scans.
 */
export async function fetchScanUsage(): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('get_scan_usage');
    if (error) {
      console.warn('[CatMD] get_scan_usage:', error.message);
      return null;
    }
    return typeof data === 'number' ? data : 0;
  } catch (e) {
    console.warn('[CatMD] get_scan_usage threw:', e);
    return null;
  }
}

/**
 * Atomically bumps the current month's scan count and returns the new
 * total. Returns null on network failure — callers should log the scan
 * anyway and reconcile on the next fetchScanUsage().
 */
export async function incrementScanUsage(): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('increment_scan_usage');
    if (error) {
      console.warn('[CatMD] increment_scan_usage:', error.message);
      return null;
    }
    return typeof data === 'number' ? data : null;
  } catch (e) {
    console.warn('[CatMD] increment_scan_usage threw:', e);
    return null;
  }
}
