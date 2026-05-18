# Partner Code System — Activation Checklist (do these now)

> **What this is:** the sequential set of actions to take RIGHT NOW to turn on the partner coupon code pipeline. Each step is required; doing them out of order breaks the next one.
>
> **Estimated time:** ~25 minutes end-to-end if you don't get distracted.
>
> **What's already done in code (no action needed):** Supabase schema file, app paywall coupon UI, RevenueCat subscriber-attribute wiring, Cloudflare Worker webhook handler. All shipped to the repo. Just needs to be activated.
>
> **For routine ops (running weekly/monthly):** see `docs/SUPABASE-SETUP-AND-OPERATIONS.md`. This doc is the one-time activation runbook.

---

## ✅ Step 1 — Run the partner code SQL (2 min)

This is the **only SQL you need to run** to enable the partner code system. It creates:
- 3 tables: `partner_codes`, `partner_redemptions`, `partner_payouts`
- 1 RPC: `validate_partner_code(code)` — called by the app paywall
- 1 view: `partner_code_summary` — for your weekly performance check

### How to run

1. Open https://supabase.com/dashboard → CatMD project → **SQL Editor**
2. Click **New query**
3. Open the file `knowledge-pipeline/supabase/schema-partner-codes.sql` from the repo
4. **Copy the entire file contents**
5. Paste into the Supabase SQL editor
6. Click **Run** (or Cmd/Ctrl + Enter)
7. Confirm "Success" in the bottom panel

⚠️ If you get permission errors, you're not logged in as project owner. Fix permissions or have the right account run it.

---

## ✅ Step 2 — Verify the SQL ran cleanly (30 sec)

Paste this in the SQL editor and run:

```sql
-- Should return exactly 3 rows: partner_codes, partner_payouts, partner_redemptions
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('partner_codes', 'partner_redemptions', 'partner_payouts')
ORDER BY table_name;

-- Should return 1 row: validate_partner_code
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'validate_partner_code';

-- Should return 1 row: partner_code_summary
SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'partner_code_summary';
```

You should see **3 + 1 + 1 = 5 rows total**. If any are missing, the schema didn't run completely — re-paste the file.

---

## ✅ Step 3 — Test the RPC works (30 sec)

The app calls `validate_partner_code()` from the paywall. Test it returns the right shape:

```sql
-- Should return one row: valid=false, reason='code_not_found'
SELECT * FROM validate_partner_code('NONEXISTENT_CODE');
```

Expected output:
```
 valid | product_id | code_id | partner_name |     reason
-------+------------+---------+--------------+----------------
 false |            |         |              | code_not_found
```

If you get a different error, the RPC didn't install. Re-paste the schema file.

---

## ✅ Step 4 — Create your first test partner code (30 sec)

Insert a test code so you can verify the end-to-end flow once everything's wired:

```sql
INSERT INTO partner_codes (
  code, partner_name, partner_handle, partner_email, royalty_pct, status, notes
) VALUES (
  'TESTCODE30',
  'Internal Test',
  'test',
  'support@catmd.pet',
  30.0,
  'active',
  'Activation smoke test — created during pipeline setup. Archive after first real partner onboarded.'
);

-- Verify it validates correctly:
SELECT * FROM validate_partner_code('TESTCODE30');
-- Expected: valid=true, product_id='pro_annual_partner', partner_name='Internal Test'
```

You should see `valid = true` and `product_id = 'pro_annual_partner'`.

---

## ✅ Step 5 — Create the discounted product in Google Play Console (5 min)

The app's paywall calls `Purchases.purchasePackage()` with the package whose product ID matches what `validate_partner_code` returns (`pro_annual_partner`). This product must exist in Play Console at the discounted price.

### Steps

1. Open https://play.google.com/console → CatMD app
2. Left sidebar → **Monetize → Products → Subscriptions**
3. Click **Create subscription**
4. **Product ID:** `pro_annual_partner` ← exact match required, lowercase, with underscores
5. **Name:** `CatMD Pro Annual (partner discount)`
6. **Description:** `Annual access to all CatMD Pro features at the partner-program discounted rate. Renews automatically.`
7. **Benefits:** copy from your existing Pro Annual subscription's benefits list
8. Click **Save**
9. On the subscription detail page → **Add base plan**:
   - **Base plan ID:** `monthly-renewing-annual-partner`
   - **Billing period:** 1 year
   - **Auto-renewing:** Yes
   - **Free trial:** None
   - **Price:** **$55.99 USD** (the system will auto-convert for other countries; review the conversions)
10. Click **Save** → **Activate**

⚠️ Activation takes ~1 hour to propagate to all regions/devices.

---

## ✅ Step 6 — Import the product into RevenueCat (3 min)

RevenueCat needs to know about the new product before the app can purchase it.

1. Open https://app.revenuecat.com → CatMD project
2. **Products** → **+ New** → **Google Play** → search for `pro_annual_partner`
3. Once imported → click into the product → **Entitlements** → attach it to the same entitlement your other Pro plans use (probably called `pro` or `pro_access`)
4. Go to **Offerings** → your "current" offering → **+ Add Package**
5. Select `pro_annual_partner` → save

⚠️ If you don't add the product to the **current** offering, `findPackageByProductId('pro_annual_partner')` returns null in the app, and the paywall will show "this code is valid, but the discounted plan isn't available right now" when a user enters a code. Don't skip this.

---

## ✅ Step 7 — Configure the RevenueCat webhook (3 min)

RevenueCat fires a webhook to the Cloudflare Worker every time a subscription event happens (purchase, renewal, refund). The Worker writes redemptions to Supabase.

### Steps

1. Open https://app.revenuecat.com → CatMD project → **Integrations** → **Webhooks**
2. Click **+ Add new** (or "Connect new")
3. **URL:** `https://catmd-ai-proxy.folio-app-2026.workers.dev/api/rc-webhook`
4. **Authorization header:** generate a random 32+ char string. Use:
   ```
   openssl rand -hex 32
   ```
   Or any password manager. Example output: `8f3a7e6b...4d2c`. **Copy this value — you'll paste it in Step 8.**
5. **Events to send:** select all subscription events (Initial Purchase, Renewal, Cancellation, Refund, Expiration, Billing Issue, Product Change, Subscription Lifecycle). Leaving extras on is fine; the Worker filters internally.
6. Click **Save**

---

## ✅ Step 8 — Set Cloudflare Worker secrets (3 min)

The Worker needs 3 secrets to function. Set them via `wrangler` CLI from the `proxy/` directory:

```bash
cd /d/apps/catmd/proxy

# 1. The RC webhook auth string (must match Step 7)
wrangler secret put RC_WEBHOOK_SECRET
# Paste the same value you used in RC webhook Authorization header

# 2. Your Supabase project URL
wrangler secret put SUPABASE_URL
# Paste your Supabase URL: https://YOUR-PROJECT.supabase.co
# Find at: Supabase dashboard → Project Settings → API → Project URL

# 3. The Supabase service role key (NOT the anon key!)
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Find at: Supabase dashboard → Project Settings → API → service_role secret
# Treat like a password — has full DB write access
```

After each `wrangler secret put` command, paste the value and press Enter. You'll see `✔ Success` if it worked.

### Verify the secrets are set

```bash
wrangler secret list
```

Should show at least: `RC_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (alongside any pre-existing ones like `OPENAI_API_KEY`).

---

## ✅ Step 9 — Deploy the Cloudflare Worker (1 min)

The Worker code changes are committed locally but not yet pushed to Cloudflare. Deploy:

```bash
cd /d/apps/catmd/proxy
npx wrangler deploy
```

Wait for "Deployed catmd-ai-proxy triggers" → ~15-20 seconds. Done.

### Verify the webhook route is live

```bash
# Hit the route with no auth — should return 401
curl -X POST https://catmd-ai-proxy.folio-app-2026.workers.dev/api/rc-webhook \
  -H "Content-Type: application/json" \
  -d '{"event": {"type": "TEST"}}'

# Expected response:
# {"error":"invalid authorization"}
```

If you get `{"error":"webhook secret not configured"}` instead — your Worker doesn't have the secret yet. Re-run Step 8.

---

## ✅ Step 10 — Build & ship vc 96 to Play Production (~20 min EAS build + Play review)

The app paywall changes (coupon entry modal, code validation, product switch) ship in vc 96. The CURRENT live build (vc 94) does NOT have the coupon UI — users can't redeem codes until vc 96 is on their device.

```bash
cd /d/apps/catmd
npx eas build --platform android --profile production --non-interactive
```

EAS will:
1. Auto-bump versionCode (94 → 95 or 96)
2. Build the AAB
3. Upload to EAS dashboard

Then YOU:
1. Download the AAB from the EAS dashboard
2. Upload to Play Console → Production track → Create new release
3. Add release notes ("Partner code redemption support")
4. Submit for review (typically auto-approved within minutes for content updates)

⚠️ **Important:** during the ~1 hour window between Play Console release approval and the new APK propagating to all users, some users will see the OLD paywall (no coupon entry) while others see the NEW paywall. Don't share partner codes publicly until you've confirmed the new AAB is rolled out to all regions.

---

## ✅ Step 11 — Smoke test the whole pipeline (5 min)

After vc 96 is rolled out on Play (check by uninstalling + reinstalling on your test device — confirm the paywall has a "Have a partner code?" link):

### The full end-to-end flow

1. **Test device:** open CatMD → hit any paywall (try entering an AI-feature surface, or trigger via Settings → Subscribe)
2. **Paywall:** tap "Have a partner code?"
3. **Modal opens:** enter `TESTCODE30`
4. **Tap "Apply code":** expect green banner showing "TESTCODE30 applied · 30% off · Partner: Internal Test · $55.99"
5. **Tap "Subscribe":** Google Play checkout opens at **$55.99/year** (NOT $79.99)
6. **Complete the test purchase** (use a real test card or a free Google Play promotional pass)
7. **Wait 30 seconds** for RevenueCat → Worker → Supabase to propagate
8. **In Supabase SQL editor**, run:

```sql
SELECT
  pc.code, pc.partner_name,
  pr.product_id, pr.gross_amount_cents / 100.0 AS gross_usd,
  pr.partner_share_cents / 100.0 AS partner_share_usd,
  pr.status, pr.redeemed_at
FROM partner_redemptions pr
JOIN partner_codes pc ON pc.id = pr.code_id
ORDER BY pr.redeemed_at DESC
LIMIT 5;
```

You should see your test redemption with:
- `code: TESTCODE30`
- `gross_usd: 55.99`
- `partner_share_usd: 16.80` (= 30% of 55.99)
- `status: pending`

✅ **If you see this row, the entire pipeline is working.**

### Cleanup after smoke test

```sql
-- Archive the test code so it's not redeemable anymore
UPDATE partner_codes
SET status = 'archived', archived_at = now()
WHERE code = 'TESTCODE30';

-- (Optional) Cancel your test subscription in Play Store so you don't keep charging your test card
```

The test redemption row stays in `partner_redemptions` for the audit trail — that's correct.

---

## ❌ Common failures & fixes

### "Code is valid, but the discounted plan isn't available right now"
- The product `pro_annual_partner` isn't in your RevenueCat "current" offering
- Fix: RevenueCat → Offerings → current → Add Package → select `pro_annual_partner`

### Paywall doesn't show "Have a partner code?" link
- You're on vc 94 or older. Wait for vc 96 to install or hard-refresh by reinstalling.

### Webhook fires but nothing in `partner_redemptions`
- The user's RC `subscriber_attributes.partner_code_id` is empty
- Fix: confirm `setPartnerCodeAttribute(codeId)` ran BEFORE `purchasePackage()` — check app logs
- Or the webhook auth is failing — `wrangler tail` will show the 401

### "supabase env missing" in worker logs
- `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` secret not set
- Fix: re-run Step 8

### Webhook hits but Supabase returns 401
- Service role key is wrong or rotated
- Fix: get fresh key from Supabase → Project Settings → API → Service Role → re-run `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`

### "Authorization invalid" 401 from webhook
- `RC_WEBHOOK_SECRET` mismatch between RevenueCat dashboard and Cloudflare Worker
- Fix: re-paste the same string in both places, redeploy worker

---

## Once activated, what's the daily/weekly workflow?

After everything above is done, the day-to-day work is:

**When a new influencer signs:**
```sql
INSERT INTO partner_codes (code, partner_name, partner_handle, partner_email, royalty_pct, status, notes)
VALUES ('THEIR_CODE30', 'Their Name', 'their_handle', 'their@email', 30.0, 'active', 'Audience + payout details');
```
Then share the code with them. Their code is live immediately.

**Weekly:** check performance
```sql
SELECT * FROM partner_code_summary WHERE status = 'active' ORDER BY total_owed_cents DESC;
```

**Monthly:** pay them out
- Query who's owed money (see `SUPABASE-SETUP-AND-OPERATIONS.md` § Performance tracking)
- Send via Stripe/PayPal/Wise
- Mark redemptions as paid (SQL UPDATE in the same doc)

All the routine ops queries live in `docs/SUPABASE-SETUP-AND-OPERATIONS.md`. This doc is just the one-time activation.

---

## Checklist summary (print this, tick each step)

```
[ ] Step 1   — Ran schema-partner-codes.sql in Supabase
[ ] Step 2   — Verified 3 tables + 1 RPC + 1 view exist
[ ] Step 3   — Tested validate_partner_code returns code_not_found for fake code
[ ] Step 4   — Inserted TESTCODE30 + verified it validates
[ ] Step 5   — Created pro_annual_partner product in Play Console at $55.99
[ ] Step 6   — Imported pro_annual_partner into RevenueCat + attached to entitlement + added to current offering
[ ] Step 7   — Configured RC webhook → catmd-ai-proxy worker URL + saved auth string
[ ] Step 8   — Set 3 Cloudflare Worker secrets (RC_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
[ ] Step 9   — Deployed worker (npx wrangler deploy) + verified 401 on unauth POST
[ ] Step 10  — Built vc 96 + pushed to Play Production + confirmed rollout
[ ] Step 11  — Smoke-tested end-to-end with TESTCODE30 + saw row in partner_redemptions
[ ] Step 11b — Archived TESTCODE30
```

When all 12 boxes ticked — **the partner code pipeline is live**. You can give out real codes to real influencers from this point on.
