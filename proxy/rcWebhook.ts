/**
 * RevenueCat webhook handler — writes partner code redemptions to
 * Supabase whenever a subscription event involves a code-tagged user.
 *
 * Audit 2026-05-17. Flow:
 *   1. RC fires a webhook to /api/rc-webhook on every subscription event
 *      (initial purchase, renewal, refund, cancellation, etc.)
 *   2. We check the Authorization header against RC_WEBHOOK_SECRET to
 *      reject forged calls
 *   3. We read event.subscriber_attributes.partner_code_id — if absent,
 *      it's a regular non-partner purchase, no-op and return 200
 *   4. If present, we look up the partner_codes row by id, compute
 *      partner_share_cents from the event's price + royalty_pct, and
 *      insert into partner_redemptions
 *   5. Idempotency: every row carries the webhook_event_id (RC's
 *      event.id) as a UNIQUE constraint — duplicate webhook deliveries
 *      no-op silently
 *
 * Event types we handle:
 *   INITIAL_PURCHASE              → status='pending', refund window starts
 *   RENEWAL                       → status='pending' new row (12mo window)
 *   CANCELLATION                  → no-op (user just cancelled auto-renew;
 *                                    the original redemption still earns)
 *   EXPIRATION                    → no-op (same logic)
 *   BILLING_ISSUE                 → no-op (transient)
 *   PRODUCT_CHANGE                → no-op (rare; manual reconciliation)
 *   REFUND                        → mark matching row status='refunded'
 *   SUBSCRIBER_ALIAS              → no-op (account merge; rare)
 *   NON_RENEWING_PURCHASE         → no-op (we don't sell one-time products)
 *
 * Everything that's not a recognised partner event returns 200 OK so
 * RevenueCat doesn't retry forever.
 */

type RCEvent = {
  event?: {
    id?: string;
    type?: string;
    app_user_id?: string;
    original_app_user_id?: string;
    product_id?: string;
    price?: number;            // gross USD as float (RC normalises to USD)
    price_in_purchased_currency?: number;
    currency?: string;
    purchased_at_ms?: number;
    transaction_id?: string;
    subscriber_attributes?: Record<
      string,
      { value?: string; updated_at_ms?: number }
    >;
    store?: string;            // 'PLAY_STORE' | 'APP_STORE' | 'STRIPE' | ...
    [k: string]: unknown;
  };
  api_version?: string;
};

/**
 * 15% on first $1M/year, 30% above — we conservatively use 15% since
 * CatMD is well under that threshold at launch. Adjust if you ever
 * cross the threshold. Note: this is for ESTIMATED store fee logging
 * only — the actual fee is taken by Google Play before payout to
 * CatMD.
 */
const GOOGLE_PLAY_FEE_RATE = 0.15;

/**
 * Auth check. Returns null on success, an error string on failure.
 * Compares the incoming Authorization header against the stored
 * shared secret using a constant-time compare to prevent timing leaks.
 */
function checkAuth(request: Request, secret: string | undefined): string | null {
  if (!secret) return 'webhook secret not configured';
  const hdr = request.headers.get('Authorization') ?? '';
  if (hdr.length !== secret.length) return 'invalid authorization';
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < hdr.length; i++) {
    diff |= hdr.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0 ? null : 'invalid authorization';
}

/**
 * Insert a partner_redemptions row. Idempotent on webhook_event_id —
 * duplicate webhook deliveries (RC retries on 5xx) no-op cleanly via
 * the ON CONFLICT clause.
 */
async function insertRedemption(
  env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string },
  row: {
    code_id: string;
    rc_app_user_id: string;
    rc_subscription_id?: string;
    product_id: string;
    store: string;
    gross_amount_cents: number;
    currency: string;
    store_fee_cents: number;
    partner_share_cents: number;
    webhook_event_id: string;
    raw_event: unknown;
  },
): Promise<{ ok: boolean; reason?: string }> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, reason: 'supabase env missing' };
  }
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/partner_redemptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      // Resolve duplicate-key (re-delivered webhook) as a clean no-op
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return {
      ok: false,
      reason: `supabase insert failed: ${res.status} ${body.slice(0, 200)}`,
    };
  }
  return { ok: true };
}

/**
 * Mark redemption as refunded when RC fires a REFUND event. Matches
 * by rc_subscription_id (the transaction id) — only one row should
 * match per refund.
 */
async function markRefunded(
  env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string },
  rcSubscriptionId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, reason: 'supabase env missing' };
  }
  const url =
    `${env.SUPABASE_URL}/rest/v1/partner_redemptions` +
    `?rc_subscription_id=eq.${encodeURIComponent(rcSubscriptionId)}` +
    `&status=in.(pending,confirmed)`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return {
      ok: false,
      reason: `supabase refund update failed: ${res.status} ${body.slice(0, 200)}`,
    };
  }
  return { ok: true };
}

/**
 * Look up a partner_codes row to get the royalty percentage. The
 * webhook needs this to compute partner_share at insert time. Reads
 * via service role so RLS doesn't block.
 */
async function lookupRoyaltyPct(
  env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string },
  codeId: string,
): Promise<number | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const url =
    `${env.SUPABASE_URL}/rest/v1/partner_codes` +
    `?id=eq.${encodeURIComponent(codeId)}&select=royalty_pct`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json().catch(() => null)) as
    | Array<{ royalty_pct: number }>
    | null;
  return rows?.[0]?.royalty_pct ?? null;
}

/**
 * Main entry — handle a POST /api/rc-webhook. Returns the Response
 * object the Worker should send back.
 */
export async function handleRcWebhook(
  request: Request,
  env: {
    RC_WEBHOOK_SECRET?: string;
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  },
): Promise<Response> {
  // ── Auth ──
  const authErr = checkAuth(request, env.RC_WEBHOOK_SECRET);
  if (authErr) {
    return new Response(JSON.stringify({ error: authErr }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse ──
  let payload: RCEvent | null = null;
  try {
    payload = (await request.json()) as RCEvent;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const evt = payload?.event;
  if (!evt) {
    return new Response(JSON.stringify({ error: 'missing event' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventType = evt.type ?? '';
  const eventId = evt.id ?? '';
  const appUserId = evt.app_user_id ?? evt.original_app_user_id ?? '';

  // Read subscriber attributes — RC nests them as { key: { value, updated_at_ms } }
  const codeId =
    evt.subscriber_attributes?.partner_code_id?.value ?? null;

  // ── Route by event type ──
  // Refunds: match on transaction_id, mark row refunded
  if (eventType === 'REFUND' || eventType === 'CANCELLATION_REFUND') {
    if (evt.transaction_id) {
      await markRefunded(env, evt.transaction_id);
    }
    return new Response(JSON.stringify({ ok: true, action: 'refunded' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // For other events: only INITIAL_PURCHASE and RENEWAL create redemption
  // rows. Everything else (CANCELLATION, EXPIRATION, BILLING_ISSUE,
  // PRODUCT_CHANGE, etc.) is no-op.
  if (eventType !== 'INITIAL_PURCHASE' && eventType !== 'RENEWAL') {
    return new Response(
      JSON.stringify({ ok: true, action: 'ignored', type: eventType }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  // No partner code → not our business; clean 200.
  if (!codeId) {
    return new Response(
      JSON.stringify({ ok: true, action: 'no_partner_code' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Compute the row ──
  const royaltyPct = await lookupRoyaltyPct(env, codeId);
  if (royaltyPct == null) {
    // Code id is on the subscriber but not in our DB — probably an
    // archived code or test data. 200 so RC doesn't retry.
    return new Response(
      JSON.stringify({ ok: true, action: 'code_not_found', code_id: codeId }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  const grossUsdFloat = typeof evt.price === 'number' ? evt.price : 0;
  const grossCents = Math.round(grossUsdFloat * 100);
  const storeFeeCents = Math.round(grossCents * GOOGLE_PLAY_FEE_RATE);
  const partnerShareCents = Math.round(grossCents * (royaltyPct / 100));

  const insertResult = await insertRedemption(env, {
    code_id: codeId,
    rc_app_user_id: appUserId,
    rc_subscription_id: evt.transaction_id,
    product_id: evt.product_id ?? '',
    store: (evt.store ?? 'PLAY_STORE').toLowerCase(),
    gross_amount_cents: grossCents,
    currency: evt.currency ?? 'USD',
    store_fee_cents: storeFeeCents,
    partner_share_cents: partnerShareCents,
    webhook_event_id: eventId,
    raw_event: evt,
  });

  if (!insertResult.ok) {
    // Return 500 so RevenueCat retries — we want the data eventually.
    // Idempotency is handled at insert time by webhook_event_id UNIQUE.
    return new Response(
      JSON.stringify({ ok: false, reason: insertResult.reason }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      action: 'redemption_recorded',
      code_id: codeId,
      gross_cents: grossCents,
      partner_share_cents: partnerShareCents,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
