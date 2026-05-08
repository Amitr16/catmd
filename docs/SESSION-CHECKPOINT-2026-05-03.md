# CatMD Session Checkpoint — 2026-05-03

> **Purpose**: durable record of today's deltas on top of
> `SESSION-CHECKPOINT-2026-05-02.md`. If you're picking up cold, read
> 05-01 → 05-02 first; this doc only covers what changed today.

---

## 0. TL;DR

Today was **post-AAB stabilisation + token tracking + iOS prep handoff**.
No new pillar, no new tab. Six concrete deliveries:

1. ✅ **Today page restructure** — three explicit sections with `SectionLabel`
   dividers (Today / Know your cat / Medical). Hero (score ring) sits above
   without a label. Replaces the previous flat scroll.
2. ✅ **Postcard rendering rebuild** — orientation-aware tiling (3 stripes /
   3 columns / wide-top / tall-left), layout picker per photo aspect, blur
   backdrop fully removed (was the root cause of dark + washed-out exports
   on Android view-shot capture). Capture path hardened with prefetch +
   in-viewport opacity:0 mount + flow-positioned Image.
3. ✅ **PostHog `llm_usage` tracking** — every chat / scan / postcard /
   diary / body-language / identity / poster / embed call emits a typed
   event with `activity`, `model`, token counts, `cost_cents`, `latency_ms`.
   Proxy worker tracks image-gen server-side.
4. ✅ **Onboarding + UX copy tightening** — slide 0 institution drop, slide 1
   parallel benefit phrasing, slide 5 "Find" instead of "Map", removed the
   redundant "daily check-in is waiting" banner, dropped the false
   "sub-second motion registers" claim from Body Language.
5. ✅ **Photos card simplified** — Today no longer renders thumbnails next
   to the camera tile (Photo Studio is canonical). Compact horizontal row
   with Add tile + tappable count + helper text. Daily cap reduced 5 → 4.
6. ✅ **Scan follow-up Dismiss** — Today's pending-scan card has its own
   Dismiss link, writes `outcome_dismissed_at`. Both Today and result.tsx
   read the same flag, so it's a single global gesture.

Production AAB build queued at end of session: `0.1.6` / versionCode 35.

---

## 1. Today page sections (NEW)

The flat scroll had ~17 distinct elements with no visual grouping. New
structure (top → bottom):

- **Hero (no label)**: header → score ring → tier badge / delta caption /
  rescan pill → optional birthday banner
- **`<SectionLabel>Today</SectionLabel>`**: recommended-ritual banner →
  streak pill (≥3 days) → DailyCheckinCard → Photos card
- **`<SectionLabel>Know your cat</SectionLabel>`**: ModuleTile grid (Body
  Language + Health Rhythm)
- **`<SectionLabel>Medical</SectionLabel>`**: Scan now CTA → quota line →
  pending scan-follow-up card → Recent scans heading + list

Spacing rule: `space[8]` (32px) above each label, `space[3]` between
label and first item, tighter spacing within sections.

The `SectionLabel` component already existed in `index.tsx` (lines 929–954)
but was unused. Now consumed three times.

---

## 2. Postcard rendering — full rebuild

The user reported the WhatsApp/Instagram export was darker than the in-app
preview. Took multiple iterations to find the actual root cause. **The
final understanding**:

> `react-native-view-shot` on Android rasterises **`blurRadius` Image
> layers and `LinearGradient`** noticeably differently from the live
> render. There is no fallback bg colour that hides the artefact:
> - Dark fallback + bright photo → dark wash on capture
> - Cream fallback + bright photo → washed-out wash on capture

**Resolution**: removed both. PhotoCell is now a single `<Image>` with
`resizeMode="cover"` (or `contain` when photo dims are missing — legacy
postcards). No blur layers, no LinearGradient, no double-image.

### 2a. Orientation-aware tiling

`PostcardPhoto` now carries optional `width`/`height`. Threaded through
`gatherTodaysPhotos` from `PhotoStudioPhoto`. `pickLayout3()` classifies
each photo as wide / tall / square and picks one of four layouts:

| Photo mix | Layout |
|---|---|
| 3 wide (or all square) | 3 horizontal stripes |
| 3 tall | 3 vertical columns |
| 1 wide + 2 tall | Wide stripe top, 2 tall split bottom |
| 2 wide + 1 tall | Tall column left, 2 wide stacked right |

Photos reorder within the collage so the right-shaped photo lands in the
right-shaped cell (tall in tall cell, wide in wide cell). `pickLayout3`
falls back to 'stripes' if dims are missing — preserves legacy behaviour.

### 2b. Caption legibility

LinearGradient was replaced with two stacked semi-transparent dark Views
(`rgba(0,0,0,0.30)` over `rgba(0,0,0,0.40)`, bottom 22% + 12% of card
height). Approximates a fade without using LinearGradient. Caption text
keeps its hard text-shadow as primary readability.

### 2c. Capture path hardening

Three Android view-shot fixes shipped after the user reported photos
missing entirely from exported JPEG (cream blank with caption only):

- **PhotoCell Image: `position: absolute` → natural flow**. Absolute
  Images sometimes don't rasterise during offscreen capture on Android.
- **Offscreen render: `top: -99999` → `top: 0, opacity: 0`** inside a 1×1
  hidden wrapper. Android skips render passes for children entirely
  outside viewport bounds; opacity:0 keeps them in the render tree.
- **Capture timing: 2 RAF (~32ms) → `Image.prefetch()` + 350ms wait**.
  Gives bitmaps time to actually decode for the offscreen mount.

### 2d. JPEG settings

`captureRef` config: `format: 'jpg', quality: 1.0, width/height` explicit.
JPEG (not PNG) for cross-app rendering consistency; quality 1.0 is truly
lossless; explicit width/height avoids device-DPI scaling.

### 2e. Cached postcard auto-migration

`postcard.tsx` `useEffect` checks all four staleness modes per cached
postcard on view:

- v1 caption prompt
- "Today, …" opener pattern or length > 100
- Missing photo dims (legacy postcards)
- Dead photo URIs (`expo-file-system.getInfoAsync`)
- Photo-count mismatch with current gallery

Recovery path:
- Gallery has photos → call `hydratePhotoDims(catId)` first (Image.getSize
  fallback, patches photoStudioStore), then force regen
- Gallery is empty → `clearTodayForCat(catId)` + show empty-state CTA

One-shot per postcard id via ref guard. New `clearTodayForCat` action
added to postcardStore.

### 2f. Daily cap 5 → 4

`DAILY_CAP_PER_CAT` reduced. The 5-cell collage was cramped — 4 matches
the orientation-aware layouts cleanly. Hardcoded "5/5 today" labels on
Today + Bond replaced with `{DAILY_PHOTO_CAP} / {DAILY_PHOTO_CAP}` so
they auto-sync with the constant. Photo Studio cap-hit copy was already
generic.

---

## 3. PostHog `llm_usage` tracking — both phases shipped

User asked: "Possible to have posthog tracking llm token usage for each
user and activity?" — both client-side and proxy-side delivered.

### 3a. New event in `services/analytics.ts`

```ts
type: 'llm_usage';
props: {
  activity: LLMActivity;        // closed enum, 11 values
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  image_count?: number;          // image-gen
  audio_seconds?: number;        // Whisper
  cost_cents?: number;           // estimated, 4-decimal precision
  latency_ms?: number;
  source?: 'client' | 'proxy';
};
```

`LLMActivity` enum: `chat | scan_triage | scan_classify | pain_score |
postcard_caption | diary_generation | body_language_vision |
body_language_audio | identity_match | cat_studio_poster | embedding_rag`.

Cost estimator `estimateLLMCostCents()` uses a baked price table for
gpt-4o-mini, gpt-4o, text-embedding-3-small, gpt-image-1, whisper-1.
Pricing snapshot comment in code includes the date so we can refresh
later. `trackLLMUsage()` helper auto-estimates cost if not passed.

### 3b. Client wiring

`completeJson`, `completeText`, `embed` in `src/ai/client.ts` all take
**required** `activity: LLMActivity` parameter. After successful response
they extract `payload.usage` and call `trackLLMUsage` automatically.

`transcribeBehaviorAudio` (Whisper) tracks `audio_seconds: 6` (clip
duration constant, hardcoded since Whisper response doesn't include
duration).

`generateImage` does NOT track client-side when `baseUrl` (proxy) is
set — proxy is the canonical emitter for image-gen to avoid duplicate
events. Falls back to client-side track when baseUrl is empty (dev
direct-to-OpenAI).

All 9 call sites updated to pass `activity`:
- `services/postcard.ts` → `'postcard_caption'`
- `services/diary.ts` → `'diary_generation'`
- `services/behaviorObservation.ts` → `'body_language_vision'`
- `services/identityMatch.ts` → `'identity_match'`
- `services/catStudio.ts` → `'cat_studio_poster'`
- `services/chat.ts` → `'chat'` + `'embedding_rag'`
- `ai/triage.ts` → `'scan_triage'` + `'embedding_rag'`
- `ai/classify.ts` → `'scan_classify'`
- `ai/fgs.ts` → `'pain_score'`

### 3c. Proxy wiring (`proxy/worker.ts`)

- New env `POSTHOG_PROJECT_KEY` (Cloudflare secret, set via
  `wrangler secret put`)
- New env `POSTHOG_HOST` (defaults to `https://us.i.posthog.com`)
- New `IMAGE_PRICE_USD_PER_CALL` table mirroring client-side prices
- Reads `X-CatMD-Activity` and `X-CatMD-User-Id` headers from app
- After successful upstream response on `/v1/images/edits` or
  `/v1/images/generations`, fires `ctx.waitUntil(fetch(POSTHOG /capture))`
  with the typed payload, `source: 'proxy'`
- Best-effort — failures logged, never blocks user-facing response

App passes the headers from `generateImage()` only when `baseUrl` (proxy)
is set, using `await getDistinctId()` from analytics.

### 3d. New analytics export

```ts
export async function getDistinctId(): Promise<string | null>
```

Reads PostHog SDK's `getDistinctId()` synchronously after the SDK is
ready. Returns null pre-init → proxy logs as `'anonymous-proxy'`.

### 3e. Worker version

`2282bd38-cdc7-4a2e-a0c6-7e5be45d99dc` — deployed via
`wrangler deploy` with `POSTHOG_PROJECT_KEY` secret set. Endpoint:
`https://catmd-ai-proxy.folio-app-2026.workers.dev`.

### 3f. PostHog dashboard recipe

Three Insights to build first:

1. **Spend by feature** — Trends, sum of `cost_cents` grouped by
   `activity`, daily breakdown.
2. **Top spenders** — Trends, sum of `cost_cents` grouped by
   `distinct_id`, sorted desc, last 30 days.
3. **Model mix** — Trends, count of `llm_usage` grouped by `model`.
   Catches mini→4o leaks.

---

## 4. UX copy tightening

### 4a. Onboarding (`app/onboarding.tsx`)

- **Slide 0 (positioning)**: dropped the institution drop "Cornell, Merck,
  AAFP, ISFM, and the Litchfield Feline Five" → "trained on vet-curated
  feline medicine".
- **Slide 1 (pillar rows)**: re-balanced to parallel benefit phrasing.
  Bond was particularly cluttered ("Personality, daily diary, photo
  time-lapse, body-language reads") → "Personality, photo memories, daily
  diary written for you".
- **Slide 5 (activation tile 3)**: "Map [name]'s personality" → "Find
  [name]'s personality". "Map" was clunky.

### 4b. Today recommended-ritual banner

Removed the no-checkin-today path entirely. Was: "Luna's daily check-in
is waiting — 30 seconds." DailyCheckinCard right below already says
"How is Luna today?" — duplicate noise. Banner now only shows for the
genuinely different nudges:

- Body language read stale (>6 days)
- Suggest-rescan from health-score adjustment
- Default upbeat mood-clip nudge (only AFTER check-in is logged)

When none fire, banner returns null.

### 4c. Body Language

Removed the false claim "Sub-second motion (sharp tail flicks, quick body
shifts) registers too." We sample 6 frames over 6 seconds = 1Hz; sub-100ms
motion genuinely falls between frames. Kept the honest line about posture,
tail, ears, eye state, broad movement, vocalisations.

### 4d. Photo strip (Today only — Bond left as-is per user)

Removed thumbnail row entirely. Compact horizontal layout: Add tile (left)
+ section header `PHOTOS · 3/4 · View all →` + helper text (right). Tap
the count to open Photo Studio. Helper text trimmed.

Shorter helper variants:
- Empty: "Feeds [name]'s Postcard, Poster, Diary, and time-lapse."
- At cap: "Daily cap reached. More tomorrow."
- Default: "Each photo feeds today's Postcard + Poster."

---

## 5. Scan follow-up Dismiss

Added a Dismiss link to Today's pending-scan card. Right-aligned ghost
caption. On press writes `outcome_dismissed_at: new Date().toISOString()`
via `useScanStore.updateScan`. Both Today and `app/result.tsx` read this
flag, so dismiss is global.

Card structure changed from single Pressable to outer View containing:
- Inner Pressable (open outcome-check screen)
- Inner Dismiss row (right-aligned)

---

## 6. Today header / sections — section label component

`SectionLabel` is a small all-caps muted-color caption with:
- `letterSpacing: 1.2`
- `textTransform: 'uppercase'`
- `fontFamily: 'Figtree_600SemiBold'`
- `fontSize: 11`

Already defined in `index.tsx` lines 929–954. Now consumed three times
with `marginTop: space[8], marginBottom: space[3]`.

---

## 7. Deltas by file (this session)

### Modified
- `app/(main)/index.tsx` — three SectionLabels, banner suppression,
  Photos card redesign, Dismiss on follow-up card, hardcoded 5→DAILY_PHOTO_CAP
- `app/onboarding.tsx` — slide copy tightening
- `app/postcard.tsx` — comprehensive auto-migration (caption + dims +
  dead URIs + count mismatch + empty), prefetch + 350ms wait, opacity:0
  in-viewport offscreen wrapper, JPEG quality 1.0, `localDateKey` import
- `app/behavior.tsx` — dropped sub-second-motion claim
- `src/components/PostcardShareCard.tsx` — full rebuild: orientation-aware
  layouts, single-Image PhotoCell (no blur), pseudo-gradient via two
  stacked Views, CREAM PHOTO_FALLBACK
- `src/services/postcard.ts` — `width`/`height` on PostcardPhoto, threaded
  through `gatherTodaysPhotos`
- `src/state/postcardStore.ts` — new `clearTodayForCat` action
- `src/state/photoStudioStore.ts` — new `hydratePhotoDims(catId)` action
  (Image.getSize fallback), DAILY_CAP_PER_CAT 5→4
- `src/state/personalityStore.ts` — defensive `migrate` callback v1→v2
- `src/services/analytics.ts` — `LLMActivity` enum, `llm_usage` event,
  cost estimator, `trackLLMUsage`, `getDistinctId`
- `src/ai/client.ts` — required `activity` on completeJson / completeText /
  embed / generateImage; auto-track on success; image-gen header injection
- `src/services/behaviorObservation.ts` — Whisper tracking with
  audio_seconds=6
- `src/services/postcard.ts`, `src/services/diary.ts`,
  `src/services/identityMatch.ts`, `src/services/catStudio.ts`,
  `src/services/chat.ts`, `src/ai/triage.ts`, `src/ai/classify.ts`,
  `src/ai/fgs.ts` — pass `activity` argument
- `proxy/worker.ts` — POSTHOG_PROJECT_KEY env, IMAGE_PRICE_USD_PER_CALL
  table, TRACKED_PATHS set, header reading + ctx.waitUntil PostHog post
- `proxy/wrangler.toml` — cron triggers + KV binding REMOVED (audio-trends
  feature was cut earlier; cleaned up here)
- `app.json` — version 0.1.5 → 0.1.6, versionCode 34 → 35

### Added
- `docs/SESSION-CHECKPOINT-2026-05-03.md` — this file
- `docs/IOS-SETUP-GUIDE.md` — iOS handoff for next Claude session

### Removed
- LinearGradient from PostcardShareCard (was the dark-export root cause)
- Photo thumbnail strip from Today (Bond keeps it)

---

## 8. Build state

- **EAS preview channel** — runtime 0.1.5, multiple updates pushed today.
  Latest: `019debe4-fa4b-7338-bbcd-87f896e12c1f` (capture fix + cap 4).
- **EAS production AAB** — build `df886cb8-01fb-472c-8d87-31dafa81ad8c`
  queued at end of session. App version 0.1.6 / versionCode 35.
  - Logs: https://expo.dev/accounts/amit1601/projects/catmd/builds/df886cb8-01fb-472c-8d87-31dafa81ad8c

### Background EAS push silent-failure (recurring infra issue)

Three times today, a backgrounded `eas update --branch preview` call
exited 0 with an empty output file but the update never appeared in the
published list. Foreground (synchronous) calls always work. Worth
flagging to Expo / monitoring — but not blocking. Workaround: always
push synchronously, or verify post-hoc with `eas update:list`.

---

## 9. Play Store release notes (0.1.6)

```
What's new in 0.1.6:

• Postcards: smarter photo collages — layout adapts to portrait/landscape mix, no more dark or washed-out exports
• Today: cleaner layout grouped into Today / Know your cat / Medical sections
• Scan follow-up cards now have a Dismiss option
• Body language reader: clearer description of what the AI actually sees
• Daily photo cap: 4/day (collages stay tidy)
• Various copy tightening across onboarding and tiles
```

478 chars. Fits Play Store's 500-char limit.

---

## 10. Pointers for fresh-context resumption

- For prior context (rebrand, four-pillar architecture, Triage absorption,
  Chat MVP, Personality v1, Cat Diary, all the history): read the
  earlier checkpoints in this folder.
- For iOS build/deploy work: read `docs/IOS-SETUP-GUIDE.md` — that doc is
  written so a fresh Claude session can execute the iOS workflow without
  re-deriving any decisions.
- Active todo backlog beyond today:
  - Photo Studio v2 (vision pass for coat / posture cues)
  - Long-form articles beyond 20
  - More Phase-2 RAG cards beyond 642
  - Streaming chat (RN finickiness — defer)
  - Pro tier features for Personality (drift, cat-cat compatibility)
  - Multi-cat dynamics + senior cat mode (deferred)
  - Walk-through video for first-time users (deferred from earlier)
  - Tap-to-confirm flow on photo verify pill (deferred from earlier)

---

## 12. Late-session deltas (after the original checkpoint was written)

A second wave of work happened after §10 was drafted — captured here
so this doc reflects the actual end-of-session state.

### 12a. Feline Grimace Scale promoted to primary CTA

`app/(main)/triage.tsx` — the FGS / Pain check tile was buried two
collapses deep inside the "Watch monitors" group, which underplayed
how rigorous the underlying clinical scale (Evangelista et al., Univ.
of Montreal, 2019) actually is.

Changes:
- Triage tab subtitle now leads with "Vet-grade symptom check. Plus
  the Feline Grimace Scale — a research-validated facial pain scoring
  system from the University of Montreal."
- New sage-tinted secondary CTA card directly below "Scan now" (above
  the fold) titled "Face pain check" with the credibility eyebrow
  `VALIDATED CLINICAL SCALE`.
- Old "Pain check" tile removed from the hidden Watch group.

`app/health/pain.tsx` — added a prominent eyebrow above the title:
`VALIDATED · UNIV. OF MONTREAL · 2019`. Body copy expanded to credit
Evangelista et al. by name and explain the 5 action-unit rubric.

**UX rationale**: didn't fully merge into the Scan flow because the
inputs/outputs are genuinely different (FGS needs face-only photo,
general triage takes any symptom photo + text). Surfacing as a sibling
CTA keeps both flows clean and honest about what each does.

### 12b. Behavior identity-check fix

`app/behavior.tsx` — single-cat households now skip the AI identity
check entirely. The AI was over-strict and false-rejecting Lily as
"not in clip" when angle/lighting/pose differed from the profile
photo. Mirrors the existing skip rule in `photoStudioStore`.

`src/services/behaviorObservation.ts` system prompt:
- Removed the "INTERPRETING MOTION BLUR — sub-second motion evidence"
  section header. Replaced with neutral "INTERPRETING MOTION BLUR".
  Added explicit rule: "Do NOT mention 'sub-second motion' or any
  framerate/sampling specifics in your output — those are
  implementation details, not observations." (The AI was regurgitating
  "sub-second" verbatim in user-facing observations.)
- Softened the identity-rejection rule: rejects ONLY when the AI sees
  clearly distinct cat(s) that are obviously not the reference (e.g.
  orange tabby reference + black-and-white in clip). Lighting, angle,
  pose, and grooming variation are now explicitly tolerated.

### 12c. catmd.pet hero — 4-screen carousel

`proxy/landing.ts` — replaced the single body-language phone mockup
with a CSS-keyframe-driven carousel cycling through 4 screens:

1. Today (score ring + 3 mood/appetite/litter pills)
2. Body Language (paragraph + tag chips — fixed mid-deploy after user
   noted the original mockup had a fake confidence ring + bullet list
   that didn't match actual app output)
3. Personality (archetype headline + 5 Feline Five bars)
4. Pain check / FGS (composite 2/10 ring + 5 AU rows)

20s loop, ~3.5s per screen with 1s fades. `prefers-reduced-motion`
respected. Floating callouts repurposed for Triage + Chat (the two
pillars NOT in carousel) so all four pillars remain above the fold.

**Lesson learned (worth capturing)**: my first version of the Body
Language carousel screen invented a confidence ring + bullet list that
DOES NOT match what the app actually shows (paragraph + tag chips).
User caught it. Fixed. Going forward — marketing surfaces (landing
page, app store) must match real app output literally, not aspirationally.

Worker version after final deploy: `dcd55e95-392c-4810-9373-ea1f0d759da2`.

### 12d. Play Store feature graphic + listing copy

`store-listing/feature-graphic-1024x500.png` — generated via inline
Pillow script using brand fonts loaded from
`node_modules/@expo-google-fonts`. Bond-led design:
- Cream background with sage-soft blob (Gaussian-blurred for soft fade)
- Terracotta accent stroke + serif "CatMD" wordmark top-left
- Headline: "Built for cats. / Trained on cats. / By cat people." (last
  line in sage-dark)
- 4 sage chips at bottom: Today / Bond / Chat / Triage
- Rounded-square app icon (280px) with drop shadow on right

Replaces the previous fear-led "Cats hide pain. CatMD catches what u
can't." graphic.

`store-listing/store-listing-copy.md` — fully refreshed:
- App title: "CatMD — AI Vet Triage for Cats" → "CatMD: Your Cat's
  Resident MD"
- Short description: triage-only → 4-pillar
- Full description: 4-pillar Bond-led, includes FGS callout + AI
  disclosure + medical disclaimer
- Category: Medical (primary) → **Lifestyle** (primary), Health & Fitness
  secondary. Reduces medical-device review risk at both stores.
- This file is now the **single source of truth for description / keywords
  / tags / data-safety answers shared across Play Store AND App Store**.

### 12e. iOS handoff doc updated

`docs/IOS-SETUP-GUIDE.md` — refreshed to reflect the actual end-of-
session state:
- Version reference: 0.1.5 → 0.1.6
- Screenshots section: removed "go shoot 5 screens" speculative
  instructions; replaced with a pointer to the curated 8-screen Play
  Store set (just resize for iOS)
- Description section: removed the duplicated copy block; replaced
  with a pointer to the shared `store-listing-copy.md` source of truth
- **NEW §11 — Keeping Android + iOS in sync going forward**: rules for
  what's shared automatically (source / runtime / listing copy /
  screenshots / privacy disclosures), what needs platform-specific
  bumps (versionCode/buildNumber, builds, submissions, native deps),
  recommended release cadence, sync checkpoint at every release,
  recovery from drift.

### 12f. Production AAB build

Build: `839e2cda-a22f-4e64-989c-be922fb05b99` (succeeds Build
`6ea5ed59-6cd7-480f-8391-3fe28d9e3cf1` and `df886cb8-01fb-472c-8d87-31dafa81ad8c`
which are now superseded). Status FINISHED.
- Direct download: https://expo.dev/artifacts/eas/hfEcPgLM3VSCF4VtBhgG7D.aab
- versionCode 37 / version 0.1.6
- Includes everything in this checkpoint AND §12 deltas
- Ready for Play Console upload as the next production release

---

## 13. Next session — iOS handoff

iOS work picks up in a separate Claude session reading
`docs/IOS-SETUP-GUIDE.md` cold. Apple Dev account verification is
the only blocking item; code prep (privacy manifest, EAS iOS profile,
buildNumber) can run in parallel.

---

## 14. Late-late session deltas — Cloud restore MVP (Phase A)

After §12 wrapped, the user pivoted from iOS prep onto a new
workstream: cross-device cloud backup so paid users don't lose data
when they switch phones. This section captures that work.

### 14a. Architectural decision

User proposed: **email required at first Pro purchase, used as the
cross-platform identity for cloud backup.** Free users stay
fully-local. Same-store reinstall = auto-restore via email sign-in.
Cross-platform = manual email entry on the new device, app detects
existing user, offers restore.

Three design iterations led here:
1. First proposal (mine): require email upfront for everyone,
   gate paywall behind it, full sync for everyone signed in.
   User pushback: "this is getting out of control."
2. Second proposal: skip email entirely, use RevenueCat
   `originalAppUserId` + 4-word backup code for cross-platform.
   User pushback: backup codes are unfamiliar, harder to recover
   than email.
3. Final: email-at-paywall-only, free users stay local-only.
   Email IS the cross-platform key. Reuses existing OTP flow.

Final architecture documented in
`docs/CLOUD-SYNC-AND-RESTORE-PLAN.md` (new doc).

### 14b. MVP scope shipped

Smallest valuable subset of the full 5-phase plan, sized to fit one
session:

1. **Paywall email gate** (`app/paywall.tsx`) — anonymous users see a
   sage-tinted info banner explaining email is needed; `onBuy` checks
   `auth.hasConfirmedEmail` and routes to `/upgrade-account?gate=paywall`
   if not. After verify, user returns to `/(main)`; second Subscribe
   tap proceeds to RC purchase.
2. **Auto-restore on email verification** (`app/upgrade-account.tsx`)
   — after successful OTP verify, fire-and-forget call to
   `restoreFromCloudIfNeeded()`. PostHog `identify(email)` aliases
   the anonymous distinct_id to email for support workflow.
3. **`pullFromCloud` extended** for non-scan health events (was cats
   + scans only). 2000-row limit on events.
4. **`restoreFromCloudIfNeeded()`** new helper in
   `src/services/sync.ts`. Pulls cloud state, applies via
   `useStore.setState()` directly (bypasses store actions to avoid
   sync feedback loops), only when local stores are entirely empty.
5. **Two new analytics events**: `cloud_restore_succeeded` (with
   restore counts) and `paywall_email_gate_shown` (funnel split).

### 14c. What the MVP does and doesn't cover

**Covered**:
- Same-platform reinstall: install on same iOS or same Android
  device → fresh anonymous Supabase session → sign in with same
  email → user_id resolves to original → restore fires.
- Support workflow: user emails support@catmd.pet from their account
  → email matches PostHog/Supabase/RC keys → instant lookup.
- Architectural rule: paid users always have verified email.

**NOT covered** (Phase B in CLOUD-SYNC-AND-RESTORE-PLAN.md):
- Cross-platform restore (iOS → Android with same email): currently
  fails because `addEmailToAccount` doesn't handle "email already
  exists" by switching to `signInWithEmail`. Needs a new sign-in
  branch in upgrade-account.tsx (~3 hrs).
- Postcard / diary / personality / notif prefs sync: not pushed at
  all. Text-only payloads, easy to add (~2 hrs).
- Photo / poster binary backup via Supabase Storage (~2-3 hrs).
- Pro-lapse handling (90-day cloud retention then archive, ~1 hr).
- Server-side global rate limits via proxy worker (~2-3 hrs).

### 14d. Files modified

- `src/services/sync.ts` — extended pullFromCloud, new
  `restoreFromCloudIfNeeded` + `RestoreSummary` type
- `app/upgrade-account.tsx` — fire restore + posthog.identify on
  successful OTP verify
- `app/paywall.tsx` — anonymous-user info banner, email gate in
  `onBuy` routes through `/upgrade-account?gate=paywall`
- `src/services/analytics.ts` — added
  `cloud_restore_succeeded` and `paywall_email_gate_shown` event
  types

### 14e. EAS update + AAB

- EAS update `019deda2-178b-789a-b697-56fa74318ebb` published to
  `preview` channel — has the cloud-restore MVP.
- New production AAB `779181be-ab8e-40f0-849c-67ee910d4617` queued
  with everything from this session including the cloud-restore MVP.
  Supersedes the earlier `839e2cda-...` build.

### 14f. iOS handoff updated

`docs/IOS-SETUP-GUIDE.md` updated to reflect the email gate at
paywall:
- App Review notes paragraph rewritten to explicitly mention the
  email-OTP gate so Apple reviewers don't flag it as a bug
- Privacy Nutrition Label changed: email is now "required at Pro
  paywall, optional for free users" (was "optional, paywall")
- TestFlight smoke-test checklist gained two new items: paywall
  email gate flow + cloud restore on second device
- Read-first list now includes
  `docs/CLOUD-SYNC-AND-RESTORE-PLAN.md` so the iOS session knows
  the cloud workstream is separate-but-mature

---

## 15. (Earlier "final" totals — superseded by §19 at the bottom of this file.)

After §15 was first written the session continued for several more
hours through three more major workstreams (brand pivot, Cat Studio
expansion, telemetry gaps closed). See §16-§19 below for the actual
end-of-session state.

---

## 16. Brand pivot — "AI vet triage" → "AI for cat owners"

User declared mid-session: *"We are no longer ai vet triage.. We are
ai for cat owners.. Our focus ia totally moved."* Multi-surface
repositioning followed.

### 16a. New positioning sentence

> *"CatMD is AI for cat owners. It knows your cat — health, mood,
> personality, daily life — and turns that knowing into something you
> actually use every day."*

Subject is the human (cat owner), not the cat. Triage becomes one
feature among many — not the marketing lead.

### 16b. Surfaces updated

- **`store-listing/store-listing-copy.md`** — Title `CatMD: Your
  Cat's Resident MD` → `CatMD — AI for Cat Owners`. Short
  description, full description, "WHY CATMD?" section all rewritten.
  Added line: *"Daily ritual, not crisis tool — most days you'll
  open CatMD just to check in… Triage is there when you need it;
  you'll mostly not."*
- **`proxy/landing.ts`** (catmd.pet) — Hero H1 `Built for cats.
  Trained on cats. By cat people.` → **`AI for cat owners.`** (the
  poetic line stays as a sub-anchor in the lede). Title tag, Open
  Graph, four-pillar band H2, Triage pillar copy, final-CTA H2 all
  rewritten away from fear-based framing. Worker version
  `5f6ef057-5d66-4b03-a3ab-b52468a10769`.
- **Floating callouts on website hero** — were static (always
  Triage + Chat). Now rotate in 4 phases matching the phone
  carousel: each phase pairs the active phone screen with two
  contextual callouts. So Triage now occupies 1 of 8 callouts
  (was 1 of 2 always-visible). Worker version
  `cfe47a7d-50a0-4964-846c-9a38404a3613`.
- **Cat Studio card on website** — Old: *"AI-generated movie-poster
  remixes, cat-voice songs, greeting cards"* → New: *"Your cat as a
  movie poster, as a Studio Ghibli scene, as Cleocatra or Sir Isaac
  Mewton, painted into Mona Lisa, drawn as 80s anime. Six themes
  rotating weekly."* Badge `soon` → `live`.
- **`docs/IOS-SETUP-GUIDE.md`** — App Review notes paragraph
  rewritten to lead with "AI-powered companion app" framing and
  explicitly state the May 2026 brand pivot. Reduces "is this a
  medical device?" review risk for Apple.

---

## 17. Cat Studio massive expansion — 48 variants × 6 themes

Existing Cat Studio shipped with 8 movie-poster genres. User
requested expansion to 5 more themes; later raised the floor to
**8 variants per theme = 48 total**.

### 17a. New variants (40 added on top of existing 8)

- **Movie posters** (existing 8, retained): Lord of the Meows,
  Catlas Shrugged, Great Catsby, Silence of the Lamb-licks,
  Meowtrix, Top Gun Meowverick, A View to a Purr, My Neighbor
  Mittens.
- **Historical figures** (8 new): Cleocatra, Sir Isaac Mewton,
  Marie Antoincat, Napurrleon, Catarine the Great, Albert
  Felinestein, Frida Kittylo, Henry VIII the Eighth-Lives.
- **Famous paintings** (8 new): Mona Lily, Starry Mew, Cat with
  the Pearl Earring, The Scream Cat, American Cat-thic, The
  Persistence of Mewmory, Whisker's Mother, The Birth of Felis.
- **Studio Ghibli scenes** (8 new): Spirited Cat, Howl's Moving
  Cattle, Princess Mewnonoke, Kiki's Catlivery Service, Cat-icaa
  of the Valley, Ponyo on the Cliff, Cat Bus Stop, Cat in the Sky.
- **Pixar characters** (8 new): The Incredible Cat, Up Up and
  Mew-way, Buzz Litterclear, Ratacatouille, Wall-Cat, Finding
  Felix, Cat-co (Coco), Inside Mew.
- **80s anime** (8 new): Akiracat, Sailor Cat, Dragon Cat Z, Lupin
  Cat III, Cat's Eye, Captain Catsubasa, Voltcat, Speed Cat Racer.

### 17b. Schema extensions

- New `GenreFormat` type — `'movie_poster' | 'historical_portrait'
  | 'classical_painting' | 'studio_ghibli' | 'pixar_key_art' |
  'anime_cell'`. Existing 8 movie-poster variants tagged with
  `format: 'movie_poster'`; new variants tagged appropriately.
- New `theme: string` field on `Genre` for picker grouping and
  PostHog telemetry breakdown.
- Format-aware prompt builder in `generatePoster` — branches on
  `format` so paintings don't get "starring [name]" credits, anime
  cells don't get poster typography, etc.

### 17c. Weekly theme rotation

- New `THEME_ROTATION` constant: 6-theme order cycling forever
  (Movie posters → Historical figures → Famous paintings → Ghibli
  → Pixar → 80s anime).
- New `getThemeForWeek()` returns `{ thisWeek, nextWeek,
  weekIndex, nextRotationAt }` from a stable epoch
  (Sunday 2026-05-03 10:00 UTC). Every install computes the SAME
  theme for the SAME week — no timezone drift.
- New `getVariantsForTheme(theme)` filters GENRES.
- `pickFreshGenre()` now filters by current week's theme (was:
  random across all genres).

### 17d. Picker UI rebuild (`app/cat-studio.tsx`)

- Replaced generic "Pick a genre" header with a sage-tinted
  **theme-of-the-week card** showing this week's theme.
- Grid below filters to active-theme variants only.
- New **next-week teaser card** at the bottom: *"Next Sunday ·
  Historical figures"* with theme emoji. Builds anticipation.
- New `nextThemeEmoji()` helper.

### 17e. catmd.pet watermark on every poster

Added a watermark instruction to all 6 format branches in the
prompt builder: *"include a small, subtle 'catmd.pet' wordmark in
the BOTTOM-RIGHT corner, rendered in a font + colour that
complements the artwork style…"*

Caveat documented: gpt-image-1 sometimes ignores specific text
rendering. If reliability turns out to be a problem after testing
on actual generations, the code-side overlay (compositing the
watermark in code post-generation, like the Postcard already does)
is the fallback — ~30 min of work, deferred.

### 17f. Identity preservation tightened

User feedback: *"can u tighten the guideline to use MY cat face,
without straying."*

Replaced the previous "preserve coat, eyes, ears" block with a
much more directive **IDENTITY LOCK** section that:

- Explicitly says "depict THIS SPECIFIC CAT — the same individual"
- Spells out **face structure** (head shape, muzzle, cheek width,
  jawline, forehead) — was missing before
- Specifies **coat pattern type by name** (mackerel tabby, classic
  tabby, ticked, tortoiseshell, calico — not just "the pattern")
- Explicit anti-drift rule: *"Do not change eye colour for drama"*
- Adds **nose colour** to matched-features list
- Anti-stylisation rule: *"Do not stylize the face into a generic
  anime / cartoon / classical-art version — keep [name]'s actual
  face features and let the rest of the body/costume/setting
  carry the genre style"*
- Frames it as: *"if the user's friend sees the artwork, they
  should immediately say 'oh that's [Lily]!'"*

### 17g. Safety-rejection handling

User reported intermittent "image gen HTTP 400: rejected by safety
reason" errors. Cause: OpenAI's automated content moderator on
gpt-image-1 flags certain word patterns even for cat-subject
generations. Stochastic — same prompt sometimes passes.

**Two-pronged fix:**

1. **Softened risky language** in 4 prompts: Princess Mewnonoke
   (dropped "fierce warrior", "dagger"), Voltcat (dropped "battle
   stance", "alien fleet"), Dragon Cat Z (dropped "battlefield",
   "fierce determined"), Akiracat (dropped "dystopian", added "Cat
   looks cool and confident, not menacing").
2. **Retry-on-safety-reject fallback** in `generatePoster`. If the
   first call returns a 400 / safety / content-policy error, retry
   ONCE with a sanitised prompt that strips combat / threat /
   dystopian language (`battle` → `heroic stance`, `fierce` →
   `confident`, `dystopian` → `futuristic`, `weapon` → `prop`,
   `crackling lightning` → `glowing energy`). Genre's core aesthetic
   survives. Only flagged language is replaced. If retry ALSO fails,
   surface the original error to the user.

**Cost note**: rejected first calls do NOT incur tracking (they
throw before `trackLLMUsage` fires in client.ts), so the safety
retry doesn't double-charge in PostHog.

---

## 18. Telemetry gaps closed (post-Cat-Studio audit)

User asked for a telemetry audit covering all the new features.
Audit identified 4 gaps; all closed.

### 18a. Theme prop on all Cat Studio events

Was: events only carried `genre: g.id` (e.g. `cleocatra`).
Inconvenient for theme-level analysis in PostHog.

Now: every Cat Studio event also carries `theme: g.theme`. Direct
breakdown by theme in PostHog without genre-ID-mapping formulas.

Events updated: `cat_studio_genre_selected`,
`cat_studio_generation_started`, `cat_studio_poster_generated`,
`cat_studio_generation_failed`, `cat_studio_poster_shared`.

### 18b. This-week / next-week props on `cat_studio_opened`

Now includes `this_week_theme`, `next_week_theme`, `week_index`.
Lets us measure: which themes drive the most opens, do users come
back when next week's theme teaser changes, weekly cohort retention.

### 18c. NEW event: `cat_studio_safety_retried`

Fires whenever the safety-retry path activates. Props: `genre`,
`theme`, `retry_succeeded` (true/false), `first_error` (truncated
200 chars).

PostHog query for safety filter false-positive rate:
`count(cat_studio_safety_retried) / count(cat_studio_generation_started)`

### 18d. NEW event: `cloud_restore_failed`

Fires when `restoreFromCloudIfNeeded` throws in the catch block of
`upgrade-account.tsx`. Props: `reason` (truncated 200 chars).

PostHog query for broken-restore rate:
`count(cloud_restore_failed) / count(email_confirmed)`

---

## 19. New docs created (additional to §15 list)

- `docs/CATVERSE-VIRALITY-PLAYBOOK.md` — 30+ ideas catalog
  organised in tiers (high-leverage → breadth → genuinely
  unexplored whitespace) plus a 3-bet sequencing framework
  (viral / retention / depth) for the next 6 months. Cat
  Vlog (auto-generated 15s TikTok), Cat Horoscope (daily ritual),
  Calm Cat ambient (lock-screen widget), and Cat-as-X expansion
  are the highlighted 3 bets.

This brings the total docs created/updated this session to 5 (plus
revisions of existing files):

- `docs/SESSION-CHECKPOINT-2026-05-03.md` (this file — extended 4
  times across the day)
- `docs/IOS-SETUP-GUIDE.md` (updated 3 times: initial + post-cloud-
  restore + post-brand-pivot)
- `docs/PRICING-AND-LIMITS-FRAMEWORK.md`
- `docs/CLOUD-SYNC-AND-RESTORE-PLAN.md`
- `docs/CATVERSE-VIRALITY-PLAYBOOK.md` (NEW)

---

## 20. End-of-session totals

- **EAS updates pushed**: 12+ to preview channel (some silent-failed
  via background, retried foreground)
- **Production AAB builds queued**: 4 (latest: `cd00734e-a273-...`,
  versionCode auto-incrementing — likely 41)
- **Worker deploys**: 4 (latest: `cfe47a7d-50a0-4964-846c-
  9a38404a3613`)
- **Files modified**: 30+ across services / state / app screens /
  proxy / docs / store-listing
- **Lines added (estimate)**: ~3,000 across code + docs

### Roadmap state at EOD

- ✅ Brand pivot to "AI for cat owners" complete across all
  marketing surfaces
- ✅ Cloud restore MVP shipped (paywall email gate + auto-pull on
  email verification) — Phase A
- ✅ Cat Studio expanded to 48 variants × 6 themes with weekly
  rotation
- ✅ All identified telemetry gaps closed
- ⏳ iOS handoff in separate Claude session — Apple Dev account
  enrollment + iOS production EAS profile + privacy manifest etc.
  See `docs/IOS-SETUP-GUIDE.md` for the playbook.
- ⏳ Cloud restore Phase B (cross-platform, photos to Storage,
  postcards/diary/personality sync, Pro-lapse handling, server-side
  rate limits) — see `docs/CLOUD-SYNC-AND-RESTORE-PLAN.md`
- ⏳ Catverse virality features — Cat Vlog, Cat Horoscope, Calm Cat
  ambient — sequenced for next 6 months per playbook
- ⏳ 14-day pricing analysis revisit (2026-05-17) — see
  `docs/PRICING-AND-LIMITS-FRAMEWORK.md`

End of 2026-05-03 checkpoint.
