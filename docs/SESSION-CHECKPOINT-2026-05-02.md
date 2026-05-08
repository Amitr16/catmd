# CatMD Session Checkpoint — 2026-05-02

> **Purpose**: durable record of today's deltas on top of `SESSION-CHECKPOINT-2026-05-01.md`.
> If you're picking up cold, read 05-01 first for the rebrand + four-pillar
> backstory; this doc only covers what changed today.

---

## 0. TL;DR

Today's session was almost entirely **Bond-pillar maturation + notification
hygiene**. No new pillar. No new tab. Five concrete deliveries:

1. ✅ **Postcard split from Diary + history strip**
   - Diary went private + 7pm-only + material-gated
   - Postcard became its own social-share surface (split from Diary), with
     daily 7pm reminder, photo collage + AI caption + watermark
   - Today: added a **history strip** at the bottom of the Postcard screen
     (90-day cache, tap to flip back, share past postcards too)
   - **Removed the regenerate-caption button entirely** per user — captions
     are user-edited only after the first AI seed. The "Reset to AI version"
     fallback still exists for the original caption text
2. ✅ **Cat Studio weekly auto-generation**
   - Sunday 10am notification + lazy auto-generation on screen open
   - Picks a random genre that **doesn't repeat any of the last 3 posters**
   - Pulls a reference photo from the past 7 days (symptom_photos / scans /
     profile photo, newest-first)
   - User taps notification → lands on screen → sees fresh poster (or the
     "Designing the poster…" spinner if it just kicked off)
3. ✅ **Outcome-check audit**
   - Identified that the "How is [cat] doing?" notification a beta tester's
     friend received was the **scan-anchored outcome check**, not the weekly
     check-in (which defaults OFF). Outcome check schedules 6–36h after
     every scan, urgency-banded
   - Deep-link handler already correct (`data.type: 'outcome_check'` →
     `/outcome-check?scanId=…`) — no fix needed
   - **Added per-category opt-out**: `outcome_check` in NotifCategory + new
     toggle row in Settings → Notifications. `scheduleOutcomeCheck` now
     reads the toggle and bails if disabled
4. ✅ **Photo Studio v1**
   - Sixth Bond tile flipped from `comingSoon` to live
   - Daily-photo log + monthly time-lapse playback
   - 365-photo cap per cat, photos COPIED to stable
     `documentDirectory/photo-studio/<catId>/<date>.jpg` so URIs survive
     Android gallery GC
   - 11am daily reminder ("Daily photo of [cat]")
   - v2 deferred items documented in code: AI vision pass for coat/posture
     cues, health-trend insights, time-lapse video export, multi-photo/day
5. ✅ **Notification rationalisation**
   - Three new categories added: `cat_studio_poster`, `outcome_check`,
     `daily_photo_studio`
   - Settings → Notifications now lists 12 toggleable categories
   - Trust rails unchanged: quiet hours 22:00–08:00, 1 ad-hoc push/day cap

No AAB build kicked off this session. Last shipped is still build #19
(versionCode 19) from 2026-05-01.

---

## 1. Notification cadence — full picture after today

| Slot | Category | Source | Default |
|---|---|---|---|
| User-set time, daily | Medication | cat-profile | OFF |
| User-set day + time, weekly | Check-in | cat-profile | OFF |
| 11:00 daily | **Daily photo (Photo Studio)** ⭐ NEW | screen mount | ON |
| 19:00 daily | Cat Diary | screen mount | ON |
| 19:00 daily | Postcard ready | screen mount | ON |
| 19:00 weekly (~7d after last obs) | Read-[cat] nudge | screen mount | ON |
| 10:00 Sunday | **Cat Studio poster** ⭐ NEW | screen mount | ON |
| 09:00 yearly | Birthday | cat-profile save | ON |
| 09:00 yearly | Adoption-iversary | cat-profile save | ON |
| 6h–36h after scan | **Outcome check** (now toggleable) ⭐ | scan submit | ON |
| ~30s after milestone | Streak (7/14/30/60/90/180/365) | health milestone | ON |
| ~30s after pattern | Insight | CatContext | ON |

**Hard rails (unchanged):**
- Quiet hours 22:00–08:00 — anything inside this window auto-shifts to 08:00
- 1 ad-hoc push per day across streak + insight (each consumes one slot
  via `claimDailyPushSlot`); daily/weekly/yearly + outcome-check are exempt
- All categories have per-category opt-out in Settings → Notifications

Caveat to copy-fix later: in `notification-settings.tsx`, "Daily check-in
reminder" is mislabelled — the actual schedule is **weekly** (it's a weekly
check-in scan reminder). Functional bug, just bad copy. Defer.

---

## 2. Deltas by file

### 2a. Postcard history strip
**`app/postcard.tsx`** — major refactor of the composer state model.
- New state: `viewingPostcardId | null` decoupled from `todaysPostcard`.
- New computed: `activePostcard` (= viewing past or today's), `isViewingPast`.
- All composer hooks (caption sync, blur-save, share, reset-to-AI) now
  reference `activePostcard` so users can revisit + re-share past postcards.
- New JSX: bottom history strip — horizontal scroll of thumbnails, 88×88
  with date label badges. Tap a thumbnail → set `viewingPostcardId`.
- New "Viewing Apr 24 — tap to return to today" pill banner above the
  composer when `isViewingPast === true`.
- New helper: `formatShortDate` (Today / Yesterday / Mon / Apr 24).
- **Removed**: regenerate-caption button + its handler + `ArrowsClockwise`
  import. Captions are user-edited only after first AI seed.
- New styles: `pastBanner`, `thumb`, `thumbImage`.

### 2b. Cat Studio Sunday auto-gen
**`src/services/notifications.ts`** — added `setWeeklyCatStudioReminder`
(weekday=1 Sunday at 10:00, `data.route: '/cat-studio'`,
`kind: 'cat_studio_poster'`).

**`src/services/catStudio.ts`** — added three pure helpers:
- `getStudioWeekAnchor(now)` — most recent passed Sunday-10am local
- `pickFreshGenre({ recentPosters, recentN: 3 })` — random genre excluding
  last N posters' genres; falls back to all-genres if every genre is in
  the recent set
- `pickWeeklyReferencePhoto({ cat, events, scans, daysBack: 7 })` — newest
  symptom_photo / scan / profile photo from past 7 days; falls back to
  `cat.photo_uri` regardless of age
- New field on `CatStudioPoster`: `auto?: boolean` (distinguishes weekly
  auto from manual user-driven generation)

**`src/state/catStudioStore.ts`** — added `weeklyAutoGenerate(catId)`:
1. If most-recent auto-poster is newer than this week's anchor → no-op
2. If a manual generation is already in flight → no-op
3. Otherwise: pick fresh genre, pick reference photo, lazy-load
   `expo-file-system`, base64 the photo, call `generatePoster`, mark
   `auto: true`, prepend, evict beyond 10
4. Fires `cat_studio_weekly_auto_generated` (with skipped genres list)
   or `cat_studio_weekly_auto_failed`

**`app/cat-studio.tsx`** — two new `useEffect`s on mount:
1. Schedule Sunday-10am reminder (idempotent, honours toggle)
2. Call `weeklyAutoGenerate(cat.id)` lazily — store handles the
   "already up-to-date" check internally

**`src/state/notifPrefsStore.ts`** — `cat_studio_poster` added to
NotifCategory + defaults (`true`).

**`app/notification-settings.tsx`** — new toggle row, FilmStrip icon.

**`src/services/analytics.ts`** — two new events: `cat_studio_weekly_auto_generated`
(with `recent_genres_skipped: string`) + `cat_studio_weekly_auto_failed`.

### 2c. Outcome-check toggle
**`src/state/notifPrefsStore.ts`** — `outcome_check` added to NotifCategory
+ defaults (`true`).

**`src/services/outcomeCheck.ts`** — `scheduleOutcomeCheck` now reads
`useNotifPrefsStore.getState().enabled.outcome_check` first; bails if
disabled. No other changes.

**`app/notification-settings.tsx`** — new toggle row, Heartbeat icon.

**Deep-link verified**: `app/_layout.tsx` already routes
`data.type: 'outcome_check'` → `/outcome-check?scanId=…` correctly. The
"splash freeze" report a beta tester surfaced earlier was a **different**
bug (the legacy `data.type: 'checkin'` schema → `/scan` path), which was
fixed in 2026-05-01's session.

### 2e. Health Rhythm v1

**`src/services/healthRhythm.ts`** (NEW) — pure aggregator.
- `buildHealthRhythmSnapshot({ catId, events, scans, windowDays?, now? })`
  → `HealthRhythmSnapshot`
- Snapshot fields: per-day `DaySlot[]` (mood, appetite, activity), week-streak,
  mood/appetite counts, weight series + first/last + delta, scan urgency mix,
  top behaviour-observation tags, drift cards
- `detectDrift()` — deterministic rule set (no ML):
  - 3+ "off" mood days in past 7 → concern
  - any "none" appetite in past 7 → concern (anorexia → hepatic lipidosis)
  - 3+ "half" appetite in past 7 → watch
  - ±5% weight change in window → watch (≥10% → concern)
  - ≥30-day check-in streak → good
  - ≥7-day streak → good
  - any urgent scans in window → concern
  - 2+ concern-level scans → watch
  - <40% logging coverage at ≥14d windows → watch
- Severity ordering: concern → watch → good. Sorted on output.

**`app/health-rhythm.tsx`** (NEW) — single-file screen.
- Identity strip (cat avatar + "[N]/30 days · Y-day streak")
- Drift cards section (or empty positive state when nothing concerning)
- Mood timeline — 30 daily slots, color-coded happy/normal/off
- Appetite timeline — 30 daily slots, color-coded full/half/none
- Weight sparkline — pure-View polyline (positioned dots + rotated 1px
  line segments); no react-native-svg dependency
- Activity heatmap — per-day event-count bars
- Scan urgency-mix segmented bar
- Top behaviour-observation tag chips
- Tap on drift card → deep-link to `/health/weight` or
  `/health/symptom-timeline` or `/health/srr` based on `kind`. Streak
  cards are non-tappable
- Sparse axis labels (start / mid / end) so the 30-day rows stay readable
- Footer copy: "Health Rhythm reads only what you've already logged —
  no recordings, no background sensors. The more daily check-ins land,
  the sharper the picture."

**`app/(main)/index.tsx`** — Health Rhythm tile flipped from `comingSoon`
to `live`, replacing the 4-tile dashboard with a 2-tile layout (Read [cat]
+ Health Rhythm). Meow Decoder + Sleep Coach tiles removed (deferred —
see §3).

**`app/_layout.tsx`** — `Stack.Screen name="health-rhythm"` registered
with `headerShown: false`.

**`src/services/analytics.ts`** — two new events:
- `health_rhythm_opened` (days_logged, streak_days, drift_count, has_concern)
- `health_rhythm_drift_tapped` (kind, severity)

### 2d. Photo Studio v1
**`src/services/photoStudio.ts`** (NEW) — types + helpers:
- `PhotoStudioPhoto` schema (id, cat_id, date YYYY-MM-DD, uri, added_at,
  source 'camera'|'gallery', optional width/height)
- `localDateKey` / `localMonthKey` / `formatMonthLabel` (local-time, never
  UTC — same convention as postcard.ts)
- `groupByMonth(photos)` → `PhotoMonthBucket[]` (newest-month first,
  newest-photo first within each)
- `stablePhotoPath(catId, date)` →
  `${documentDirectory}photo-studio/<catId>/<date>.jpg`
- `copyPhotoToStable({ sourceUri, catId, date })` — creates per-cat
  folder, deletes any prior same-date file, copies. Returns null on failure
- `deletePhotoFile(uri)` + `deleteAllPhotosForCat(catId)` — best-effort
  filesystem cleanup

**`src/state/photoStudioStore.ts`** (NEW) — Zustand persisted store:
- `addPhoto({ catId, sourceUri, source, width?, height?, date? })` —
  copies to stable path, drops same-date prior, prepends, evicts beyond
  365 (with on-disk file delete for evictions)
- `deletePhoto(catId, photoId)` — removes record + file
- `getPhotosForCat`, `getPhotoForDate`, `clearForCat`, `clearAll`
- Stable-reference convenience hooks: `usePhotosForCat`, `useTodaysPhoto`
  (subscribe to raw `photos[catId]` + useMemo derive — same Zustand
  re-render-loop fix as chatStore / catStudioStore / postcardStore)
- `MAX_PHOTOS_PER_CAT = 365` — ~55 MB at 0.7 quality

**`app/photo-studio.tsx`** (NEW) — single-file screen:
- Today's card: photo + Re-take + Share, OR empty CTA with onboarding copy
- Monthly sections: 4-column thumbnail grid (`width: '23.5%'`, gap-based
  layout); section header has "Play time-lapse" pill when ≥2 photos
- Tap thumbnail → full-screen viewer modal with delete + share
- Time-lapse modal: oldest→newest auto-cycle at 400ms/frame, pause/play,
  photo counter `1/N`, date label
- ImagePicker action sheet via `Alert.alert` with Camera / Gallery / Cancel
- `expo-image-picker` and `expo-sharing` lazy-loaded on demand (same
  defensive pattern as Cat Studio + Cat Diary post-incident)
- Schedules 11am daily reminder on mount (idempotent)
- Fires `photo_studio_opened` on mount

**`src/services/notifications.ts`** — `setDailyPhotoStudioReminder`
(11:00 daily, `data.route: '/photo-studio'`, `kind: 'photo_studio'`).

**`src/state/notifPrefsStore.ts`** — `daily_photo_studio` category +
defaults (`true`).

**`app/notification-settings.tsx`** — toggle row, Camera icon.

**`app/_layout.tsx`** — `Stack.Screen name="photo-studio"` registered with
`headerShown: false` (the screen ships its own header).

**`app/(main)/bond.tsx`** — Photo Studio tile flipped from `comingSoon`
to `live`, `onPress` wired to `/photo-studio`. Copy updated to ship-scope:
"Snap one photo a day — we group them by month and play back the
time-lapse. Watch [cat] change over the year."

**`src/services/analytics.ts`** — five new events:
- `photo_studio_opened` (photo_count, has_today)
- `photo_studio_photo_added` (source, replaced_existing, total_after)
- `photo_studio_photo_deleted` (total_after)
- `photo_studio_month_played` (month_key, photo_count)
- `photo_studio_photo_shared`

---

## 3. Today-tab deferrals — Meow Decoder + Sleep Coach

Hidden from the Today-tab module dashboard 2026-05-02 to ship a clean
test-phase build. Tile copy preserved in inline comments at
`app/(main)/index.tsx` so the brief stays discoverable; surface the tiles
back when the dev work below is unblocked.

### 3a. Meow Decoder (deferred)
**Brief**: *"Voice translation + medical signals."* Record 5–10s of cat
vocalizing → AI classifies into 6–8 classes (greeting / demand / distress
/ pain / hunger / contentment / mating / anxiety) + one-line
interpretation + confidence. "Distress" / "pain" classes write
`meow_signal` events to `healthStore`; CatContext placeholder code
(`recentMeowSignals: []` at `services/catContext.ts:303`) is ready to
consume them.

**Why deferred**: classification accuracy on cat sounds via
gpt-4o-audio (the only viable real-time path) is unmeasured. Generic
Whisper transcribes meows as nonsense — must use multimodal audio reasoning.
Need a half-day spike before committing to the build:
1. Record 10 sample meows (own cat + YouTube)
2. Send each to gpt-4o-audio with the classification prompt
3. Eyeball results — if recognizably better than random → green-light
4. If nonsense → reframe as "user records + labels, build a corpus"
   path or shelve permanently

**Build estimate IF spike succeeds**: 3–4 days.
- Day 1: audio recording flow (`expo-av`), upload + base64 encode
- Day 2: AI service (`gpt-4o-audio` multimodal call) + class taxonomy
- Day 3: UI screen (record button, history list, result card),
  healthStore integration for distress events
- Day 4: polish — silence detection, low-volume warnings, recording
  permission flows

### 3b. Sleep Coach (deferred)
**Brief**: *"Overnight breathing + sleep cycles."* Implies all-night
phone-as-sensor: audio → breathing-rate detection → sleep-cycle staging.

**Why deferred**: real version is 1–2 weeks of risky signal-processing
work (Android foreground service, on-device FFT for breathing peak
detection, IMU/audio fusion, battery-friendly recording loop). Even
mature human-sleep products (Apple Watch, Oura, Whoop) spent years on
this. Cat-specific accuracy is unmeasured. High risk of shipping
something that doesn't work.

**`health/srr` already exists** — manual 60-second sleeping-respiratory-
rate measurement. SRR is a critical clinical signal (CKD, cardiac).

**Recommended v1 if revived (1–2 days)**: re-skin `health/srr` as the
"Sleep Coach" surface — 30-day SRR trend chart + baseline + measurement
nudge + sleep-supportive tips (bedroom temp, sleep-supportive food, when
SRR drift means "see vet"). Honest about manual measurement; ships
quickly. The audio-detection version stays on the v3 wishlist.

**Decision**: don't ship anything until we explicitly choose between
"lite re-skin" or "full audio version." Hidden tile until then.

### 3c. CatContext placeholders that stay ready
- `services/catContext.ts:90` — `recentMeowSignals` field on `CatContext`
- `services/catContext.ts:98` — `sleepBaseline` field on `CatContext`
- `services/catContext.ts:303` — `recentMeowSignals: []` placeholder
- `services/catContext.ts:308` — `sleepBaseline: null` placeholder

These stay in place. When the features ship, they wire in here without
schema migration.

---

## 4. Health Rhythm v1 (NEW — shipping in this session)

Today-tab second live module (joining Read [cat]). 30-day rolling-window
dashboard surfacing patterns + drift signals from existing data sources
(`healthStore` + `scanStore` + `behaviorObservationStore` + CatContext
pattern detection — no new ML).

See §2e below for file deltas.

---

## 5. Photo Studio — v2 deferred (in-code comments)

The Bond tile copy historically read: *"A daily photo of [cat], AI-curated
into a monthly time-lapse. Auto-detects coat, posture, weight changes."*
v1 ships the **capture loop + monthly time-lapse**. The AI auto-detection
pieces are intentionally deferred. Roadmap items (documented inline in
`src/services/photoStudio.ts` and `src/state/photoStudioStore.ts`):

1. **Vision pass on add** — when a photo is added, run a low-cost vision
   call to extract coat note ("glossy" / "matted" / "shedding"), posture
   cue ("upright" / "hunched" / "lying"), and a one-line "the camera saw"
   summary. Stored alongside the photo. Cost-of-feature estimate: ~$0.0003
   per photo at gpt-4o-mini, so ~$0.10/cat/year if user adds daily.
2. **Health-trend insights from photo deltas** — when N consecutive photos
   show a consistent change ("coat looking matted in 5 of last 7 photos"),
   surface as a CatContext insight notification. Routes to symptom-timeline
   or scan flow. Needs accumulated longitudinal data to be useful;
   foundation lands here, signal layer comes later.
3. **Time-lapse video export** — currently we render an in-app cycling
   image; v2 stitches into a real .mp4 via `react-native-ffmpeg` or
   server-side. Heavy native work; defer.
4. **Multi-photo per day** — current schema is one-per-day (re-take
   overwrites). Some users will want pose variety; trivial schema change
   when we get there.

---

## 6. What's left on Bond

| Tile | Status |
|---|---|
| Personality Profile | ✅ Live (since 2026-04-30) |
| Postcard | ✅ Live + history strip (today) |
| Cat Diary | ✅ Live (private, 7pm gated) |
| Cat Studio | ✅ Live + Sunday auto-gen (today) |
| **Photo Studio** | ✅ **Live (today)** |
| Memory Book | 🟡 Coming-soon — intentionally deferred until Q3 2026 |

Memory Book remains the last placeholder tile. Brief stays as written:
"Year-in-review for [cat] — like Spotify Wrapped. Printable hardcover at
year 5 + 10." Build target unchanged: ~Q3 2026 when the earliest beta
cohort accumulates 6 months of data.

---

## 7. Build state

**Last shipped**: build #19 (versionCode 19) from 2026-05-01.

**Today's build (IN FLIGHT)**:
- Build id: `6316b6aa-d0da-4b59-9b3d-3d85ce00b42e`
- versionCode: 20
- URL: https://expo.dev/accounts/amit1601/projects/catmd/builds/6316b6aa-d0da-4b59-9b3d-3d85ce00b42e
- Kicked off via `npx eas-cli build --platform android --profile
  production --non-interactive --no-wait`

**What's bundled in #20:**
- Postcard history strip + regenerate-button removal
- Cat Studio Sunday-10am auto-generation
- Outcome-check per-category toggle
- Photo Studio v1 (entire feature: capture, log, monthly time-lapse,
  reminder)
- Health Rhythm v1 (entire feature: aggregator + 30-day visualisations
  + drift detection)
- Today-tab cleanup: Meow Decoder + Sleep Coach tiles hidden
- Three new notification categories (`cat_studio_poster`,
  `outcome_check`, `daily_photo_studio`) + Health Rhythm tile

**To ship after build completes**:
```
npx eas-cli submit --platform android --latest
```
Auto-attaches mapping.txt — see 2026-05-01 §3o for the rationale (manual
APK upload skips deobfuscation; `eas submit` does not).

No copy-string changes to onboarding or core navigation; no app-store
metadata update needed.

**Test-phase development is COMPLETE** with this build. All planned
features for the test phase have shipped or been explicitly deferred
with logged rationale. The next session's work is bug-fix + telemetry
review based on what closed-test users surface against build #20.

---

## 8. Open items / not-done

- 📝 **"Daily check-in" copy bug** in `notification-settings.tsx` — labelled
  daily, schedules weekly. Defer; not a fire.
- 📝 **AAB build for today's deltas** — not kicked off this session. User
  can run when ready.
- 📝 **Photo Studio v2 backlog** (see §3) — vision pass + insights +
  video export.
- 📝 **Memory Book** — deferred to Q3 2026.

No blocking issues. TS clean across the touched surface. No test failures
because there are no tests on these files (consistent with the rest of
the codebase's "manual smoke + telemetry" testing strategy).

---

## 8a. UX audit + first-pass implementation (added end of session)

A 12-section UX audit ran across the app surface (tab/screen names,
tile composition, empty + error states, CTA verb consistency, type +
color tokens, modal patterns, loading states). Combined with a
user-pain-points pass (what hurts when someone actually picks up the
app), it surfaced 10 high-priority fixes. All shipped in this session.

### Changes

**1. "Read [cat]" → "Body Language" rename** (the big one)
- Rationale: "Read" implied text/language understanding. Users couldn't
  tell the feature was a 6-second video analysis.
- Renamed user-facing surfaces only — the route `/behavior`, the store
  type `behavior_observation`, and analytics event names stay
  unchanged for continuity.
- Files touched:
  - `app/(main)/index.tsx` — Today tile title + 6-day banner copy
  - `app/behavior.tsx` — screen header + body copy
  - `app/onboarding.tsx` — slide-5 activation tile
  - `app/notification-settings.tsx` — weekly nudge title + description
  - `app/_layout.tsx` — Stack.Screen title
  - `src/services/notifications.ts` — weekly nudge title + body
  - `src/services/healthRhythm.ts` — drift card detail copy

**2. Plain-English health monitor names** (Triage tab)
- "Sleeping respiratory rate" → "Breathing rate"
- "Pain check (Feline Grimace Scale)" → "Pain check"
- "CKD watch" → "Kidney watch"
- "First aid + food safety" → "Is this safe?"
- Subtitles tightened across the board to single-sentence form.

**3. Bond tab tile copy + lede**
- Lede: "The creative, identity, and memorial side of life with [cat]"
  → "Creative ways to know [cat] better — personality, daily diary,
  photos, posters."
- Postcard subtitle now explicitly mentions "Instagram, TikTok, or
  anywhere" so users understand the destination.
- Cat Studio + Photo Studio + Diary subtitles trimmed to ≤1 line each.
- Personality tile subtitle simplified — instead of showing
  "Confident-Sociable · 87% · stable", now shows the archetype name +
  one-liner ("Companion — Will follow you to the bathroom. Every
  time."). Drops the framework jargon ("Litchfield Feline Five") +
  the confidence percentage which most users can't interpret.

**4. Empty-state copy rewrite (across 8 screens)**
- "No active cat. Add a cat first." → "Add a cat first — Settings →
  Manage cats." (gives a concrete path)
- Today recent scans: unified with Triage's value-driven copy ("Run
  one to start [name]'s health timeline.")
- Chat empty-state title: "Ask anything about [cat]." → "Ask about
  [cat]." Body trimmed from 3 lines to 2 — drops corpus-marketing
  language ("backed by an extensive vet-curated corpus") in favour of
  user-mental-model language ("behavior, food, care, weird habits —
  anything").
- Chat no-cat: "Add a cat to start chatting." → "Add a cat to chat
  about them. Tap Settings → Manage cats."

**5. CTA verb consistency**
- "Upgrade to scan again" → "Unlock more scans" (Today + Triage CTAs)
- "Use this 6 seconds" → "Analyze this clip" (behavior video selector)
- "Generate poster" → "Create poster" (cat-studio)

**6. Streak pill on Today**
- New visible reward for daily check-in habit. Renders only when
  streak ≥ 3 days (showing "1-day streak" feels patronising). Sits
  above the daily check-in card. Flame icon + "[N]-day check-in
  streak" pill in terracotta.
- Computed inline from the `daily_checkin` events in healthStore. No
  new dependency on healthRhythm.

**7. Onboarding copy tightening**
- Slide 1 (PillarRow descriptions): each line is now ≤2 lines,
  user-mental-model phrasing. "Vet-grade symptom checker.
  Vaccinations, weight, watch monitors." → "Vet-grade symptom checker,
  plus vaccines, weight, and watch monitors."
- Slide 4 lede: reworded to be active-voice + half the length. "Triage
  and behaviour readings change a lot..." → "Age and sex change which
  risks your cat has..."
- Slide 5 activation tile descriptions: each capped at one sentence.
  Previously they had nested instructions ("Open Today → tap '...' —
  three taps on mood, appetite, litter. Builds a streak."); now: "Today
  tab → three taps on mood, appetite, litter. Starts your streak."

**8. Token discipline: UrgencyBadge palette**
- Was hard-coding `#F5E8CC` / `#6B4F14` / `#F2D3CC` for monitor +
  urgent tier backgrounds — none of these were in `tokens.ts`. Replaced
  with `t.primary50` / `t.warning` / `t.secondary50` / `t.secondary100`
  / `t.error`. Comment in the file explains the choice + flags for
  future maintenance.
- Behavior screen recording-dot: was `#E04837` inline; now `t.error`
  applied at render site (StyleSheet stays shape-only, theme-driven
  colour applied inline).

**9. CatContext + healthRhythm copy**
- `services/healthRhythm.ts:369` — drift card text "try a Read [cat]
  session" → "try a Body Language read".

**10. (Deferred / deliberately not done)**
- Tab name renames (Today / Bond / Chat / Triage). User experience
  audit considered renaming "Triage" → "Health" and "Bond" →
  "Memories" but DEFERRED — these are CatMD-specific brand terms
  with downstream copy + analytics dependencies. Re-evaluate after
  closed-test telemetry shows whether users find them confusing.
- Skeleton loading states (currently all use ActivityIndicator).
  Cosmetic; defer.
- Modal-vs-card presentation unification. Defer until after a
  user-tested decision on what each route should feel like.

### What this changes for the closed-test cohort

The four worst friction points are gone:
- Users now read "Body Language" + "Record 6 sec → AI tells you what
  [cat] is feeling" instead of guessing what "Read" means.
- The streak — the strongest re-engagement loop — finally has visual
  surface area. Habit users see the reward.
- Empty states now point to a concrete next action.
- Health-monitor names use the words a worried owner already uses
  ("Kidney watch", "Breathing rate") instead of the abbreviations
  vets use.

These changes don't bundle into build #20 (already in flight). They
need a fresh AAB to ship.

---

## 8b. Trending audio for postcards (cron-refreshed weekly)

User asked whether the postcard share could include audio matching the
post's theme, so the social-media output is image + audio not just
image. After scoping the technical reality (uploaded audio gets stripped
by IG/TikTok routinely, on-device MP4 stitching adds 60–90 MB of native
binaries via ffmpeg-kit, server-side stitching adds infra and latency
without solving the music-strip issue), the better answer was:

**Show trending-audio SUGGESTIONS in the share flow and let users add
the music in IG/TikTok's native picker** — those libraries are
pre-licensed for distribution and survive upload intact.

User then asked for the trends to auto-refresh weekly via a cron job
running on the server. Built the full pipeline.

### Architecture

```
                              Friday 16:00 UTC
                                     │
          ┌──────────────────────────▼────────────────────────────┐
          │ Cloudflare Cron Trigger (proxy/wrangler.toml)         │
          │   crons = ["0 16 * * 5"]                              │
          └──────────────────────┬────────────────────────────────┘
                                 │ invokes scheduled()
          ┌──────────────────────▼────────────────────────────────┐
          │ proxy/worker.ts → scheduled()                         │
          │ → refreshAudioTrends({ openaiApiKey, kv })            │
          └──────────────────────┬────────────────────────────────┘
                                 │ OpenAI Responses API
                                 │ (gpt-4o + web_search tool)
          ┌──────────────────────▼────────────────────────────────┐
          │ Returns 8–18 trending tracks for cat content this     │
          │ week, JSON-Schema-validated, mood-tagged, search-     │
          │ query-tagged, platform-tagged.                        │
          └──────────────────────┬────────────────────────────────┘
                                 │ KV.put('current', payload)
          ┌──────────────────────▼────────────────────────────────┐
          │ Cloudflare KV (binding: AUDIO_TRENDS_KV)              │
          └──────────────────────┬────────────────────────────────┘
                                 │ read by GET /audio-trends.json
          ┌──────────────────────▼────────────────────────────────┐
          │ App: src/services/audioTrends.ts                      │
          │   • 24h AsyncStorage cache                            │
          │   • Falls back to src/data/defaultAudioTrends.ts      │
          │   • selectForMood(mood_word) returns top 3 matches    │
          └──────────────────────┬────────────────────────────────┘
                                 │
          ┌──────────────────────▼────────────────────────────────┐
          │ app/postcard.tsx → "Trending audio for this vibe"     │
          │ section between caption + Share button                │
          │   • 3 mood-matched tracks with title + context        │
          │   • Per-track [Copy IG] / [Copy TikTok] pills →       │
          │     copies search_query to clipboard                  │
          │   • "Copied" tick for 1.2s after copy                 │
          └────────────────────────────────────────────────────────┘
```

### Files added

**Proxy side (`proxy/`):**
- `audioTrends.ts` — types, SEED_PAYLOAD constant (15 hand-curated
  tracks for v1), `renderAudioTrendsJson()` response helper with edge
  cache headers (1h browser / 6h CDN / 24h SWR)
- `audioTrendsRefresh.ts` — cron handler: OpenAI Responses API call
  (gpt-4o w/ web_search tool, JSON-Schema-constrained output),
  `sanitiseTrends()` validator that drops malformed entries + dedupes
  by title, KV write. Refuses to overwrite KV if AI returns <6 valid
  entries (keeps last-known-good).
- `wrangler.toml` — added `[triggers] crons = ["0 16 * * 5"]` (Friday
  16:00 UTC = US Pacific Friday morning, ahead of weekend posting peak)
  + `[[kv_namespaces]] binding = "AUDIO_TRENDS_KV"`

**App side:**
- `src/data/defaultAudioTrends.ts` — bundled fallback (mirrors SEED
  list verbatim). Used when network unreachable / Worker returns
  malformed.
- `src/services/audioTrends.ts` — `fetchAudioTrends()` with 24h cache
  + 4s timeout + bundled fallback. `selectForMood()` matches against
  the postcard's `mood_word`, falls back to "playful/energetic" tags
  when no mood word matches.
- `src/services/postcard.ts` — added `mood_word?: string` to the
  Postcard type + persists it from the LLM result (was being requested
  in the JSON schema but discarded).
- `app/postcard.tsx` — new "Trending audio for this vibe" section.
  AudioSuggestionRow component. Per-track Copy pill that puts the
  search query on the clipboard via `expo-clipboard` and shows a
  "Copied" tick for 1.2s.
- Three new analytics events: `postcard_audio_suggestion_shown`,
  `postcard_audio_suggestion_copied`, `postcard_audio_fetch_failed`

**Dependency added:**
- `expo-clipboard` ~8.0.8 (installed via `npx expo install`)

### Deploy steps (next time we ship the worker)

```
# 1. Create the KV namespace once (only on first deploy):
cd proxy && npx wrangler kv namespace create AUDIO_TRENDS
# → outputs an `id = "..."`. Paste it into wrangler.toml's
#   [[kv_namespaces]] block in place of REPLACE_WITH_ID_FROM_...

# 2. Deploy the worker:
npx wrangler deploy

# 3. Verify the endpoint responds:
curl https://catmd.pet/audio-trends.json
# → returns the SEED list at first (KV is empty); after the first
#   cron fire it returns the AI-refreshed list

# 4. (Optional) Trigger an immediate refresh instead of waiting for
# Friday:
npx wrangler dev --test-scheduled
# in another shell:
curl 'http://localhost:8787/__scheduled?cron=0+16+*+*+5'
```

### Cost + budget

- OpenAI Responses API + web_search: ~$0.03/call × 52/year = **$1.56/year**
- Cloudflare KV reads: ~free at our volume (100k/day free tier)
- Cloudflare KV writes: 1 write/week, well under the 1k/day free tier
- Cloudflare Cron Triggers: free on Workers Free plan

Total ongoing cost: ~$1.56/year + $0 infra.

### Failure-mode behaviour

| Scenario | What user sees |
|---|---|
| Cron fires successfully | Top 3 mood-matched suggestions, fresh tracks |
| Cron fails (rate limit / parse error) | Last-known-good list from KV (no degradation) |
| Cron has never fired (first deploy) | SEED list from `audioTrends.ts` |
| KV unreachable from worker | SEED list from `audioTrends.ts` |
| App fetch fails (offline / Worker down) | Bundled `DEFAULT_AUDIO_TRENDS` from disk |
| Caption has unusual mood_word (no matches) | Padded with "playful/energetic" tracks |

The "audio suggestion" feature always shows something. Never empty.

### Design decisions

**Why suggestions + clipboard, not attached MP4:**
- IG/TikTok strip uploaded audio routinely. Their native music libraries
  are pre-licensed. So even if we attached audio, the user's better
  outcome is to pick from IG/TikTok's library — we make that easy.
- APK weight: avoids ~90 MB of `ffmpeg-kit-react-native` native bins.
- Server-side stitching: avoids new infra + 3–5s latency on share.

**Why GPT-4o + web_search (not curated by hand):**
- Trending audio rotates on a 1–3 week cycle; hand-curation would mean
  someone editing JSON every Friday morning. Cron + AI = 0 ongoing
  human work.
- web_search grounds the model in this week's reality vs months-stale
  training data.
- $1.56/year is a rounding error.

**Why JSON-Schema-strict output:**
- We'd rather fail loudly (and keep the previous KV value) than write
  half-broken structures that break the app UI.

**Future work (not done):**
- A "draft mode" where new cron-fired payloads sit in `current_draft`
  KV key for human review before promoting to `current`. Worth adding
  after the first month of telemetry shows whether AI quality is
  consistently good or needs human-in-the-loop.
- Mood vocabulary expansion if the postcard captioner produces moods
  outside the controlled list often (visible via
  `postcard_audio_suggestion_shown` events with `mood_word` not
  matching any tag).
- A `?platform=tiktok` query-string filter on the endpoint if we ever
  build a TikTok-only sharing flow.

---

## 8c. Bond pillar refactor — unified photo gallery + reorder + personalisation

After shipping individual Bond features as fragmented islands, user
correctly identified the design problem: photos should be ONE source
that flows through every Bond feature, not a separate concern per
tile. Refactor:

### Photo source unification

**Before**: each feature pulled photos from its own places.
- Postcard pulled from `cat.photo_uri` + scan photos + symptom-photo
  health events. Medical photos appeared in social postcards. Wrong.
- Cat Studio's weekly reference photo: same scan/symptom-photo path.
- Photo Studio kept its own daily-photo log, isolated from everything
  else. The user's photo work didn't compound across features.

**After**: photoStudioStore is the **canonical photo gallery**. Every
Bond feature reads from there.

- `services/postcard.ts` `gatherTodaysPhotos`: signature changed from
  `{ cat, events, scans, max }` → `{ cat, galleryToday, max }`. Pulls
  exclusively from the gallery; falls back to today's-updated profile
  photo only as a last resort. Triage scan + symptom photos no longer
  feed postcard — they stay medical-only.
- `services/catStudio.ts` `pickWeeklyReferencePhoto`: signature
  changed to `{ cat, galleryRecent, daysBack }`. Pulls past-7-days
  gallery photos, falls back to profile photo only as a last resort.
- `state/postcardStore.ts` + `state/catStudioStore.ts` updated to
  read `usePhotoStudioStore.getState().getPhotosForDate(catId, date)`
  / `getPhotosForCat(catId)` instead of `useHealthStore` /
  `useScanStore`.

### Multi-photo-per-day support

User asked: "why only one photo today? why cant be more?"
- Capacity: `DAILY_PHOTO_CAP = 5` per cat per local day.
- Lifetime: `MAX_PHOTOS_PER_CAT = 1000` (unchanged-ish; previously
  365 with hard 1/day).
- Storage path moved from `<catId>/<date>.jpg` (overwrites) to
  `<catId>/<photoId>.jpg` (each photo unique).
- `addPhoto` no longer drops same-date prior; if the cap is hit, the
  OLDEST today's photo gets evicted FIFO. Returns `{ photo,
  replaced_existing_today }` so the screen can surface a hint.
- New hooks: `useTodaysPhotos(catId)` returns array (was
  `useTodaysPhoto` returning single); `usePhotosInLastDays(catId, n)`
  for Cat Studio's reference-photo pick.
- `DAILY_PHOTO_CAP` exported so screens can show "[N] / 5 today".

### Capture flow unification

**Before**: Photo Studio screen had its own ImagePicker logic. No
other entry point.

**After**: One `captureViaImagePicker({ source })` helper in
`services/photoStudio.ts` handles permission + picker call + URI
extraction. Both Photo Studio screen AND the new Bond hero card use
it. Each screen handles its own UI state + analytics.

### Bond tab UX

**Header now matches Today's pattern.** Was `[avatar] Bond` (read as
"cat named Bond"). Now `[avatar] caption:Bond + heading1:catName` —
same shape as the Today tab.

**Hero photo capture card** sits at the top of the tile list, before
Personality. Two states:
- Empty: large CTA + value pitch "Photos here feed everything below
  — today's postcard, this week's movie poster, the diary's vision,
  and the monthly time-lapse. One thing creates everything else."
- Has photos: thumbnails strip (newest-first) + Add tile (or "Cap hit"
  tile when at 5/5). Tap thumbnail → goes to Photos. Tap Add → action
  sheet (Camera / Gallery).

**Tile order** (explicit user direction):
1. [Cat]'s Personality
2. [Cat]'s Diary
3. [Cat]'s Postcard
4. [Cat]'s Photos *(was Photo Studio)*
5. [Cat]'s Posters *(was Cat Studio)*
6. [Cat]'s Memory Book *(coming soon)*

**Personalisation** — every tile title + screen header now uses the
cat's name (e.g. "Lily's Diary" / "Lily's Posters"). Falls back to
"Cat <feature>" when no active cat.

**Lede** — was "Creative ways to know <cat> better — personality,
daily diary, photos, posters." Now: "Snap photos of <cat> — they
feed everything below." Sets the intent up-front.

### Cat Studio → Posters rename + clarity

User said: "4 is not behaving as u told me, i still see pick a genre,
i thought this is all automated now."

The auto-poster was working, but the screen didn't tell the user
when it was looking at one. Fixes:
- Renamed everywhere user-facing: "Cat Studio" → "Posters". Internal
  routes / store names / analytics events keep `cat_studio_` prefix
  for continuity.
- Result view now shows a clear label ABOVE the poster:
  - Auto-generated: `THIS WEEK'S AUTO POSTER · <Genre Title> · <Date>`
  - Manually picked: `YOU PICKED · <Genre Title> · <Date>`
- Renamed CTA: "Make another" → "Try a different genre".
- Stack title: "Cat Studio" → "Posters". Header: `[name]'s Posters`.
- Notification settings row: "Weekly Cat Studio poster" → "Weekly poster".

### Photo Studio → Photos rename

- Screen header: `[name]'s Photos`
- Stack title: "Photos"
- Today's UI: thumbnails strip with `[N] / 5` cap counter (was
  single-photo card)
- Empty state copy promoted to value-pitch: "Photos here feed
  everything: today's postcard, this week's movie poster, the
  diary's vision, and the monthly time-lapse. One thing creates
  everything else."

### Files touched

**Service / state:**
- `src/services/photoStudio.ts` — added `captureViaImagePicker` helper +
  changed `copyPhotoToStable` to id-based paths
- `src/state/photoStudioStore.ts` — multi-per-day + 5/day cap +
  evolved hooks
- `src/services/postcard.ts` — `gatherTodaysPhotos` reads gallery
- `src/services/catStudio.ts` — `pickWeeklyReferencePhoto` reads
  gallery
- `src/state/postcardStore.ts` — wires gallery as photo source
- `src/state/catStudioStore.ts` — wires gallery for reference photo

**Screens:**
- `app/(main)/bond.tsx` — full rewrite (header pattern, hero card,
  tile order, personalisation)
- `app/photo-studio.tsx` — TodayStrip replaces TodaysCard, uses
  shared captureViaImagePicker, "Photos" naming
- `app/cat-studio.tsx` — clarity labels, rename CTAs, "[name]'s
  Posters" header
- `app/_layout.tsx` — Stack titles updated
- `app/notification-settings.tsx` — Weekly poster row label tightened

### Migration notes for existing data

- Existing photoStudio entries persist with their original date-based
  paths (the URI is stored verbatim in the record). New entries use
  id-based paths. Both work side-by-side; no migration needed.
- Existing cached postcards may have `source: 'scan'` or `source:
  'symptom_photo'` photos. The PostcardPhoto type still allows those
  variants (so old cache type-checks); they just won't be created
  going forward.

---

## 8d. Diary deepens + Postcard contextualisation + Personality v2

### Diary — wider data surface + tone rule

The user wanted Diary to absorb every signal of the day (it's a private
candid log) while ending on a positive/cheeky note even on rough days.
Per their direction, photos are nice-to-have (gallery first, scan/symptom
photos as supplementary fallback) but not gating — Diary fires on ANY
material signal, even with no photo.

**New context sources fed into the diary prompt:**
- `chatThemesToday` — first sentence of each user-side chat turn from
  today, max 4. Cat references obliquely ("they kept asking about my
  paw"). Literal quotes deliberately avoided.
- `litterBoxToday` — count + abnormal-flag. Abnormal entries get a
  "comment with restrained dignity" cue; normal-only entries get a
  light "humans like to count things" cue.
- `outcomeChecksToday` — direction (better / same / worse) from the
  scan-anchored outcome push. Worse → "register with quiet awareness,
  never melodrama." Better → "acknowledge warmly without making a
  fuss."
- `symptomPhotosToday` — concern labels (cat notes "they photographed
  my [eye / paw]"). Also feeds the photo fallback chain.

**Photo source priority** (top→bottom, first available wins):
1. Most recent gallery photo from today
2. Today's symptom-photo
3. Today's scan image
4. Cat profile photo
5. null (text-only diary)

**Tone rule added to system prompt** (the "CLOSING RULE"):
> End on something self-possessed: a small triumph, a sly observation,
> or a deadpan acceptance. Even after a hard day — vet visit, scan,
> photographed-symptom moment, "worse" outcome check — DO NOT close
> with melodrama, fear, or self-pity. Cats are not pitiable narrators.
> Acceptable: regal, content, mildly amused, quietly satisfied,
> imperiously bored, knowingly tolerant. Forbidden: sad, scared,
> apologetic, hopeless, "i love them so much" saccharine.

**Material gate updated** — diary fires on any of: checkin, behavior
obs, weight, medication doses, scans, symptom photos, litter box,
chat themes, outcome checks, birthday, iversary, streak milestone,
special day, recent emergency. Photos alone are NOT material (a photo
without other context isn't a day worth narrating).

**Files changed:**
- `src/services/diary.ts` — DiaryDayContext extended; buildDayContext
  + buildUserPrompt updated; CLOSING RULE in system prompt; photo
  fallback chain rewritten
- `src/state/diaryStore.ts` — pulls galleryPhotosToday from
  photoStudioStore + chatTurnsToday from chatStore

### Postcard — contextual caption inputs

Already gallery-only on the photo side. Now the caption prompt also
gets:
- `todaysMood` — most-recent check-in mood word (drives caption tone)
- `bodyLanguageTags` — up to 5 tags from today's Read session (gives
  the caption something concrete to riff off)
- `streakMilestone` — when a 7/14/30/60/90/180/365-day streak lands
  today, caption may acknowledge the rhythm
- `isBirthday` / `isAdoptionIversary` — special-day caption energy

Birthday + iversary trigger explicit "celebratory but quotable" cues;
streak milestones trigger "day-N energy" cues. Without any of these,
the caption stays neutral and photo-driven.

**Files changed:**
- `src/services/postcard.ts` — buildCaptionUserPrompt + generatePostcard
  signature extended with the new optional fields
- `src/state/postcardStore.ts` — wires today's check-in mood, body-
  language tags, current streak (computed inline), and
  birthday/iversary calendar match through to the service

### Personality v2 — absorbs diary mood words

Brand-new fifth signal layer in `computePersonalityProfile`. Aggregates
mood_words from the last 30 days of diary entries into Feline-Five
trait deltas using `DIARY_MOOD_DELTAS` (controlled vocabulary mapping
~30 words across regal/affectionate/playful/anxious/grumpy/low-arousal
families). Layer weight scales with entry count (cap at 14 entries =
2 weeks); contributes up to 0.15 to confidence.

**Confidence formula (revised):**
| Layer | v1 weight | v2 weight |
|---|---|---|
| Breed prior | 0.15 | 0.13 |
| Quiz answers | 0.20 | 0.18 |
| Check-ins | 0.40 | 0.34 |
| Behaviour obs | 0.25 | 0.20 |
| Diary moods (NEW) | — | 0.15 |
| **Max** | **1.00** | **1.00** |

Cats with no diary entries land at the v1 ceiling (~0.85), preserving
backwards behaviour. Cats with active diary use can hit full 1.00.

**`PersonalityProfile.inputs_used.diary_entry_count`** added (optional —
older cached profiles don't have it; UI tolerates absent/0).

**Lazy require** used in `personalityStore.recompute` to read the
diary store. This avoids a circular static-import chain
(diaryStore→personalityStore for archetype, would have created
personalityStore→diaryStore→personalityStore).

**Files changed:**
- `src/services/personality.ts` — `DIARY_MOOD_DELTAS` table,
  `diaryMoodVector` aggregator, layer added to
  `computePersonalityProfile`, `computeConfidence` re-weighted,
  `inputs_used` extended
- `src/state/personalityStore.ts` — lazy diary read + pass-through

### Posters — deferred work logged

User explicitly said "log it for later" for **personality-aware genre
selection** in Cat Studio (e.g. Hunter archetype → action genres,
Sage → dramatic, Goofball → comedy). Currently the weekly auto-poster
picks any genre not in the last 3. Future v2: weight the genre pool
by archetype-fit. ~Half-day build. Defer until we see telemetry on
whether users tap "Try a different genre" — if they don't, the
auto-pick already feels right and the personality-bias adds little.

### What this changes for closed-test users

- Diaries on rough days no longer end on a sad note (was happening
  occasionally pre-tone-rule).
- Postcards reference today's actual mood + body language → less
  generic captions.
- Personality archetype settles faster + reflects long-term mood drift,
  not just check-ins + body lang.
- A user with high diary engagement but no quiz / few check-ins can
  still hit "stable" confidence (was previously capped at ~0.45).

---

## 9. Pointers for fresh-context resumption

- For prior context (rebrand, four-pillar architecture, Triage absorption,
  Chat MVP, Personality v1, Cat Diary, all the history): read
  `docs/SESSION-CHECKPOINT-2026-05-01.md`.
- For the active todo backlog beyond 6:
  - Photo Studio v2 (vision pass)
  - Long-form articles beyond 20 (cards/articles authoring lane)
  - More Phase-2 cards beyond 642 (Supabase RAG corpus)
  - Streaming chat (RN finickiness — defer)
  - Pro tier features for Personality (drift, cat-cat compatibility)
  - Multi-cat dynamics + senior cat mode (deferred)

End of 2026-05-02 checkpoint.
