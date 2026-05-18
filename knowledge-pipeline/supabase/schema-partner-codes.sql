-- =============================================================================
-- Partner code program — influencer coupon + revenue-share attribution
--
-- Audit 2026-05-17. Mechanics:
--   1. Admin creates a `partner_codes` row per influencer (e.g. 'NALA30')
--   2. User enters code on paywall → app calls validate_partner_code() RPC
--   3. If valid, app sets RevenueCat subscriber attribute partner_code_id
--      then purchases the discounted `pro_annual_partner` product
--   4. Google Play charges user $55.99 (30% off $79.99)
--   5. RevenueCat webhook fires → Cloudflare Worker writes a row into
--      partner_redemptions with status='pending' (refund window)
--   6. Monthly cron confirms 'pending' rows older than 30 days → 'confirmed'
--   7. Admin manually runs payout each month → inserts partner_payouts row
--      and updates partner_redemptions.status='paid'
--
-- After migration: SELECT from these tables ONLY via service-role
-- (admin SQL dashboard). The app and worker write via service-role too.
-- The partner-facing dashboard is NOT built yet — partners get their
-- numbers from screenshots / email until Phase 2.
-- =============================================================================

-- ── Partner codes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The coupon code itself. Case-insensitive lookup (we upper() before match).
  code            text UNIQUE NOT NULL CHECK (length(code) BETWEEN 3 AND 32),

  -- Who this code belongs to
  partner_name    text NOT NULL,
  partner_email   text,
  partner_handle  text,                          -- IG / TikTok handle (no @)

  -- Google Play product this code unlocks. Default to the discounted
  -- annual product. Could vary per partner if you want tiered programs.
  product_id      text NOT NULL DEFAULT 'pro_annual_partner',

  -- Royalty percentage (0-100). Default 30 per the agreed program.
  -- Stored per-code so you can run experiments (some at 25%, some at 35%).
  royalty_pct     numeric(5,2) NOT NULL DEFAULT 30.0
                  CHECK (royalty_pct >= 0 AND royalty_pct <= 100),

  -- Code lifecycle
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'archived')),

  -- Admin notes
  notes           text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_partner_codes_code_lower
  ON public.partner_codes (lower(code));
CREATE INDEX IF NOT EXISTS idx_partner_codes_status
  ON public.partner_codes (status) WHERE status = 'active';

-- ── Per-purchase redemption tracking ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_redemptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id               uuid NOT NULL REFERENCES public.partner_codes(id),

  -- Who bought (RevenueCat user id — usually matches Supabase auth uid)
  rc_app_user_id        text NOT NULL,
  user_id               uuid REFERENCES auth.users(id),

  -- Subscription identity
  rc_subscription_id    text,                          -- RC product transaction id
  product_id            text NOT NULL,
  store                 text NOT NULL DEFAULT 'play_store',  -- play_store | app_store

  -- Money (all in cents to avoid float drift)
  gross_amount_cents    int NOT NULL CHECK (gross_amount_cents >= 0),
  currency              text NOT NULL DEFAULT 'USD',
  -- Estimated platform fee (15% on first $1M/yr for Google Play Pricing
  -- — this is calculated client-side and stored for the audit trail).
  store_fee_cents       int NOT NULL DEFAULT 0,
  partner_share_cents   int NOT NULL CHECK (partner_share_cents >= 0),
  -- Computed: gross - store_fee - partner_share
  net_to_app_cents      int GENERATED ALWAYS AS
                        (gross_amount_cents - store_fee_cents - partner_share_cents)
                        STORED,

  -- Lifecycle
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'paid', 'refunded')),
  redeemed_at           timestamptz NOT NULL DEFAULT now(),
  confirmed_at          timestamptz,    -- when refund window passed (~30d)
  paid_at               timestamptz,    -- when influencer was paid out
  refunded_at           timestamptz,    -- if subscription was refunded by user

  -- Idempotency + audit
  webhook_event_id      text UNIQUE,                    -- RC event id; prevents dupe writes
  raw_event             jsonb,                          -- full RC event for debugging
  notes                 text
);

CREATE INDEX IF NOT EXISTS idx_partner_redemptions_code_id
  ON public.partner_redemptions (code_id);
CREATE INDEX IF NOT EXISTS idx_partner_redemptions_status
  ON public.partner_redemptions (status);
CREATE INDEX IF NOT EXISTS idx_partner_redemptions_redeemed_at
  ON public.partner_redemptions (redeemed_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_redemptions_rc_user
  ON public.partner_redemptions (rc_app_user_id);

-- ── Monthly payout settlements ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_payouts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id                     uuid NOT NULL REFERENCES public.partner_codes(id),

  period_start                timestamptz NOT NULL,
  period_end                  timestamptz NOT NULL,

  redemption_count            int NOT NULL CHECK (redemption_count >= 0),
  total_gross_cents           int NOT NULL CHECK (total_gross_cents >= 0),
  total_partner_share_cents   int NOT NULL CHECK (total_partner_share_cents >= 0),

  -- How you actually paid them
  payment_method              text,        -- 'stripe' | 'paypal' | 'wise' | 'manual'
  transaction_ref             text,        -- external txn id
  paid_at                     timestamptz NOT NULL DEFAULT now(),

  notes                       text
);

CREATE INDEX IF NOT EXISTS idx_partner_payouts_code
  ON public.partner_payouts (code_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_period
  ON public.partner_payouts (period_start, period_end);

-- ── RLS — service role only ───────────────────────────────────────────────
-- The app uses validate_partner_code() (SECURITY DEFINER), which doesn't
-- need direct table access. The webhook writes via service role from the
-- Cloudflare Worker. All other reads are via the admin SQL editor.

ALTER TABLE public.partner_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_redemptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payouts      ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.partner_codes       TO service_role;
GRANT ALL ON public.partner_redemptions TO service_role;
GRANT ALL ON public.partner_payouts     TO service_role;

-- =============================================================================
-- validate_partner_code() RPC
--
-- Called from the app's paywall when a user enters a coupon code. Returns
-- a single row indicating whether the code is valid + which product it
-- unlocks. Public — granted to anon + authenticated so unsigned-in users
-- can validate too (anonymous-first is a hard product constraint).
--
-- Returns:
--   valid         — true iff the code exists and status='active'
--   product_id    — the Play Store product id to purchase (empty on invalid)
--   code_id       — the partner_codes.id (null on not-found, present on
--                   not-active so the app can show why)
--   partner_name  — for the "code applied — 30% off (partner: Nala Cat)" UX
--   reason        — error code on failure: 'code_not_found' | 'status_paused'
--                                          | 'status_archived'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.validate_partner_code(p_code text)
RETURNS TABLE (
  valid         boolean,
  product_id    text,
  code_id       uuid,
  partner_name  text,
  reason        text
) AS $$
DECLARE
  v_row public.partner_codes;
BEGIN
  -- Trim + case-insensitive lookup. We store codes uppercase by convention
  -- (NALA30) but accept any casing on input.
  SELECT * INTO v_row
    FROM public.partner_codes
   WHERE lower(code) = lower(trim(coalesce(p_code, '')));

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false, ''::text, NULL::uuid, ''::text, 'code_not_found'::text;
    RETURN;
  END IF;

  IF v_row.status <> 'active' THEN
    RETURN QUERY SELECT
      false,
      ''::text,
      v_row.id,
      v_row.partner_name,
      ('status_' || v_row.status)::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    v_row.product_id,
    v_row.id,
    v_row.partner_name,
    ''::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.validate_partner_code(text)
  TO anon, authenticated;

-- =============================================================================
-- Helper view — per-code summary (admin SQL)
-- =============================================================================
CREATE OR REPLACE VIEW public.partner_code_summary AS
SELECT
  pc.id AS code_id,
  pc.code,
  pc.partner_name,
  pc.partner_handle,
  pc.partner_email,
  pc.royalty_pct,
  pc.status,
  pc.created_at,
  COALESCE(stats.redemption_count, 0) AS redemption_count,
  COALESCE(stats.confirmed_count, 0)  AS confirmed_count,
  COALESCE(stats.refunded_count, 0)   AS refunded_count,
  COALESCE(stats.total_gross_cents, 0) AS total_gross_cents,
  COALESCE(stats.total_partner_share_cents, 0) AS total_owed_cents,
  COALESCE(stats.paid_cents, 0) AS total_paid_cents,
  COALESCE(stats.total_partner_share_cents, 0) - COALESCE(stats.paid_cents, 0)
    AS pending_payout_cents
FROM public.partner_codes pc
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE status != 'refunded') AS redemption_count,
    count(*) FILTER (WHERE status = 'confirmed') AS confirmed_count,
    count(*) FILTER (WHERE status = 'refunded')  AS refunded_count,
    sum(gross_amount_cents) FILTER (WHERE status != 'refunded') AS total_gross_cents,
    sum(partner_share_cents) FILTER (WHERE status != 'refunded') AS total_partner_share_cents,
    sum(partner_share_cents) FILTER (WHERE status = 'paid') AS paid_cents
  FROM public.partner_redemptions
  WHERE code_id = pc.id
) stats ON true
ORDER BY total_partner_share_cents DESC NULLS LAST;

GRANT SELECT ON public.partner_code_summary TO service_role;
