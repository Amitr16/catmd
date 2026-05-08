# CatMD — Cloud Sync & Cross-Device Restore Plan

> **Status (2026-05-03 EOD)**: MVP shipped via EAS update
> `019deda2-178b-789a-b697-56fa74318ebb`. Same-device reinstall restore
> works for cats / scans / health events. Cross-platform restore (iOS ↔
> Android, different app-store account) is Phase B — not yet shipped.

---

## Architectural rule

> **Pro users are always signed in (verified email). Sign-in is the
> identity for cloud backup. Free users are 100% local.**

Email is the cross-platform key, not the app store account. Apple ID /
Google Play handles subscription enforcement; email handles data
identity. The two are bound at first Pro purchase.

---

## What's shipped (MVP — Phase A)

### 1. Paywall email gate (`app/paywall.tsx`)

When an anonymous user taps **Subscribe**:

- Inline info banner appears explaining: *"We'll ask for your email
  next — Pro members get cloud backup so your cat's history follows
  you to any device."*
- Tap routes to `/upgrade-account?gate=paywall`
- Existing OTP flow: email + password → 6-digit code → verify
- After verify, user goes to `/(main)`. They tap Subscribe again from
  there (the existing Today / Settings paywall entry); this time the
  email gate passes and `purchasePackage()` proceeds.
- Telemetry: `paywall_email_gate_shown` event tracks the funnel split.

### 2. Auto-restore on email verification (`app/upgrade-account.tsx`)

After successful OTP verification, fire-and-forget:

- **PostHog alias**: `identify(email, { email })` binds the anonymous
  distinct_id to the user's email so support can find them by email.
- **Cloud restore**: call `restoreFromCloudIfNeeded()` which:
  1. Pulls cats / scans / non-scan events from Supabase keyed by
     `auth.uid()`
  2. Only applies them if local Zustand stores are all empty (fresh
     install). If user has any local data, that wins — never clobber.
  3. If restore happens, fires `cloud_restore_succeeded` event with
     counts (cats / scans / events).

This works for **same-platform reinstalls**: user signs up with
email → Supabase user_id assigned → data pushes to cloud keyed by
that uid. Reinstall same store → fresh anonymous Supabase session →
sign in with same email → user_id resolves to the original → restore
fetches their data.

### 3. Push side (already existed pre-MVP)

- `syncCatToCloud` — fires on cat add/patch
- `syncScanToCloud` — fires on scan create/update
- `syncHealthEventToCloud` — fires on every health event
- All gated on `supabase.auth.getUser()` returning a real user.
  Anonymous users bail out, free users (no email = anonymous) too.

### 4. Pull side, extended (`src/services/sync.ts`)

- `pullFromCloud()` now also returns non-scan events from `cat_events`
  table (was cats + scans only). 2000-row limit; sufficient for most
  users for ≥1 year of activity.
- `restoreFromCloudIfNeeded()` is the new public entry point. Bypasses
  store actions (which would re-trigger cloud sync) and writes via
  `setState` directly to avoid feedback loops.

---

## What's NOT shipped — Phase B follow-ups

### B1. Cross-platform / different-account restore (~3 hrs)

**Scenario**: user paid Pro on iOS with email A. Switches to Android.
Installs CatMD on Android. Goes to Settings → "Sign in" → enters
email A.

**Current behaviour**: the existing `addEmailToAccount()` in
`auth.ts` does signUp (no session) or updateUser (anonymous session).
Neither matches the case where the email *already exists* on the
backend. Result: error "User already registered" or similar. User
stuck.

**Fix**: extend `upgrade-account.tsx` (or build a sibling `/sign-in`
screen) to detect "email already in use" and switch to
`signInWithEmail(email, password)`. After signIn succeeds:

- Supabase user_id flips to the original
- `restoreFromCloudIfNeeded()` fires automatically (already wired)
- User sees their data restored

**Sub-tasks:**
- Detect specific Supabase error codes (`User already registered` etc.)
  in `addEmailToAccount` → throw a typed error
- UI: "This email already has a CatMD account. Sign in with your
  password?" → password field appears → signIn flow
- Forgot-password recovery: Supabase `resetPasswordForEmail()` link
  in the same flow
- Settings → new "Restore from another device" entry point that
  routes directly to this sign-in flow (skips the OTP step)

### B2. Cloud sync for postcards / diary / personality / notif prefs (~2 hrs)

Currently NOT pushed at all (only cats / scans / health events sync).
Add per-store `syncFooToCloud` functions that mirror these into
`cat_events` table with a typed `event.type` discriminator:

- `postcard` — text payload (caption + photo URIs + metadata)
- `diary` — text payload (entry text + mood word + date)
- `personality_quiz` — text payload (quiz answers + computed archetype)
- `notif_prefs` — small JSON

Extend `pullFromCloud()` to fetch these too.

Photos referenced by postcards remain local-only until B3.

### B3. Photos + posters → Supabase Storage (~2-3 hrs)

Binary upload path:

- Photo Studio gallery JPEGs (typical ~150KB each, ~4MB / user)
- Cat Studio movie posters (PNG, ~300KB each)
- Postcard collages (could be regenerated from photos + caption — may
  be skippable)

Implementation:

1. Create Supabase Storage bucket `user-media` with RLS policy
   `auth.uid() = (storage.foldername(name))[1]`
2. On photo save (Pro user): upload `<user_id>/<photo_id>.jpg` to bucket
3. Store `cloud_storage_url` field on `PhotoStudioPhoto`
4. On restore: download all referenced photos, save to local
   `documentDirectory/photo-studio/<catId>/<photoId>.jpg`, populate
   the photoStudioStore with rebuilt URIs
5. Show progress UI during photo download ("8/12 photos")

Storage cost: ~$0.02/GB/month past free 1GB tier. ~220 Pro users fit
in free tier; ~10k users = 50GB ≈ $1/month. Negligible.

### B4. Pro-lapse handling (~1 hr)

When a Pro subscription expires (RC webhook → CatMD backend):

- **Local**: nothing changes. User keeps their data on-device.
- **Cloud**: keep for 90 days (typical SaaS grace), archive for 6 more
  months, then delete. Lets a re-subscriber recover their data
  immediately on re-purchase.
- **Restore on new device after lapse**: blocked. Show "Re-subscribe
  to restore your cloud data."

### B5. Server-side global rate limits (~2-3 hrs)

Currently each device self-enforces caps (free user has 3 scans/month
counted from local Zustand). On a multi-device or reinstall scenario,
this is gameable. Move enforcement into the proxy worker:

- Worker checks `cat_events` count for the user's `auth.uid()` against
  the cap before forwarding to OpenAI
- Returns 429 with quota exceeded if over
- App handles 429 → routes to paywall

Not blocking on Pro users (Pro is unlimited or near-unlimited). Free
tier abuse-prevention only. Build when paid users > 100 or free
abuse becomes a measurable problem.

---

## Lookup workflow for support (already enabled by MVP)

User reports an issue via email:
- They email from `their.address@gmail.com`
- You search PostHog for `email = their.address@gmail.com` → see
  full event timeline (PostHog alias bound their distinct_id to email
  on verification)
- You search Supabase `cats` / `cat_events` where joined to user with
  that email → see their data
- You search RevenueCat for the customer associated with that email
  → see subscription status

Single key (email) across all three systems.

---

## Edge cases the MVP handles

- **User already had local data when they verify email**: restore is
  a no-op (safety guard `localCatsEmpty && localScansEmpty &&
  localEventsEmpty`). Their local data wins.
- **Cloud has nothing for this user**: restore is a no-op
  (`cloud_empty` skip). Common for first-ever email verification on a
  user who hasn't pushed anything yet (e.g. they just installed).
- **Network failure during pull**: try/catch wraps `pullFromCloud`;
  failures log but don't break the verification flow. User can
  retry by signing out and signing back in.

## Edge cases the MVP does NOT handle (Phase B territory)

- **Cross-platform restore** (iOS user going to Android with same
  email): currently fails because the email-already-in-use case isn't
  routed through signInWithEmail. See B1 above.
- **Lost password**: no in-app recovery flow yet. User emails support
  for a manual reset.
- **Photo Studio data lost**: photos are not cloud-backed. See B3.
- **Postcard / diary / poster lost**: not synced. See B2.
- **Multi-device active simultaneously**: single-device assumption.
  Multi-device requires conflict resolution we don't have. Defer.

---

## Files modified (MVP)

- `src/services/sync.ts` — extended `pullFromCloud`, new
  `restoreFromCloudIfNeeded` helper, new `RestoreSummary` type
- `app/upgrade-account.tsx` — fire restore + posthog alias on verify
- `app/paywall.tsx` — anonymous-user info banner + email gate in
  `onBuy`, route to `/upgrade-account?gate=paywall`
- `src/services/analytics.ts` — added `cloud_restore_succeeded` and
  `paywall_email_gate_shown` events to the discriminated union

## Pointers back

- Push functions (already existed): `src/services/sync.ts`
  (cats + scans), `src/services/health.ts` (events)
- Auth helpers: `src/services/auth.ts`
- Auth state hook: `src/hooks/useAuthSession.ts`
- Existing email + OTP UI: `app/upgrade-account.tsx`
- RevenueCat wrapper: `src/services/purchases.ts` (already binds RC
  customer to Supabase uid via `identifyPurchasesUser` after email
  verification — no change needed for MVP)

End of cloud-sync plan.
