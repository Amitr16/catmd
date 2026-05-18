/**
 * Partner code validation — wraps the Supabase RPC
 * `validate_partner_code()`.
 *
 * Audit 2026-05-17. Flow:
 *   1. User enters code on paywall
 *   2. `validatePartnerCode(code)` calls Supabase RPC
 *   3. On success: app calls setPartnerCodeAttribute(code_id) to tag
 *      the RC user, then swaps purchase target to `result.product_id`
 *   4. Purchase completes → RC webhook → server records redemption
 *      keyed on subscriber attributes
 *
 * Pure thin wrapper. No state. No caching — re-validates on every
 * apply because admin may have paused the code between sessions.
 */
import { supabase } from './supabase';

export type PartnerCodeValidation =
  | {
      ok: true;
      codeId: string;
      productId: string;
      partnerName: string;
    }
  | {
      ok: false;
      reason: 'code_not_found' | 'status_paused' | 'status_archived' | 'network';
      message: string;
    };

const FRIENDLY_REASONS: Record<string, string> = {
  code_not_found: 'We don\'t recognise that code. Check for typos.',
  status_paused: 'This code is temporarily paused. Try again later.',
  status_archived: 'This code has expired.',
};

/**
 * Validate a partner code via Supabase RPC. Always resolves — never
 * throws. The error path returns `ok: false` with a `reason` and a
 * human-readable `message` you can surface in the paywall directly.
 */
export async function validatePartnerCode(
  rawCode: string,
): Promise<PartnerCodeValidation> {
  const code = (rawCode ?? '').trim();
  if (code.length < 3) {
    return {
      ok: false,
      reason: 'code_not_found',
      message: FRIENDLY_REASONS.code_not_found!,
    };
  }
  try {
    const { data, error } = await supabase.rpc('validate_partner_code', {
      p_code: code,
    });

    if (error) {
      return {
        ok: false,
        reason: 'network',
        message: 'Could not check that code right now. Try again in a moment.',
      };
    }

    // RPC returns a table — single row expected
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        ok: false,
        reason: 'code_not_found',
        message: FRIENDLY_REASONS.code_not_found!,
      };
    }

    if (row.valid) {
      return {
        ok: true,
        codeId: row.code_id,
        productId: row.product_id,
        partnerName: row.partner_name,
      };
    }

    const reason =
      (row.reason as PartnerCodeValidation extends { reason: infer R }
        ? R
        : never) ?? 'code_not_found';
    return {
      ok: false,
      reason,
      message:
        FRIENDLY_REASONS[reason as string] ?? FRIENDLY_REASONS.code_not_found!,
    };
  } catch {
    return {
      ok: false,
      reason: 'network',
      message: 'Could not check that code right now. Try again in a moment.',
    };
  }
}
