# CatMD — Supabase Setup & Operations Manual

> **Last updated:** 2026-05-17
> **Audience:** the solo operator who deploys + maintains CatMD's Supabase project
>
> **Purpose:** one place that lists (a) every SQL schema needed for the app to function, (b) the SQL commands for day-to-day operations (partner codes, payouts, refunds, monitoring), (c) the routine queries you'll run weekly/monthly.
>
> **Where everything lives:** all schema files are in `knowledge-pipeline/supabase/`. Run them in the Supabase SQL editor at https://supabase.com/dashboard → CatMD project → SQL editor.

---

## Part 1 — First-time Supabase setup (do this once on a fresh project)

### What tables / RPCs the app NEEDS to function

The app makes calls to these Supabase tables and RPCs at runtime. If any one is missing, the corresponding feature will silently fail or throw. Run all 10 schema files below in order on a fresh Supabase project.

| Feature in app | Tables/RPCs used | Schema file |
|---|---|---|
| **Knowledge base / RAG citations** | `knowledge_cards`, `rpc('match_knowledge_cards')` | `schema.sql` |
| **Cat profiles + health events log** | `cats`, `cat_events`, `cat_reminders`, `notif_prefs` | `schema-users.sql` |
| **Cloud backup + cross-device restore** | `app_backups`, `rpc('forget_me')` | `schema-cloud-backup-phase-b.sql` |
| **Trial state + Pro whitelist** | `user_trial_state`, `pro_whitelist`, `rpc('start_or_get_trial')`, `rpc('is_current_user_whitelisted')` | `schema-trial-and-whitelist.sql` |
| **Free-tier scan quota** | `scan_usage`, `rpc('get_scan_usage')`, `rpc('increment_scan_usage')` | included in `schema-users.sql` |
| **Meow translator events** | `cat_events` (uses `meow_translation` type) | `schema-meow-translator.sql` |
| **Adaptive mood lottery** | `mood_feedback` | `schema-mood-feedback.sql` |
| **World memory (objects / places)** | `cat_world` | `schema-world-memory.sql` |
| **Becoming meter + subject directory + self-facts** | `becoming_state`, `subject_directory`, `self_facts` | `schema-becoming.sql` |
| **Vet-confirmed story funnel** (marketing capture) | `vet_confirmed_stories`, view `vet_confirmed_stories_press_ready` | `schema-vet-confirmed-stories.sql` |
| **Partner code program** (influencer affiliate) | `partner_codes`, `partner_redemptions`, `partner_payouts`, view `partner_code_summary`, `rpc('validate_partner_code')` | `schema-partner-codes.sql` |

### Run order

Some schemas reference others. Run in this order on a fresh project:

```
1. schema.sql                            (knowledge cards — base RAG)
2. schema-users.sql                      (cats, cat_events, scan_usage)
3. schema-cloud-backup-phase-b.sql       (full backup + forget_me)
4. schema-trial-and-whitelist.sql        (trial + Pro whitelist)
5. schema-meow-translator.sql            (event-type extension)
6. schema-mood-feedback.sql              (mood adaptation)
7. schema-world-memory.sql               (world objects/places)
8. schema-becoming.sql                   (becoming + subjects + self-facts)
9. schema-vet-confirmed-stories.sql      (testimonial capture)
10. schema-partner-codes.sql             (partner affiliate program)
```

Each file is idempotent (safe to re-run). If you're unsure whether one ran, just paste it again — `IF NOT EXISTS` clauses prevent breakage.

### How to run each

1. Open https://supabase.com/dashboard → CatMD project
2. Left sidebar → **SQL Editor**
3. Click **New query**
4. Paste contents of the file
5. Click **Run** (or Cmd/Ctrl+Enter)
6. Confirm "Success. No rows returned" or similar in the bottom panel
7. Move to next file

### Verify setup is complete

After running all 10, paste this in SQL editor:

```sql
-- Confirm every required table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'knowledge_cards', 'cats', 'cat_events', 'cat_reminders', 'notif_prefs',
    'scan_usage', 'app_backups', 'user_trial_state', 'pro_whitelist',
    'mood_feedback', 'cat_world', 'becoming_state', 'subject_directory',
    'self_facts', 'vet_confirmed_stories', 'partner_codes',
    'partner_redemptions', 'partner_payouts'
  )
ORDER BY table_name;
```

You should see **18 rows**. If any are missing, that schema file didn't run cleanly — paste it again.

```sql
-- Confirm every required RPC exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'match_knowledge_cards', 'forget_me', 'get_scan_usage',
    'increment_scan_usage', 'is_current_user_whitelisted',
    'start_or_get_trial', 'validate_partner_code'
  )
ORDER BY routine_name;
```

You should see **7 rows**.

### Required Supabase project settings

- **Authentication** → enable **Anonymous sign-ins** (CatMD is anonymous-first)
- **Authentication** → enable **Email** provider (for the post-anonymous upgrade flow)
- **API** → note the **anon public key** (used by the app — already in env)
- **API** → note the **service_role key** (used by the Cloudflare Worker webhook — set as Wrangler secret)
- **Database** → **Connection pooling** → confirm enabled (default in 2026)

---

## Part 2 — Partner code program operations

### 🆕 Create a new partner code

```sql
INSERT INTO partner_codes (
  code,             -- the coupon string, uppercase by convention (e.g. NALA30)
  partner_name,     -- real person/account name
  partner_handle,   -- @ on platform they post on, no @ sign
  partner_email,    -- payout + comms email
  royalty_pct,      -- usually 30.0; can be 25/35/40 per partner deal
  status,           -- 'active' (immediate live), 'paused' (not redeemable), 'archived' (retired)
  notes             -- free-form CRM: audience size, contract date, payout method
) VALUES (
  'NALA30',
  'Nala Cat',
  'nala_cat',
  'team@nalacat.com',
  30.0,
  'active',
  'IG 4.5M, TikTok 500K. Annual revenue share 30% for 12mo per user. Onboarded 2026-05-17. Payout: Stripe Connect acct_xxx.'
);
```

After running, the code is **live immediately**. The app's paywall will accept it the next time someone enters it.

### 📋 List all codes

```sql
SELECT code, partner_name, partner_handle, royalty_pct, status, created_at
FROM partner_codes
ORDER BY created_at DESC;
```

### ⏸️ Pause / archive / re-activate a code

```sql
-- Pause (still tracks existing redemptions; blocks NEW redemptions)
UPDATE partner_codes SET status = 'paused' WHERE code = 'NALA30';

-- Archive permanently
UPDATE partner_codes
SET status = 'archived', archived_at = now()
WHERE code = 'NALA30';

-- Re-enable
UPDATE partner_codes SET status = 'active' WHERE code = 'NALA30';
```

### 💱 Change royalty percentage mid-flight

```sql
-- ⚠️ Only affects FUTURE redemptions. Existing partner_redemptions rows
-- keep their original share — don't retro-credit unless explicitly agreed.
UPDATE partner_codes
SET royalty_pct = 35.0,
    notes = notes || E'\n\nRoyalty bumped to 35% 2026-06-15 — performance bonus.'
WHERE code = 'NALA30';
```

### 🔍 Update CRM notes on a partner

```sql
UPDATE partner_codes
SET notes = notes || E'\n\n2026-05-25: posted TikTok https://tiktok.com/@nala_cat/video/12345'
WHERE code = 'NALA30';
```

---

## Part 3 — Performance tracking queries

### 🎯 Weekly overview — one query, every active code

```sql
SELECT * FROM partner_code_summary
WHERE status = 'active'
ORDER BY total_owed_cents DESC;
```

Shows per code: total redemptions, confirmed/pending/refunded counts, total gross USD, total owed, already paid, pending payout. **Run this every Monday.**

### 🔬 Drill into one code — full transaction list

```sql
SELECT
  pr.redeemed_at::date AS redeemed_date,
  pr.product_id,
  pr.gross_amount_cents / 100.0 AS gross_usd,
  pr.partner_share_cents / 100.0 AS partner_share_usd,
  pr.status,
  pr.refunded_at::date AS refunded_date
FROM partner_redemptions pr
JOIN partner_codes pc ON pc.id = pr.code_id
WHERE pc.code = 'NALA30'
ORDER BY pr.redeemed_at DESC;
```

The audit trail. Use this if a partner questions a number.

### ⚖️ Compare partners head-to-head

```sql
SELECT
  pc.code,
  pc.partner_name,
  pc.partner_handle,
  count(pr.id) FILTER (WHERE pr.status != 'refunded')      AS active_redemptions,
  count(pr.id) FILTER (WHERE pr.status = 'refunded')       AS refunds,
  round(
    100.0 * count(pr.id) FILTER (WHERE pr.status = 'refunded')
    / NULLIF(count(pr.id), 0),
    1
  )                                                         AS refund_pct,
  sum(pr.gross_amount_cents) FILTER (WHERE pr.status != 'refunded') / 100.0  AS gross_usd,
  sum(pr.partner_share_cents) FILTER (WHERE pr.status != 'refunded') / 100.0 AS share_owed_usd
FROM partner_codes pc
LEFT JOIN partner_redemptions pr ON pr.code_id = pc.id
WHERE pc.status = 'active'
GROUP BY pc.id, pc.code, pc.partner_name, pc.partner_handle
ORDER BY gross_usd DESC NULLS LAST;
```

The "who's actually performing" view. Run monthly. Use it to decide who to keep, scale up, sunset.

### 💰 Pending payouts — your monthly payout list

```sql
SELECT
  pc.code,
  pc.partner_name,
  pc.partner_email,
  count(pr.id)                         AS confirmed_redemptions,
  sum(pr.partner_share_cents) / 100.0  AS amount_owed_usd
FROM partner_codes pc
JOIN partner_redemptions pr ON pr.code_id = pc.id
WHERE pr.status = 'confirmed'      -- past 30-day refund window
  AND pr.paid_at IS NULL           -- not yet paid
GROUP BY pc.id, pc.code, pc.partner_name, pc.partner_email
HAVING sum(pr.partner_share_cents) >= 1000  -- $10 minimum payout threshold
ORDER BY amount_owed_usd DESC;
```

Run this on the **last day of every month**. The output IS your payout list — partner email + amount to send.

### ✅ Mark redemptions as paid after settling

```sql
-- After sending the partner their money via Stripe/PayPal/Wise:
UPDATE partner_redemptions
SET status = 'paid', paid_at = now()
WHERE code_id = (SELECT id FROM partner_codes WHERE code = 'NALA30')
  AND status = 'confirmed'
  AND paid_at IS NULL;

-- Also log the payout for your audit trail:
INSERT INTO partner_payouts (
  code_id, period_start, period_end,
  redemption_count, total_gross_cents, total_partner_share_cents,
  payment_method, transaction_ref, notes
) VALUES (
  (SELECT id FROM partner_codes WHERE code = 'NALA30'),
  '2026-05-01', '2026-05-31',
  47,            -- copy from the payout query
  263113,        -- total gross cents
  78934,         -- total partner share cents
  'stripe_connect',
  'po_xxxxxxxxxxxxxxx',
  'May 2026 settlement'
);
```

### 📊 Payout history — every settlement ever

```sql
SELECT
  pp.paid_at::date AS paid_date,
  pc.code,
  pc.partner_name,
  pp.period_start::date AS period_start,
  pp.period_end::date AS period_end,
  pp.redemption_count,
  pp.total_gross_cents / 100.0 AS gross_usd,
  pp.total_partner_share_cents / 100.0 AS paid_usd,
  pp.payment_method,
  pp.transaction_ref
FROM partner_payouts pp
JOIN partner_codes pc ON pc.id = pp.code_id
ORDER BY pp.paid_at DESC;
```

### 🔄 Auto-confirm cron (recommended — set up once)

Daily cron that promotes `pending` → `confirmed` after the 30-day refund window passes:

```sql
-- Manual one-shot version (run anytime to catch up):
UPDATE partner_redemptions
SET status = 'confirmed', confirmed_at = now()
WHERE status = 'pending'
  AND redeemed_at < now() - interval '30 days';
```

To automate via Supabase pg_cron (run once to set up):

```sql
-- Requires pg_cron extension (enable in Database → Extensions)
SELECT cron.schedule(
  'confirm-partner-redemptions',
  '0 3 * * *',                                              -- daily at 03:00 UTC
  $$
    UPDATE partner_redemptions
    SET status = 'confirmed', confirmed_at = now()
    WHERE status = 'pending'
      AND redeemed_at < now() - interval '30 days';
  $$
);

-- View scheduled jobs:
SELECT * FROM cron.job;

-- Disable:  SELECT cron.unschedule('confirm-partner-redemptions');
```

---

## Part 4 — Other admin operations

### Pro whitelist management

Grant Pro to specific users (influencers / press / power testers) without paying:

```sql
-- Grant Pro to an email (works whether user has signed up yet or not)
INSERT INTO pro_whitelist (email, granted_reason)
VALUES ('amy@catinfluencer.com', 'IG 50K @meow_kingdom — content partnership');

-- Revoke
DELETE FROM pro_whitelist WHERE email = 'amy@catinfluencer.com';

-- See everyone whitelisted
SELECT * FROM pro_whitelist ORDER BY created_at DESC;

-- View merged "who is Pro right now" (paid OR whitelisted OR in trial)
SELECT * FROM admin_whitelist_audit ORDER BY granted_at DESC;
```

### Vet-confirmed story review

After users submit testimonial stories via the in-app modal:

```sql
-- See submissions, newest first
SELECT
  id, created_at, cat_id, original_urgency_tier, health_score,
  catmd_flagged, owner_observed, vet_confirmed, outcome,
  permission_level, contact_email
FROM vet_confirmed_stories
ORDER BY created_at DESC;

-- Mark a story as press-pitch worthy
UPDATE vet_confirmed_stories
SET press_pitch_candidate = true, marketing_status = 'reviewed'
WHERE id = '<uuid>';

-- View stories ready to pitch (with usable permission levels)
SELECT * FROM vet_confirmed_stories_press_ready;

-- Decline a story (still preserved, just hidden from pipeline)
UPDATE vet_confirmed_stories
SET marketing_status = 'declined',
    internal_notes = 'Reason: content didn''t align with health-triage angle'
WHERE id = '<uuid>';
```

### Force-delete a user's data (forget me)

Users tap "Delete everything" in Settings → app calls `rpc('forget_me')`. If you ever need to run this manually for support:

```sql
-- Replace with the actual auth.uid
SELECT public.forget_me_for_user('user-uuid-here');
```

⚠️ This is **destructive and irreversible**. Cats, events, scans, photos, world entries, becoming, subjects, self-facts — all wiped.

### Manually start a user's trial (rare)

If a user is somehow stuck without a trial (clock bug, migration issue, etc.):

```sql
-- Set trial start to now for a specific user
INSERT INTO user_trial_state (user_id, trial_started_at)
VALUES ('user-uuid-here', now())
ON CONFLICT (user_id) DO UPDATE SET trial_started_at = now();
```

---

## Part 5 — Routine monitoring queries

### Health check — events flowing today

```sql
-- Are events being logged in real time? Run after suspecting a sync issue.
SELECT
  type,
  count(*) AS events_today
FROM cat_events
WHERE ts >= now() - interval '24 hours'
GROUP BY type
ORDER BY events_today DESC;
```

### Most-active users (last 7 days)

```sql
SELECT
  user_id,
  count(*) AS event_count_7d
FROM cat_events
WHERE ts >= now() - interval '7 days'
GROUP BY user_id
ORDER BY event_count_7d DESC
LIMIT 20;
```

### Trial expiry watch — who's about to convert or churn

```sql
-- Trials ending in the next 3 days
SELECT
  uts.user_id,
  uts.trial_started_at,
  uts.trial_started_at + interval '14 days' AS trial_ends_at,
  (uts.trial_started_at + interval '14 days') - now() AS time_left
FROM user_trial_state uts
WHERE uts.trial_started_at + interval '14 days' BETWEEN now() AND now() + interval '3 days'
ORDER BY uts.trial_started_at;
```

### Storage usage — sanity check

```sql
-- Per-table row counts (catches runaway data growth)
SELECT
  schemaname || '.' || tablename AS table_name,
  n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

---

## Part 6 — Backup & disaster recovery

### Manual snapshot

Supabase auto-backs up daily on paid plans. For an extra safety net before major schema changes:

```sql
-- Export critical tables as CSV (run in SQL Editor — Supabase will offer "Download as CSV")
SELECT * FROM cats;
SELECT * FROM cat_events;
SELECT * FROM partner_codes;
SELECT * FROM partner_redemptions;
SELECT * FROM partner_payouts;
SELECT * FROM vet_confirmed_stories;
```

Store the CSV files offline. Reimport via `\copy` if needed.

### Test the forget-me path

Critical regulatory requirement (GDPR Art. 17). Test once per quarter on a fresh test account:

1. Create a test user in the app
2. Generate one of each: cat, scan, chat turn, diary entry, photo, world entry, named subject
3. Tap "Delete everything" in Settings
4. Verify with: `SELECT count(*) FROM cats WHERE user_id = 'test-uuid';` (should be 0)
5. Same for `cat_events`, `mood_feedback`, `becoming_state`, etc.

---

## Part 7 — Required environment / secrets

### Cloudflare Worker secrets (set via `wrangler secret put`)

```bash
cd proxy

# RevenueCat webhook authentication
wrangler secret put RC_WEBHOOK_SECRET
# paste a long random string; same value in RC dashboard

# Supabase access from the Worker
wrangler secret put SUPABASE_URL
# https://your-project.supabase.co

wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# from Supabase → Project Settings → API → service_role key
```

### App-side env (already in `.env` / EAS env)

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_POSTHOG_API_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST`
- `EXPO_PUBLIC_AI_BASE_URL` (Cloudflare Worker URL)
- `EXPO_PUBLIC_AI_APP_SECRET`
- `EXPO_PUBLIC_RC_ANDROID_KEY` (RevenueCat Android SDK key)
- `EXPO_PUBLIC_ENABLE_PAYWALL=true`
- `EXPO_PUBLIC_FREE_SCANS_PER_MONTH=0`
- `EXPO_PUBLIC_TRIAL_LENGTH_DAYS=14`

---

## Part 8 — Update protocol for this doc

When ANY of these change, update this file:

- A new schema file is added to `knowledge-pipeline/supabase/`
- A new RPC is introduced and called from the app
- A new admin operation (manual SQL) becomes routine
- A new Cloudflare Worker secret is required
- A new Supabase project setting (auth, RLS policy, extension) becomes mandatory

Single source of truth for setup + ops. If someone new joins, this is the doc that gets them dangerous in 30 min.

---

## Quick-reference: the SQL you'll actually use weekly

```sql
-- Monday morning: how's the program doing?
SELECT * FROM partner_code_summary WHERE status = 'active' ORDER BY total_owed_cents DESC;

-- Last day of month: who do I owe?
SELECT pc.code, pc.partner_name, pc.partner_email, sum(pr.partner_share_cents)/100.0 AS owed_usd
FROM partner_codes pc JOIN partner_redemptions pr ON pr.code_id = pc.id
WHERE pr.status = 'confirmed' AND pr.paid_at IS NULL
GROUP BY pc.id, pc.code, pc.partner_name, pc.partner_email
HAVING sum(pr.partner_share_cents) >= 1000
ORDER BY owed_usd DESC;

-- After paying: mark settled
UPDATE partner_redemptions SET status = 'paid', paid_at = now()
WHERE code_id = (SELECT id FROM partner_codes WHERE code = 'NALA30')
  AND status = 'confirmed' AND paid_at IS NULL;

-- New partner sign-up:
INSERT INTO partner_codes (code, partner_name, partner_handle, partner_email, royalty_pct, status, notes)
VALUES ('NEWCODE30', 'New Partner', 'newpartner', 'new@example.com', 30.0, 'active',
        'Audience size, content style, payout method here');
```

That's 90% of what you'll ever run.
