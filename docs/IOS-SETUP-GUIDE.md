# CatMD iOS Build & Deploy Guide

> **Audience**: a fresh Claude session (or human) who needs to take CatMD
> from "Android only" to "live on the App Store" without re-deriving any
> decisions.
>
> **Codebase status (as of 2026-05-04)**: React Native + Expo SDK 54, RN
> 0.81, new architecture enabled. Currently shipping on Google Play —
> v0.1.7 / versionCode 54 (Android AAB built today; replaced v0.1.6/51).
> All native deps are cross-platform.
>
> **Brand positioning**: "AI for cat owners. Your cat, decoded." Triage
> is one feature among many. The product also surfaces a first-person
> cat-voice chat ("talk to your cat"), a daily diary in the cat's
> voice, a 7-facet "Becoming" identity score, and a People & Pets
> directory of named family members tagged in photos. None of these
> are medical features. The store listing in
> `store-listing/store-listing-copy.md` is the single source of truth
> for Play Store + App Store; reviewer notes in §6f are aligned to it.
>
> **What shipped between 2026-05-03 and 2026-05-04** (read §0.5 below
> for the full changelog if you've been away). The iOS guide reflects
> these features in §6f (reviewer notes) and §5 (screenshots), but if
> you're cutting screenshots fresh from a 0.1.7 build, the new screens
> to capture are listed in §5d.
>
> **Read first**:
> - `docs/SESSION-CHECKPOINT-2026-05-03.md` — full session log. §16
>   covers the brand pivot ("AI vet triage" → "AI for cat owners").
>   §17 covers the Cat Studio expansion (48 variants × 6 themes,
>   weekly rotation, safety-retry mechanic). §18 covers telemetry
>   gaps closed.
> - `docs/CLOUD-SYNC-AND-RESTORE-PLAN.md` — Pro-only cloud backup.
>   MVP is shipped (paywall email gate + auto-pull on email
>   verification). Phase B follow-ups documented for cross-platform
>   restore + photo Storage. Read before iOS launch so App Review
>   notes mention the email gate correctly.
> - `docs/CATVERSE-VIRALITY-PLAYBOOK.md` — strategic backlog for
>   personalised cat content generators (Cat Vlog, Cat Horoscope,
>   Calm Cat ambient, etc.). Not part of iOS shipping work — read
>   only if curious about the longer-term roadmap.
> - `store-listing/store-listing-copy.md` — paste-ready listing copy
>   shared between Play Store + App Store. **Already updated to "AI
>   for cat owners"** positioning. Use as-is for App Store.
> - `store-listing/screenshots/curated/` — 8 chosen Play Store
>   screenshots, in priority order. iOS App Store wants its own sizes
>   (see §5) but the SAME 8 screens are the right anchor set.
>
> **iOS prep already partially done in app.json** (this happened in
> parallel with the Android session). Verify before continuing:
> - `ios.bundleIdentifier`: `com.catmd.app` ✓
> - `ios.buildNumber`: `"1"` ✓
> - `ios.config.usesNonExemptEncryption`: `false` ✓
> - `ios.infoPlist`: NSCameraUsageDescription / NSPhotoLibraryUsageDescription /
>   NSMicrophoneUsageDescription / ITSAppUsesNonExemptEncryption ✓
> - `ios.privacyManifests`: full block with NSPrivacyCollectedDataTypes
>   (ProductInteraction, PhotosOrVideos, AudioData, EmailAddress) +
>   NSPrivacyAccessedAPITypes (FileTimestamp, UserDefaults, SystemBootTime,
>   DiskSpace) ✓
>
> Still TODO before first iOS build: add `production.ios` block to
> `eas.json` (see §4a), confirm Apple Dev Program enrollment status,
> generate APNs key for push notifications.
>
> The Android side is mature — iOS is a port, not build-from-scratch.

---

## 0. TL;DR / shape of the work

- **Total effort**: 12–18 dev hours + 5–10 calendar days (most of the
  calendar time is Apple's queues, not coding)
- **Critical path**: Apple Developer Program enrollment (1–3 days
  verification) → privacy manifest + EAS profile (3–5 hrs code) → first
  iOS build → TestFlight smoke test → App Store metadata + screenshots
  (3–4 hrs) → submit → 24–48 hr review → live
- **No 14-day closed test required** (that's a Google Play policy for
  new dev accounts; Apple has no equivalent)
- **Cost**: $99/year Apple Dev Program; everything else free

The codebase is **already iOS-ready** at the bundle/permissions/Platform
level. Most of the dev work is bureaucratic glue (manifests, profiles,
metadata) — not feature porting.

---

## 0.5 Changelog since 2026-05-03

A meaningful chunk of product shipped between the last time this guide
was touched and the current Android v0.1.7 build. Each item below
either changes how to describe the app to Apple, what data it collects,
or which screenshots to capture.

### Chat — first-person cat persona (NEW)
- Chat used to be "AI cat companion that knows your cat" — now it's
  the cat itself replying in **first person**, in the voice register
  set by the personality archetype quiz. Replies are short, opinionated,
  often mildly imperious (think: "Tuna. The good kind. Don't argue.").
- Chat reads recent diary entries (last ~14 days), the People & Pets
  directory, the user's self-facts (see below), and recent triage
  scans. Medical questions still trigger `[ACTION:OPEN_TRIAGE]` /
  `[ACTION:CALL_VET]` action tokens that route to safety-net surfaces.
- **App Review impact**: ensure §6f explains this is NOT
  anthropomorphisation that misleads users about pet health — it's a
  voice/UX layer; medical safety still routes to triage.
- **Privacy impact**: chat turns include a background LLM extraction
  pass that pulls "self-facts" out of user messages (see below). All
  facts are stored locally, opt-in cloud-synced for Pro.

### Becoming meter (NEW)
- A 7-facet identity score (face, voice, body, rhythm, family, nature,
  memory) shown on the Personality screen as a circular progress wheel
  + collapsible accordion. Each facet maps to one type of input the
  user supplies (photos, chat turns, body-language sessions, daily
  check-ins, named subjects, personality quiz, diary days).
- Drives a "becoming-depth" 0–100 score. The diary occasionally
  acknowledges milestone crossings ("seven days now…") in the cat's
  voice on landmark days.
- **App Review impact**: this is a transparency / engagement feature,
  not a medical scoring system. It maps how shaped the cat-in-the-app
  has become from the user's input, NOT a measure of the cat's health
  or behaviour. Reviewer should not confuse this with a health score.
- **Privacy impact**: stage snapshots stored locally + opt-in
  cloud-synced for Pro.

### People & Pets directory (NEW)
- Users tag people and other pets visible in their cat's photos. Each
  tag links to a per-cat directory entry ("Mom", "Bella", "Grandma").
- Vision auto-suggests existing matches on new photos using a 10-attribute
  description (age band, hair colour, eyewear, build, distinguishing
  features, etc.) — NOT face recognition / biometric data. Approximate
  matching for household-scale recognition.
- Recurring names show up in the diary as memories ("Bella was here
  again", "haven't seen Mom in three days").
- **App Review impact**: clarify in §6f that no biometric face data is
  generated. Vision returns descriptive attributes only.
- **Privacy impact**: directory entries (names, photo refs, descriptions)
  stored locally + opt-in cloud-synced for Pro. Names are personal
  data — flag in Privacy Nutrition Label as User Content + Other Data.

### Self-Facts (NEW)
- User can tell their cat things in chat ("you love tuna"). A background
  LLM extraction pulls these out and stores them as durable
  "self-facts" the cat references in future chats and diary entries.
- Also editable manually via the Becoming → Personality section.
- **Privacy impact**: stored locally + opt-in cloud-synced for Pro.
  These are user-asserted facts ABOUT THE CAT, not user PII.

### Conscious Diary (UPGRADED)
- Now writes daily entries automatically — no longer requires manual
  trigger. Cron-style 7pm fire OR app-launch backfill catches missed
  days.
- Entries can be melancholic 1-2 sentence "empty-day" entries on days
  with no activity (after a 7-distinct-active-days lifetime floor).
- Memory tiers: recent entries, mood arcs, recurring entities, life
  events, anticipations, named subjects, self-facts.
- Single-day-with-arrows UX (replaced today + collapsible-past).
- **App Review impact**: emphasise this is creative content generation,
  not health reporting. Diary is a journaling feature, not medical.

### Photo system rework
- Removed daily 4-photo cap. Users now take unlimited photos. Postcard
  randomly samples 3 from each day's pool.
- Removed the "Not Lily?" identity-pill UI (kept underlying detection
  data for filtering).
- Subject tagging UI (chips on photo viewer + bottom-sheet with
  autocomplete) added — see People & Pets above.
- **App Review impact**: minimal — same photo data flow as before, just
  more photos and a tagging layer.

### Cat Studio (POLISHED)
- 48 variants × 6 themes (Movie posters, Historical figures, Famous
  paintings, Studio Ghibli scenes, Pixar characters, 80s anime). Weekly
  Sunday rotation with stable epoch.
- Watermark added to all generated posters (catmd.pet).
- Identity-lock on the user's specific cat tightened.
- Safety-retry fallback for false-positive content moderation.
- **No App Review impact** — same image-generation feature as before.

### Cloud sync expanded
- Three new tables backing up to Supabase for Pro users: subject_directory,
  self_facts, becoming_state. Schema in
  `knowledge-pipeline/supabase/schema-becoming.sql`.
- Push-on-write hooks in each store (fire-and-forget). Pull on
  fresh-install via existing restore-from-cloud flow.
- **App Review impact**: update §6d Privacy Nutrition Label to include
  "Other User Content" (named subjects, self-facts) as a Pro-tier-only
  data type stored in Supabase.

### catmd.pet website + Play Store listing
- Updated to mention the new features in pillar descriptions. Headline
  positioning ("AI for cat owners") preserved — talk-to-your-cat is one
  feature among many, not the brand.
- Source-of-truth: `store-listing/store-listing-copy.md` (paste-ready
  for both Play and App Store).

### Sentry
- `@sentry/react-native` is in `app.json` plugins but not auth-token-
  configured. Builds set `SENTRY_DISABLE_AUTO_UPLOAD=true` env var
  (added 2026-05-04 to clear a build failure). Sourcemaps don't upload;
  runtime crash capture still works. **TODO before iOS launch**: set
  `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` in EAS
  environment so iOS builds also capture readable stack traces.

### Dev/marketing
- New `marketing/` folder with strategy README, 5 storyboards
  (15s TikTok format), AI video prompts (Higgsfield/Seedance), brand
  guide, music suggestions, text overlays. Not iOS-relevant but worth
  knowing about for cross-functional context.

---

## 1. What's already done in the codebase ✓

You don't need to touch any of these. Listed so you trust the foundation:

- `app.json` has:
  - `ios.bundleIdentifier`: `com.catmd.app`
  - `ios.supportsTablet: false`
  - `ios.infoPlist` with `NSCameraUsageDescription`,
    `NSPhotoLibraryUsageDescription`, `NSMicrophoneUsageDescription`
- Expo plugins all iOS-compatible:
  - `expo-camera` (with `cameraPermission` string)
  - `expo-image-picker` (with `photosPermission` string)
  - `expo-notifications`
  - `expo-sqlite`, `expo-secure-store`, `expo-splash-screen`,
    `@react-native-community/datetimepicker`
- 13+ `Platform.OS === 'ios'` branches across screens already handle
  iOS-specific behaviour (date pickers `display: 'spinner'`,
  KeyboardAvoidingView `behavior: 'padding'`, etc.)
- All native dependencies (react-native-view-shot, expo-sharing,
  expo-file-system, AsyncStorage, posthog-react-native, supabase,
  RevenueCat) are iOS-compatible by default

---

## 2. What's missing — the work to do

Five categories, in order:

### 2a. Apple Developer Program enrollment ($99/year)
- Sign up at https://developer.apple.com/programs/enroll/
- Individual enrollment is fine (no D-U-N-S needed unless you want
  Organization-level account)
- **Verification takes 1–3 days** — start this BEFORE any code work
- Owner of EAS account: `amit1601`. Apple Dev account should be in same
  legal name for clean cert generation later.

### 2b. Privacy Manifest (`PrivacyInfo.xcprivacy`)
**Required by Apple since 2024-Q1 for ALL apps.** Declares:
- Data types collected
- Required-reason API usage (file timestamps, UserDefaults, etc.)

Use the EAS config plugin or add manually. See §4 for the exact JSON we
need based on what CatMD actually does.

### 2c. iOS production profile in `eas.json`
Currently `eas.json` has `production` block but no iOS-specific
config. Add `production.ios` with `autoIncrement: true` so build numbers
increment automatically (the iOS equivalent of versionCode).

### 2d. App Store Connect listing
- Name, subtitle, description, keywords
- Screenshots (3 sizes minimum)
- Privacy Nutrition Label answers
- Age rating questionnaire
- Category selection — **choose Lifestyle, NOT Health & Fitness**
  (see §6 risks)

### 2e. APNs key (for push notifications)
Apple Developer → Certificates, Identifiers & Profiles → Keys → New Key
with "Apple Push Notifications service (APNs)" enabled. Download the
`.p8` file. Hand it to EAS via `eas credentials` so push notifications
work in production builds.

---

## 3. Step-by-step execution plan

Sequenced so Apple's verification queue runs in parallel with code work.

### Day 1 — kick off everything that has a wait queue
1. Enroll in Apple Developer Program (`https://developer.apple.com/programs/enroll/`)
   - Pay $99
   - Verification typically 24–72 hrs
2. While waiting, do all the code prep below (§4)
3. Push EAS update with the prep changes so the next build picks them up

### Day 2–3 — first iOS build (once Apple Dev verifies)
1. Create the App Store Connect listing (placeholder data is fine)
   - Name: CatMD
   - Bundle ID: `com.catmd.app` (matches `app.json`)
   - SKU: anything unique, e.g. `catmd-ios-001`
2. Generate APNs key (see §2e)
3. Run first iOS build:
   ```bash
   cd /d/apps/catmd
   npx --yes eas build --platform ios --profile production
   ```
   - First time, EAS will prompt to generate Apple distribution cert +
     provisioning profile. Accept managed credentials.
   - Build queue + compile: 15–30 min
   - Output: `.ipa` uploaded to App Store Connect → TestFlight

### Day 3–4 — TestFlight smoke test
1. Add yourself as Internal Tester in App Store Connect → TestFlight
2. Install via TestFlight on a real iPhone
3. Walk every flow (see §7 smoke-test checklist)
4. Fix anything iOS-specific that surprises you

### Day 4–5 — App Store metadata + submit
1. Screenshots (see §5) — 3 sizes minimum
2. Description, keywords, privacy URL (`https://catmd.pet/privacy`)
3. Privacy Nutrition Label (see §6)
4. Submit for review

### Day 5–7 — Apple review + live
- Apple median review: 24–48 hrs
- First-time submissions can be slower
- See §6 for likely rejection patterns + mitigations

---

## 4. Code changes to make

These are the `~3 hrs of code work` that's independent of Apple's queue.
Do them on Day 1 while Apple verifies.

### 4a. Add iOS production profile to `eas.json`

Current state:
```json
"production": {
  "autoIncrement": true,
  "channel": "production",
  "android": { "buildType": "app-bundle" },
  ...
}
```

Add iOS block (sibling of `android`):

```json
"production": {
  "autoIncrement": true,
  "channel": "production",
  "android": { "buildType": "app-bundle" },
  "ios": {
    "autoIncrement": "buildNumber"
  },
  ...
}
```

`autoIncrement: "buildNumber"` increments the iOS build number on each
production build (independently of Android versionCode). `version` in
`app.json` is shared.

### 4b. Add iOS-specific app.json fields

Add these inside `expo.ios`:

```json
"ios": {
  "supportsTablet": false,
  "bundleIdentifier": "com.catmd.app",
  "buildNumber": "1",
  "config": {
    "usesNonExemptEncryption": false
  },
  "infoPlist": {
    "NSCameraUsageDescription": "...",
    "NSPhotoLibraryUsageDescription": "...",
    "NSMicrophoneUsageDescription": "...",
    "ITSAppUsesNonExemptEncryption": false
  }
}
```

Why each:
- `buildNumber`: starting point; auto-incremented by EAS thereafter
- `usesNonExemptEncryption: false`: skips the export-compliance question
  on every TestFlight upload (we use HTTPS but no custom crypto)
- `ITSAppUsesNonExemptEncryption: false`: same flag in Info.plist —
  belt-and-suspenders

### 4c. Privacy Manifest

Create `PrivacyInfo.xcprivacy` at the project root via the
`expo-build-properties` plugin OR a static asset. Cleanest path: add to
`app.json` plugins as a custom plugin. For now the simplest is a static
file:

```bash
# Create file at project root
touch PrivacyInfo.xcprivacy
```

Content (XML plist):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <!-- PostHog analytics -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeProductInteraction</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAnalytics</string>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Photos (camera + library) -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePhotosOrVideos</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Audio (Whisper transcription on body language clips) -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeAudioData</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Email (optional, for paywall + outcome notifications) -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeEmailAddress</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <!-- File timestamp APIs (used by expo-file-system for stable paths) -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
      </array>
    </dict>
    <!-- UserDefaults (AsyncStorage uses this on iOS) -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <!-- System boot time (used by some RN internals) -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>35F9.1</string>
      </array>
    </dict>
    <!-- Disk space (used by Image cache) -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryDiskSpace</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>E174.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
```

Reason code reference (Apple-provided constants):
- `C617.1`: Inside app sandbox or app group container
- `CA92.1`: Access UserDefaults of the app or app group
- `35F9.1`: Measure time to perform operations
- `E174.1`: Display disk space to user

To get this file into the iOS build, use `expo-build-properties` plugin
or a custom Expo config plugin. The simplest is `app.config.ts` (rename
from `app.json`) with a plugin that copies the file at prebuild time.

**Quick path**: Use the community `react-native-privacy-manifest`
package OR add the file via a `withInfoPlist` config plugin. Document
this when implementing.

### 4d. Verify Whisper / multipart upload works on iOS

iOS handles multipart/form-data slightly differently than Android. The
existing `transcribeBehaviorAudio` in
`src/services/behaviorObservation.ts` uses RN's standard FormData with
`{ uri, name, type }` which works on iOS. **Sanity-test this on
TestFlight** — the audio file path on iOS uses `file://` URIs from the
camera which usually transmit fine.

### 4e. Check `softwareKeyboardLayoutMode` — Android-only

`app.json` has `"softwareKeyboardLayoutMode": "resize"` under `android`.
That's already correctly scoped to Android — iOS uses
`KeyboardAvoidingView` per-screen. Existing Platform.OS branches in
chat.tsx + cat-profile.tsx + follow-up.tsx + appointments.tsx + others
already handle iOS correctly.

---

## 5. Screenshots (App Store)

### 5a. Required sizes

Apple requires screenshots in these sizes (you can submit just the
6.7" one and it'll auto-fill, but providing 3 is best):

- **6.9"** (iPhone 16 Pro Max, 1290×2796) — primary
- **6.5"** (iPhone 11 Pro Max / older Pro Max, 1284×2778)
- **5.5"** (iPhone 8 Plus, 1242×2208) — Apple still requires this for
  legacy support

3–10 screenshots per size.

### 5b. Use the same 8-screenshot set we built for Play Store

**Just resize, don't reshoot.** The curated Play Store set in
`store-listing/screenshots/curated/` (already cropped + ordered) is
the same anchor set Apple wants. They're 921×1768 PNG-as-JPEG; we'll
resize to iOS sizes per §5a. Order:

| # | File | Pillar |
|---|---|---|
| 1 | `01-today-sections.jpeg` | Today (anchor) |
| 2 | `02-postcard-catsby.jpeg` | Bond / Postcard |
| 3 | `03-personality-archetype.jpeg` | Bond / Personality |
| 4 | `04-poster-catsby-hero.jpeg` | Bond / Poster |
| 5 | `05-body-language-result.jpeg` | Today / Body Language |
| 6 | `06-triage-result-monitor.jpeg` | Triage |
| 7 | `07-chat-knead.jpeg` | Chat |
| 8 | `08-diary-saturday.jpeg` | Bond / Diary |

Lead is Today + Bond, Triage sits at #6 with the Monitor (non-scary)
tier — minimises medical-device review risk.

### 5c. Resize to iOS sizes

Apple accepts the Android source dimensions if they're at least
1242×2208 for the 6.5"/6.7" sizes. Some of ours (921×1768) are
smaller — upscale via Pillow with Lanczos resampling, OR retake
on iOS Simulator at the right device size. The simpler path:
upscale the existing curated set. ~5 min of Python work.

```python
from PIL import Image
sizes = {"6.7": (1290, 2796), "6.5": (1284, 2778)}
# upscale each curated jpeg with Image.LANCZOS, save to ios-screenshots/
```

If you'd rather reshoot natively for crisp pixels, run
`expo run:ios` on a 6.7" iOS Simulator, hit Cmd+S in the simulator
to save the same 8 screens, and skip the upscale.

### 5d. Stale screenshots — RECAPTURE before iOS submission

The curated set was cut from v0.1.6 (2026-05-03). Several screens
have meaningfully changed in v0.1.7 — these need fresh captures:

| File | Why stale | What to capture instead |
|---|---|---|
| `07-chat-knead.jpeg` | Chat persona shifted from third-person AI companion to first-person cat voice. Replies look completely different now. | Open Chat in v0.1.7, type a punchy question ("Why are you on my laptop?"), capture the screen with the cat's reply visible + a "Lily learned: …" chip if any |
| `08-diary-saturday.jpeg` | Diary now references named family + self-facts. New entries are richer. | Pre-populate the test account with named subjects, generate a fresh entry, capture it |
| `03-personality-archetype.jpeg` | Personality screen now has the Becoming wheel + facet accordion below the archetype card. Bigger story. | Capture scrolled to show archetype card AT TOP and Becoming wheel + at least 2 expanded facets BELOW. Single screenshot OR two slot screenshots — recommend two: archetype reveal alone (#3), then "Becoming under personality" as a NEW slot |

### 5e. New screens to capture for the v0.1.7 listing

These didn't exist in v0.1.6 and should anchor the listing. Recommend
expanding from 8 → 10 screenshots:

| # | What | Suggested filename |
|---|---|---|
| 9 | Becoming wheel (zoomed, showing the % + stage label) | `09-becoming-wheel.jpeg` |
| 10 | People & Pets directory page (with at least 2-3 entries populated) OR the subject-tag sheet open on a photo | `10-people-and-pets.jpeg` |

Order suggestion for the iOS listing (10 screenshots):

1. `01-today-sections.jpeg` — Today (anchor)
2. `02-postcard-catsby.jpeg` — Postcard
3. `07-chat-knead-v0.1.7.jpeg` ⚡ **fresh capture** — Chat (cat replies in voice)
4. `08-diary-saturday-v0.1.7.jpeg` ⚡ **fresh capture** — Diary
5. `03-personality-archetype-v0.1.7.jpeg` ⚡ **fresh capture** — Personality
6. `09-becoming-wheel.jpeg` ⚡ **NEW** — Becoming
7. `10-people-and-pets.jpeg` ⚡ **NEW** — People & Pets
8. `04-poster-catsby-hero.jpeg` — Cat Studio poster
9. `05-body-language-result.jpeg` — Body Language read
10. `06-triage-result-monitor.jpeg` — Triage (Monitor tier, non-scary)

Reordering puts the cat-voice / personality story up front (slots 3-6),
which matches the catmd.pet hero positioning. Triage at slot 10 keeps
the medical-device review risk minimal.

Capture these from a TestFlight install of v0.1.7 (not the simulator —
real device makes them feel less "demo"). Use a clean test cat profile
with ~2 weeks of usage so the diary, becoming wheel, and personality
have rich content.

---

## 6. App Store metadata + Privacy Nutrition Label

### 6a. App Information

- **Name**: CatMD
- **Subtitle** (30 chars): "Your cat's MD."
- **Bundle ID**: `com.catmd.app`
- **SKU**: `catmd-ios-001`
- **Category**: **Lifestyle** (primary) → Health & Fitness (secondary)
  - Reasoning: leading with Lifestyle reduces likelihood of medical-
    device review concerns. CatMD's Bond pillar is genuinely lifestyle
    (postcards, personality, photo memories), and Triage is an AI
    guidance tool, not a diagnostic device.

### 6b. Description — use the shared source-of-truth doc

**Don't duplicate the description here.** Paste from
`store-listing/store-listing-copy.md` (full description section). That
file is the single source of truth for BOTH Play Store and App Store.
Updating the description means editing ONE file, then re-pasting in
both consoles. Last updated 2026-05-03 to reflect 4-pillar positioning.

The description there already includes:
- Bond-led opening
- All four pillars (Today / Bond / Chat / Triage)
- FGS / Feline Grimace Scale call-out
- AI disclosure (satisfies Apple's GenAI Guidelines from Sept 2024)
- Privacy + medical disclaimer footer

Trim if needed for App Store: it allows 4000 chars same as Play Store,
but the App Store text-density convention is tighter. If you want a
tighter version, drop the bullet list under Bond and keep just the
opening paragraph + 4-pillar description + AI disclosure + disclaimer.

### 6c. Keywords (100 chars total)

```
cat,kitten,vet,triage,health,mood,personality,litter,scan,diary,postcard,checkup
```

### 6d. Privacy Nutrition Label answers

App Store Connect → App Privacy. Map answers to what CatMD actually
does:

**Data Types Collected**:

| Type | Linked to user? | Used for tracking? | Purpose | Notes |
|---|---|---|---|---|
| Photos or Videos | No | No | App Functionality | Required for AI vision (triage, body-language, postcard, posters, diary). Local-only on free tier; opt-in cloud sync for Pro. |
| Audio Data | No | No | App Functionality | 6-second body-language clips processed via OpenAI Whisper. Not stored. |
| Product Interaction (PostHog events) | No | No | Analytics, App Functionality | Anonymous distinct_id. No personal info. |
| Email Address | Yes | No | App Functionality | Required at Pro paywall (cloud restore identity). Optional / anonymous for free users. |
| Purchase History (RevenueCat) | Yes | No | App Functionality | App Store / Play Billing receipt data. |
| User Content — cat name, named subjects (people/pets in photos), self-facts ("you love tuna") | Yes (Pro tier only) | No | App Functionality | NEW 2026-05-04. Free users: local-device only. Pro users opt in to Supabase backup so their cat's identity survives device changes. Stored encrypted in transit + at rest. |

**Apple-specific framing notes**:
- "Other User Content" is the right Apple bucket for named subjects + self-facts. Reviewer may ask why this is collected; answer: cross-device backup of the cat's identity (the names recur in diary memory, so losing them on device change resets the cat-in-the-app's social world).
- The vision-detected attributes for photo subjects (age band, hair colour, eyewear, build, etc.) are **descriptive metadata, not biometric data**. Apple's privacy framework distinguishes biometric data (face/fingerprint identifiers — not present here) from generic visual attributes (present here, but not linked across users / not used for identity).

**Data NOT collected** (declare these as "No"):
- Phone Number
- Physical Address
- Health & Fitness data (the cat's, not the user's — Apple's def
  excludes pet data)
- Location
- Contacts
- Browsing History
- Search History
- Sensitive Info (race, political views, etc.)
- Financial Info (Apple/Google handle billing; we only see receipt status)
- Biometric data (no face recognition or fingerprint use)

**Tracking**: NO. CatMD does not track users across other apps/websites
owned by other companies. PostHog runs first-party and uses anonymous
distinct_id by default.

### 6e. Age Rating

Use the questionnaire honestly. CatMD should land at **4+**:
- No violence, profanity, sexual content
- No user-generated content shared between users
- No web access (in-app browser to articles only)
- AI-generated content (cat captions / posters / diary) is bounded to
  cat content — answer "Infrequent/Mild" if Apple asks about AI-
  generated content explicitly

### 6f. App Review Information

- **Demo account**: Apple sometimes asks for a test account. Provide a
  pre-set account with a cat already added (so reviewer doesn't have to
  go through onboarding) AND an existing Pro subscription (so reviewer
  can test paid flows without paying real money).
- **Notes for reviewer**: include this — UPDATED 2026-05-04 to reflect
  the cat-voice chat persona, Becoming meter, People & Pets directory,
  and Self-Facts memory:

```
CatMD is AI for cat owners — a daily-use companion app that uses AI to
interpret photos, behaviour, and check-ins from the user's cat. Core
features:

(1) PERSONALISED CONTENT GENERATION (Bond pillar, the marketing lead):
- Daily Diary: AI-written diary entry in the cat's voice from the
  day's events. Auto-writes nightly even when the user doesn't open the
  diary tab. Empty-day entries are short and melancholic. Memory
  references recent days, named family members, and what the user has
  told the cat about themselves.
- Daily Postcards: AI-written caption + photo collage of today's photos
- Personality archetypes: 9 archetypes mapped from behaviour data,
  validated against the Litchfield Feline Five framework (Litchfield
  et al., PLoS One 2017)
- Becoming: a 7-facet identity score (face, voice, body, rhythm,
  family, nature, memory) showing how shaped the cat-in-the-app has
  become from the user's input. NOT a health score — a transparency /
  engagement feature showing input completeness across the seven types
  of data the app uses.
- People & Pets directory: users tag people and other pets visible in
  their cat's photos. Vision uses descriptive attributes (age band,
  hair colour, eyewear, build) for approximate matching across
  photos — NOT face recognition / biometric identification. Recurring
  tagged names show up in the diary as memories.
- Cat Studio: 48 AI-generated artwork variants across 6 themes (movie
  posters, historical figures, famous paintings, Studio Ghibli scenes,
  Pixar characters, 80s anime). New theme rotates every Sunday.
- Body Language reader: 6-second video → AI describes mood / posture /
  vocalisations across tail, ears, eyes, posture, and audio channels.

(2) DAILY CHECK-IN (Today pillar):
- 15-second mood / appetite / litter check-in
- Streaks, trends, health rhythm patterns
- Photo gallery (Photo Studio) feeds the content above. No daily
  photo cap.

(3) AI CHAT (Chat pillar — UPDATED 2026-05-04):
- Owner can talk to their cat in chat. The AI replies in first person
  in the cat's voice, in the register of their personality archetype.
  This is a creative voice/UX layer, NOT a claim that the AI literally
  speaks for the cat. The cat-voice replies are clearly framed as the
  app's interpretation — same disclosure as other AI-generated content.
- Self-facts: when the user states something about their cat ("you love
  tuna"), a background LLM extraction pass stores the fact as durable
  cat self-knowledge. Used in future chat replies + diary entries.
- Medical safety: when the user describes symptoms in chat, the cat
  voice still routes to the Triage pillar via [ACTION:OPEN_TRIAGE]
  buttons that render in the chat bubble. Recent triage scans (last 7
  days at concern/urgent tier) override the cat's "today's mood"
  framing so the app honestly reports unwellness instead of
  performing normal behaviour.

(4) VET-GRADE TRIAGE (Triage pillar — secondary, not lead):
- Photo + symptom text → urgency tier + red flags + follow-up Qs
- Pain check (Feline Grimace Scale, Evangelista et al. 2019,
  University of Montreal validated facial pain scale)
- Vaccines, weight, watch monitors (CKD, hyperthyroid, breathing rate)

Triage is ONE feature among many — NOT the primary positioning. The
brand is "AI for cat owners"; medical features remain present but are
not the lead. Most user sessions are non-medical (chat with cat,
diary, postcard, body-language, Cat Studio, personality, daily
check-in). The app is informational only, with prominent "not a
substitute for veterinary care" disclaimers in every triage result.

The cat-voice chat does NOT make medical claims. Symptom-related
questions either route to the structured Triage scan ([ACTION:OPEN_TRIAGE]
button) or, for emergencies, [ACTION:CALL_VET] which opens the
device dialer with the ASPCA poison hotline as a default fallback.

We use:
- OpenAI GPT-4o-mini for chat + scan + diary + body-language text
  generation + self-facts extraction
- OpenAI GPT-4o (emergency model) for high-urgency triage scans
- OpenAI Whisper for body-language audio transcription
- OpenAI text-embedding-3-small for RAG retrieval against a curated
  feline-medicine knowledge base
- gpt-image-1 for Cat Studio artwork generation (48 variants × 6
  themes); each generation includes an automatic prompt-softening
  retry if the OpenAI safety moderator rejects the first attempt
  (sanitises combat / weapon / dystopian language, never used to
  evade real safety concerns — this is for known false-positives on
  cat-subject content)
- OpenAI vision (gpt-4o-mini) for subject detection in photos —
  returns descriptive attributes only (age band, hair colour, build,
  etc.), NOT biometric data
- PostHog for anonymous product analytics + per-LLM-activity cost
  attribution
- Sentry for crash / error reporting (auto-upload disabled in current
  builds; runtime capture still active)

DATA STORAGE:

Free tier: All photos, diary entries, named subjects, and self-facts
stored locally on the user's device. No account required. No data
leaves the device except for the AI calls which use the photo/text
in-flight only and are not stored on our servers.

Pro tier: Subscribing requires email verification (a 6-digit OTP via
email — no magic links). This email becomes the user's identity for
cloud backup so their cat's full history can be restored on a new
device. The email gate appears AFTER the user taps Subscribe but
BEFORE the purchase sheet — this is by design, not a bug. Users who
don't verify their email cannot complete a Pro purchase.

Photos, scans, health logs, diary entries, named subjects, self-facts,
and the becoming-state snapshot are mirrored to a Supabase backend
(eu-west region) for Pro users only. Data is encrypted in transit
(TLS) and at rest, scoped per user via Postgres Row-Level Security.
Users can request deletion via Settings > Forget me or by emailing
support@catmd.pet — this fires a server-side `forget_me()` RPC that
removes ALL the user's rows across cats, events, scans, diary entries,
subject directory, self-facts, and becoming state.

Test account: test@catmd.pet / [password]
Cat in account: Luna, 3yr female DSH
This test account is pre-confirmed (email already verified) and has
an active Pro subscription assigned via TestFlight promo code so the
reviewer can test the full paid flow without going through Apple's
sandbox purchase. The account is pre-populated with ~14 days of
diary entries, 3 named subjects in People & Pets, and a partial
self-facts list — so the Becoming wheel reads at ~60% and the chat /
diary have memory to draw from.
```

---

## 7. TestFlight smoke-test checklist

Walk every flow after first build. iOS-specific things to watch:

- [ ] **Onboarding**: 6 slides, no copy clipping on iPhone SE 3 (smallest
      modern device)
- [ ] **Cat profile creation**: date pickers use iOS spinner style
- [ ] **Camera permission**: modal copy reads correctly (from
      `NSCameraUsageDescription`)
- [ ] **Photo library — full access**: pick photo for scan
- [ ] **Photo library — limited access** (iOS 14+): user picks "Selected
      Photos Only" → multi-select still works in `expo-image-picker`?
      This is the highest-risk iOS-specific issue.
- [ ] **Microphone permission**: requested before body-language
      recording
- [ ] **Body language record + analyze**: 6-second clip, audio
      transcript shows in result
- [ ] **Triage scan**: text + photo, result renders correctly
- [ ] **Postcard share**: tap Share → iOS share sheet appears →
      WhatsApp / Instagram → image renders WITHOUT the dark / washed-out
      issue (this is an Android view-shot bug; iOS uses
      `drawViewHierarchyInRect` which is more reliable)
- [ ] **Cat Studio poster**: generate works, image displays
- [ ] **Chat tab**: keyboard avoiding works, no input clipping
- [ ] **Push notifications**: schedule a test daily check-in reminder,
      verify it fires (requires APNs key set up via `eas credentials`)
- [ ] **Birthday banner**: set DOB to today, verify banner appears
- [ ] **Settings → Notifications**: toggles work
- [ ] **Settings → Forget me / Sign out**: works
- [ ] **Paywall email gate (NEW 2026-05-03)**: as anonymous user, tap
      Subscribe on paywall → should see info banner ("We'll ask for
      your email next…") → tap Subscribe again → routes to
      `/upgrade-account` (NOT to RC purchase sheet). Verify email →
      back to `/(main)`. Tap Subscribe AGAIN from any paywall entry
      → email gate passes → RC purchase sheet appears.
- [ ] **Cloud restore on email verification (NEW)**: install fresh,
      onboard with a cat, run a scan to create cloud data, verify
      email — uneventful (local data wins). Then: install on a SECOND
      device, sign in with same email at the upgrade-account screen
      — local stores should populate from cloud. (This currently
      requires same-platform reinstall; cross-platform restore is in
      Phase B per CLOUD-SYNC-AND-RESTORE-PLAN.md.)

iOS-specific risks:

- **`expo-image-picker` with limited library access** — multi-select might
  return only one photo even if user selected multiple. If broken, use
  `MediaLibrary` permission + `MediaLibrary.requestPermissionsAsync()`
  at app start to ask for full access (or fall back gracefully).
- **`KeyboardAvoidingView` on iOS** — chat tab uses
  `behavior: 'padding'`. Verify on iPhone with Dynamic Island that the
  input doesn't get covered.
- **`react-native-view-shot`** — should work better on iOS than Android
  (uses `drawViewHierarchyInRect`). The capture-render parity issues we
  fought on Android shouldn't reappear.
- **Status bar** — on iOS, `userInterfaceStyle: 'automatic'` follows
  system theme. Verify our colours read correctly in both light and
  dark modes.

---

## 8. Likely rejection patterns + mitigations

Apple App Store review is meaningfully stricter than Google Play. Known
risk areas for CatMD:

### 8a. "Is this a medical device?" (HIGHEST RISK)

**Why**: "Vet-grade triage" wording, scan results with urgency tiers,
red flags / follow-up questions. Apple has rejected pet-health apps
that imply diagnostic accuracy.

**Mitigation** (already in code, just verify it's prominent):
- App Store description has the disclaimer line ("Not a substitute for
  veterinary care") — verify it's NOT buried at the bottom. Move to
  paragraph 2 if needed.
- Triage scan-result screen has the "Not a substitute for veterinary
  care" footer — verify visible above the fold.
- Lead screenshots with Bond / lifestyle, NOT Triage.
- Set primary category to Lifestyle, not Health & Fitness.

If Apple rejects with this concern: respond with the disclaimer text
references + ask Apple specifically what additional language they
want. Usually they accept "AI-guided observation" framing once it's
clearly distinguished from medical advice.

### 8b. AI feature disclosure (Sept 2024 guidelines)

**Mitigation**: description has "Uses AI to interpret photos and
behaviour" line. App Review notes (§6f) — already updated — fully
discloses GPT-4o for vision/text, Whisper for audio, gpt-image-1
for Cat Studio artwork.

### 8b1. Cat Studio safety-retry — disclose explicitly

When testing Cat Studio in TestFlight, Apple reviewers may notice
the `cat_studio_safety_retried` event firing in PostHog (if they
inspect telemetry) or may see "first attempt rejected, retrying"
log lines in the Xcode console. This is a documented mechanic, NOT
an attempt to evade safety:

OpenAI's gpt-image-1 content moderator is known to false-positive
on cat-subject prompts that contain words like "fierce" / "battle"
/ "dystopian" — even when the subject is clearly a domestic cat in
a movie-poster homage style. To prevent dead-ends on legitimate
content, the app retries ONCE with a sanitised prompt (combat
words replaced with neutral alternatives). This is for the
"Princess Mewnonoke" / "Dragon Cat Z" / "Voltcat" / "Akiracat"
themes specifically — all clearly fan-art-style cat reimaginings
of family-friendly anime / movie franchises.

Reviewer-friendly framing if asked: *"We respect OpenAI's content
policy 100%. This retry handles known safety-moderator false-
positives on cat-subject content. The sanitised retry uses softer
language — it doesn't attempt to bypass real safety concerns. If
the retry also fails, the user sees a graceful error and is
prompted to pick a different theme."*

### 8c. Permissions strings too vague

**Mitigation**: existing `NSCameraUsageDescription`,
`NSPhotoLibraryUsageDescription`, `NSMicrophoneUsageDescription` are
specific and clear. Apple should accept them as-is.

### 8d. IAP / paywall (if RevenueCat is enabled)

If `EXPO_PUBLIC_ENABLE_PAYWALL=true` for production, the paywall screen
must include all four standard links:
- Terms of Use (link to `https://catmd.pet/terms`)
- Privacy Policy (link to `https://catmd.pet/privacy`)
- Restore Purchases (button)
- Subscription pricing clearly displayed before purchase

**Mitigation**: verify the paywall screen has all four. If paywall is
disabled for first release (`EXPO_PUBLIC_ENABLE_PAYWALL=false`), this
risk doesn't apply — but make sure no RevenueCat init code runs in
production.

### 8e. Push notification permission UX

Apple requires push permission requests to have a clear context. The
existing flow asks for permission only AFTER onboarding completes
(`onFinish` in `onboarding.tsx`), so user understands the value first.
**Verify this still fires correctly on iOS** — `expo-notifications`
`getPermissionsAsync` + `requestPermissionsAsync` works the same, but
the OS-level dialog text is fixed by Apple.

### 8f. Demo account quality

Apple reviewers test in 5–10 minutes. If first launch crashes or
onboarding fails, instant reject. **Test with a fresh install on
TestFlight** before submitting. Provide a pre-populated demo account
in App Review notes so reviewer doesn't hit the "add a cat" empty state.

---

## 9. Commands cheatsheet

```bash
# 1. iOS production build (first time prompts for cert generation)
cd /d/apps/catmd
npx --yes eas build --platform ios --profile production

# 2. Submit to App Store Connect (after build completes)
npx --yes eas submit --platform ios --latest

# 3. Push EAS Update to iOS preview channel (for OTA testing)
npx --yes eas update --branch preview --platform ios --message "iOS preview"

# 4. View build logs
npx --yes eas build:list --platform ios --limit 5

# 5. View Apple credentials managed by EAS
npx --yes eas credentials

# 6. Set up APNs key (interactive)
npx --yes eas credentials
# → choose iOS → Production → Push Notifications → Add new key

# 7. Test direct from local without TestFlight (simulator)
npx --yes expo run:ios
```

---

## 10. Open questions for the human

Things the next session should confirm with the user before submitting:

1. **Apple Developer account ownership** — individual or organization?
   Affects the listed seller name on App Store.
2. **Paywall enabled for first iOS release?** — `EXPO_PUBLIC_ENABLE_PAYWALL`
   currently `false` in eas.json production env. If enabling for iOS,
   need RevenueCat iOS configuration.
3. **App Store name availability** — the user should reserve "CatMD" in
   App Store Connect early; if taken, fall back to "CatMD: Cat Health"
   or similar.
4. **TestFlight beta testers list** — does the user want external
   beta testers (require beta review, ~24 hr) or only internal (instant,
   up to 100 internal testers)?

---

## 11. Keeping Android + iOS in sync going forward

Once iOS ships, both platforms run from the same source tree and
mostly stay in sync automatically thanks to EAS. The discipline rules:

### 11a. What's shared automatically

- **Source code** — one branch, one bundle, both platforms ship the
  same JS. EAS Update can target both with `--platform all`.
- **Runtime version** — `app.json` uses `runtimeVersion: { policy:
  "appVersion" }`. Bumping `version` (e.g. 0.1.6 → 0.1.7) creates a
  new runtime tier on BOTH platforms simultaneously. EAS Updates
  published to that runtime apply to both Android and iOS dev clients.
- **Listing copy** — `store-listing/store-listing-copy.md` is the
  single source of truth for description / keywords / disclaimer.
  Edit there, then re-paste in both consoles.
- **Screenshots** — same 8-screen Play Store curated set is the
  anchor; iOS just resizes them. Adding a new screen = update both.
- **Privacy disclosures** — same data types collected on both
  platforms, so the Play Data Safety form and App Store Privacy
  Nutrition Label answer the same way. Source: §6d in this doc.

### 11b. What needs platform-specific bumps

- **Build numbers** — `versionCode` (Android) and `buildNumber` (iOS)
  auto-increment INDEPENDENTLY in `eas.json` production profile.
  They're allowed to diverge (Android may be 38 while iOS is 4 — fine).
- **Production builds** — must be run for each platform separately:
  - `eas build --platform android --profile production` → AAB
  - `eas build --platform ios --profile production` → IPA
  - Or together: `eas build --platform all --profile production`
- **Submissions** — `eas submit --platform android` and
  `eas submit --platform ios` are separate commands.
- **Native dep upgrades** (e.g. bumping `expo-camera`) require
  rebuilding BOTH platforms — OTA updates can't ship native module
  changes.

### 11c. Recommended release cadence

For OTA-only changes (JS-only bug fixes, copy edits, prompt tweaks,
new screens that use existing native deps):

```bash
eas update --branch preview    --platform all --message "..."  # internal test
# verify on both platforms
eas update --branch production --platform all --message "..."  # ship
```

For changes that touch native deps OR new app permissions:

```bash
# Bump version in app.json (e.g. 0.1.6 → 0.1.7) — bumps runtime for both
eas build --platform all --profile production
eas submit --platform android --latest
eas submit --platform ios --latest
# Update Play Console + App Store Connect listings with new "What's new"
# from store-listing-copy.md release-notes section
```

### 11d. Platform-specific bug fixes

Some fixes are explicitly Android-only or iOS-only. Examples from
this codebase:

- **Android view-shot postcard issues** (dark exports, photos
  missing on capture) — pure Android `react-native-view-shot`
  quirks. iOS uses `drawViewHierarchyInRect` which doesn't have
  these issues. Fixing on Android only is fine; ship via OTA.
- **Date picker styles** — already split via `Platform.OS === 'ios'`
  in screens that need it. New date pickers should follow the same
  pattern.
- **Keyboard avoiding** — `KeyboardAvoidingView` behaves differently;
  existing screens use `Platform.OS === 'ios' ? 'padding' : 'height'`.

When a platform-specific fix lands, push to BOTH platforms anyway
(`--platform all`) — the iOS bundle just won't exercise the fixed
code path. Avoids accidentally letting Android drift ahead.

### 11e. Sync checkpoint at every release

Before promoting any preview-channel build to production, verify both
platforms in parallel:

- [ ] Android: `eas update --branch preview --platform android` →
      cold-kill Expo Go on Android phone → smoke-test
- [ ] iOS: `eas update --branch preview --platform ios` →
      cold-kill Expo Go on iOS phone → smoke-test
- [ ] Same flows tested on both: scan / postcard / body language /
      personality / pain check / chat
- [ ] Same `What's new` line in `store-listing-copy.md`

Only then promote to production.

### 11f. When platforms get out of sync — recovery

If you've shipped Android-only updates for a while (which is the
current state — iOS isn't released yet), the iOS preview channel
will be behind. Sync at submit time by:

1. Pushing the CURRENT main branch as a preview update with
   `--platform all` and verifying on both
2. Then running `eas build --platform ios --profile production`
3. Submitting from there

Future: don't let preview channels diverge across platforms by more
than a few days. Treat `eas update --platform all` as the default and
only use `--platform android` for genuinely Android-only fixes.

---

## 12. Pointers back

- For session-by-session deltas: `docs/SESSION-CHECKPOINT-2026-05-03.md`
  (most recent — §16-§20 cover the brand pivot + Cat Studio expansion +
  telemetry gaps + cloud-restore MVP) and earlier 05-02, 05-01
  checkpoints
- For Pro-only cloud backup architecture:
  `docs/CLOUD-SYNC-AND-RESTORE-PLAN.md` (Phase A shipped; Phase B
  documented for cross-platform restore + photos to Storage)
- For listing copy (shared with Play Store, already updated to
  "AI for cat owners"): `store-listing/store-listing-copy.md`
- For curated screenshots (also shared with Play Store):
  `store-listing/screenshots/curated/`
- For pricing / per-tier limit framework (revisit 2026-05-17 after
  14 days of `llm_usage` data):
  `docs/PRICING-AND-LIMITS-FRAMEWORK.md`
- For the catverse virality backlog (Cat Vlog, Cat Horoscope, Calm
  Cat ambient, etc.):
  `docs/CATVERSE-VIRALITY-PLAYBOOK.md`
- For Android build details: `docs/build-apk.md`
- For codebase architecture (pillars, services): start with the
  CHECKPOINT files in chronological order

End of iOS Setup Guide.
