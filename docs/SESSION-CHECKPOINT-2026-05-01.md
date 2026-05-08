# CatMD Session Checkpoint — 2026-05-01

> **Purpose**: durable record of decisions, in-flight work, and pending actions
> as of end-of-session 2026-05-01. Written so a fresh agent (or future-you)
> with zero context can pick up exactly where this session left off.

---

## 0. TL;DR

This session executed the **first true brand rebrand** of CatMD from "AI cat
triage" to "Your cat's MD" (the resident expert who knows your cat whole).
Final state at end of session:

- ✅ **Web (landing + library) — fully rebranded, twice-audited, deployed live.**
  Latest worker version `75a15e77-fd83-4aa3-93f1-1929f5a9f24e`.
- 🟡 **Personalisation — REVERTED to clean avatar pattern.** The duotone
  approach (cat photo at 35% opacity behind a sage→terracotta gradient
  at 55% opacity) failed in practice — the photo was unreadable through
  the saturated overlay, and the gradient itself read as a smudge.
  User feedback: *"no cat image.. something weird on background.. v wrong."*
  Replacement: a **clear circular cat-photo avatar** in the header
  (Today, Bond), with a friendly icon-fallback when no photo is set.
  Cat-birthday: large 220×220 circular hero photo, no overlay. The
  `<DuotoneCatHero>` component still exists in the repo but is no
  longer used. **Lesson logged:** photo-as-feature beats photo-buried.
  When in doubt, show the cat clearly; brand colour is the surrounding
  chrome, not a wash over the subject.
- ✅ **Personality Profile v1** — Bond pillar's second live feature.
  Algorithm + store + screen + 4-question quiz + Bond tile activation.
  See §3h.
- ✅ **Cat Diary v1 + all 5 deferred follow-ups in one go** — daily AI
  journal entries from cat's POV; Pro-tier 7-day archive gating; 1080×1920
  IG-story share-card export; seasonal/milestone special entries (streaks,
  holidays, post-emergency); LLM vision photo input; daily 7pm local-time
  reminder. See §3j.
- ✅ **Chat tab MVP** — fourth pillar from SOON to live. AI cat companion
  with per-cat CatContext + RAG against the 632-card corpus + 9-archetype
  voice tailoring + safety guardrails. See §3l.
- ✅ **Diary white-screen fix** — `react-native-view-shot` and
  `expo-sharing` lazy-loaded inside `onShare()`. Eager imports were
  crashing the route to a white screen when the native module didn't
  link cleanly. Screen now mounts even if native deps are missing;
  share button degrades gracefully. See §3m.
- ✅ **Triage + Read [cat] relevance gates** — user reported a garden
  photo got triaged as if it were cat content. Added a hard gate via
  `classifyPhotoFull()` that surfaces a third mode `'irrelevant'` with
  HIGH-confidence "other" detection. Both triage scan and Read [cat]
  refuse to analyse + show the model's reason. See §3n.
- ✅ **Analytics wired into all new modules** — typed event map now
  contains **45 events**. Latest pass added 6 missing funnel events:
  Read [cat] success path (`behavior_observation_started/completed/failed`),
  personality archetype reveal milestone, birthday screen + paywall,
  notification category toggle. Zero defined-but-unfired events. See §3k.
- 🟡 **AAB build #1422e017 IN FLIGHT** (versionCode 18). Bundles the
  relevance gates + the missing analytics events + everything from
  prior builds.
  - URL: https://expo.dev/accounts/amit1601/projects/catmd/builds/1422e017-7c4d-4a42-859e-9ae2fc100220
  - Previous shipped build was #7a42a08d (versionCode 17) — Cat Diary
    + Chat MVP + duotone revert.
- 📝 **Play Console mapping-file warning** — manual AAB upload skips the
  ProGuard/R8 mapping file; Play Console can't deobfuscate crash stack
  traces. Going forward, use `eas submit --platform android --latest`
  instead of manual upload — it auto-attaches `mapping.txt`. Warning is
  non-blocking. See §3o.
- ✅ **Overnight chapter — Chat handoffs + cards + articles + Zustand bug fix:**
  - `chat → triage / call_vet` action handoffs: assistant emits `[ACTION:OPEN_TRIAGE]` / `[ACTION:CALL_VET]` tokens in replies; service strips + surfaces structured `actions[]`; screen renders inline buttons under the assistant bubble. Sage button for "Open Triage scan", error-color button for "Find an emergency vet" (dials ASPCA poison control as fallback).
  - **+10 Phase-2 cards** (`cards_phase2_batch7.jsonl`): bunting/allorubbing distinction, wool-sucking + pica, tail-quivering vertical, cold-weather management, water-fountain preferences, baby+cat introduction, claw care + scratching post wear, breed personality (Tonkinese, Manx, Cornish Rex). **Live Supabase: 642 cards** (up from 632).
  - **+3 long-form library articles** deployed to https://catmd.pet/library:
    `cat-vocalizations-decoded`, `multi-cat-household-harmony`, `kitten-development-windows`. Library now at **20 articles**. Worker version `0056fa1c-d14b-43e0-a07d-9c4c5700d306`.
  - **Critical bugfix in build #19**: Zustand selectors `useDiaryEntriesForCat` / `useChatThread` / `useCatStudioPosters` were returning new array references every render, causing infinite re-render loops and the Cat Diary white-screen crash. Fixed via stable-reference pattern (subscribe to raw state + useMemo derive, OR module-level frozen empty constants).
  - **Streaming chat — deliberately NOT done.** Too risky for unattended overnight work; deferred to next attended session.

- 🟡 **Build chronology this session:**
  `#db7d013e` (cancelled) → `#1a178898` (versionCode 15) →
  `#94a7d504` (versionCode 16, duotone revert) →
  `#7a42a08d` (versionCode 17, Diary fix + Chat MVP) →
  `#1422e017` (versionCode 18, relevance gates + analytics) →
  **`#26f0fbf1` (versionCode 19, IN FLIGHT)** — Zustand infinite-loop
  fix + Cat Studio v1 + Onboarding refresh + Memory Book reordered.
  - URL: https://expo.dev/accounts/amit1601/projects/catmd/builds/26f0fbf1-98b7-4b09-827b-84e7958c2b9c
  predates Personality Profile, Cat Diary, and analytics wiring. A fresh
  build is required to ship those:
  `cd D:/apps/catmd && npx eas-cli build --platform android --profile production --non-interactive --no-wait`
- ❌ **App icon swap — ABANDONED.** User tried Sora v2 prompts; outputs
  still didn't beat existing icon. Decision: keep existing icon. Don't reopen.
- ✅ **Phase-2 batch6 shipped** — 10 new cards authored inline + embedded
  to Supabase. Manual Phase-2 corpus: 75 → 85 cards. Live Supabase:
  622 → 632 total (behavioral 52→56, personality 36→39, lifestyle 35→38).
  *(First attempt was a background agent — its sandbox blocked filesystem
  writes, so it stalled with content ready but unwritten. Foreground
  authoring succeeded. Lesson: the `general-purpose` background agent
  cannot write files in this configuration; use foreground or a different
  agent type for any task that needs disk access.)*

Triage tab also absorbed the entire Health hub this session ("Track" +
"Watch" sections inside Triage; the standalone Health hub Settings entry
is gone). Tab order reordered to **Today / Bond / Chat / Triage** so the
brand doesn't read as "triage app" the moment you open it.

---

## 1. Brand decisions LOCKED IN — do not re-litigate

| Decision | Locked-in value |
|---|---|
| **Name** | Stays **CatMD**. Don't rename. (User confirmed.) |
| **Positioning paragraph** | *"Your cat's MD — the resident expert who knows them whole."* |
| **Tagline** | *"Built for cats. Trained on cats. By cat people."* (unchanged) |
| **Four pillars** | **Today** · **Bond** · **Chat** · **Triage** *(in tab-bar order; Triage deliberately last so the brand doesn't read as "triage app" the moment you open it)* |
| **Pillar one-liners** | Today: *Know your cat day-to-day.* / Triage: *Catch what cats hide.* / Bond: *Read what they can't say.* / Chat: *Ask anything, anytime.* |
| **Palette anchors** | **Sage `#5B8A7A`** = medical / clinical / trust (Today, Triage, Watch monitors, Track). **Terracotta `#C97B63`** = relational / emotional (Bond, Chat, cat-birthday, personality, Read [cat]). **Cream `#FAF7F2`** = shared neutral. No third anchor. |
| **Surface mode rule** | Each screen explicitly uses either `t.primary*` (sage) or `t.secondary*` (terracotta) — not both, not a context swap. Manual but readable. |
| **Counts on copy** | Never hardcode card / article / source counts that grow. Use qualitative descriptors: *"extensive corpus"*, *"long-form vet-sourced articles"*. The `0` (diagnosis claims) and `10` (safety guardrails) on the landing stat-grid are stable enough to keep as numbers. |
| **Health hub naming retired** | The old "Health hub" no longer exists as a user-facing concept. Its features now live as **"Track"** (logging) and **"Watch"** (early-warning monitors) sections inside the **Triage** tab. |
| **Library structure** | 5 sections: Read your cat → Your cat's personality → The good cat life → Health & triage → By life-stage. |

---

## 2. Live production state (web)

**Cloudflare Worker**: `catmd-ai-proxy`
- **Latest deployed version**: `75a15e77-fd83-4aa3-93f1-1929f5a9f24e`
  (post-landing-audit; previous version `0c1f46ae` shipped the rebrand
  Round 2 structural changes; `2ad928c9` shipped Round 1 + library)
- **Domain**: https://catmd.pet/
- **Workers route**: also reachable at `catmd-ai-proxy.folio-app-2026.workers.dev`
- **Deploy command**: `cd D:/apps/catmd/proxy && npx wrangler deploy`
  - Wrangler is authenticated via OAuth as amit.raina@gmail.com
  - Account ID: `6bf5a9491ee878e9d00cb0377bbb3c7c`

**What's live, verified via curl spot-check**:

| URL | Status | Notes |
|---|---|---|
| `https://catmd.pet/` | 200 | New "Your cat's MD" hero, four-pillar band, Bond mockup, rebalanced floats, pillar-mapped How-it-works, reordered features grid |
| `https://catmd.pet/library` | 200 | 5-section structure, "Your cat's MD, in long form" hero, all 17 article cards rendering |
| `https://catmd.pet/library/cat-tail-language` | 200 + 39 KB hero | New launch article |
| `https://catmd.pet/library/cat-body-language-ears-whiskers-eyes` | 200 + 44 KB hero | New launch article |
| `https://catmd.pet/library/feline-five-personality-framework` | 200 + 44 KB hero | New launch article |
| `https://catmd.pet/library/five-pillars-happy-indoor-cat` | 200 + 74 KB hero | New launch article |
| `https://catmd.pet/library/senior-cat-care-after-age-10` | 200 + 56 KB hero | New launch article |

**Hero images**: all 17 article slugs have matching `.webp` at `/library/{slug}.webp`,
served from `D:/apps/catmd/proxy/public/library/`. The 5 new images were converted
from user-provided PNGs (image1–image5) via Pillow → 1200×630 WebP at quality 82.
Originals deleted post-conversion.

---

## 3. In-app changes — bundled into AAB build #1a178898

AAB build **#1a178898-757d-4e63-9452-078babf11998** (versionCode 15) is
in flight as of session end and bundles ALL of the work below. Previous
shipped build was `2ec965af` (versionCode ≤13) from before today.

Build cancelled and re-triggered once during the session — the first
trigger (`db7d013e`, versionCode 14) happened before personalization
landed; user caught it, build was cancelled, personalization shipped,
then re-triggered as #1a178898 (versionCode 15).

### 3a. Personalization — cat-photo duotone hero band (NEW component)
- `src/components/DuotoneCatHero.tsx` — new reusable component.
  - Renders cat's `photo_uri` blurred (radius 16) at 35% opacity, with a
    sage→terracotta linear gradient overlay at 55% opacity on top.
  - Three modes: fixed-height banner (Today / Bond) / `fullBleed` absolute
    fill / auto-fit content (Cat-birthday).
  - Three emphases: `balanced` (50/50), `sage` (sage-weighted), `terracotta`
    (terracotta-weighted).
  - Fallback: when no `photo_uri`, gradient-only over `surfaceSunken` —
    never an empty state, never a broken-image icon.
  - Uses `react-native-svg` `<LinearGradient>` (already in deps; no new
    package added) and built-in `<Image blurRadius>`.
- **Today** (`app/(main)/index.tsx`): 160 + safe-area-top hero with
  `balanced` emphasis. Cat name + gear icon overlay in cream
  (`textInverse`). Negative horizontal margin escapes the container's
  horizontal padding for full-bleed.
- **Bond** (`app/(main)/bond.tsx`): 170 + safe-area-top hero with
  `terracotta` emphasis (Bond is the relational/emotional pillar — gradient
  biased toward terracotta to signal mode shift from clinical to relational).
  "Bond" + tab description text in cream.
- **Cat-birthday** (`app/cat-birthday.tsx`): auto-fit hero with `terracotta`
  emphasis. Wraps the entire celebration block (cake badge, "Happy Birthday
  [name]", age, thank-you text). Album below sits on cream for photo
  clarity. The cake-badge backdrop changed from sage to a translucent
  cream so it pops on the duotone.

### 3b. Tab-bar reorder
- `app/(main)/_layout.tsx`: tab order changed from `Today / Triage / Bond / Chat`
  to `Today / Bond / Chat / Triage`. Putting Triage last de-emphasizes the
  triage-leaning brand read; user is in Today/Bond/Chat 95% of the time and
  reaches Triage on intent.
- Header docstring updated to explain the rationale.

### 3c. Palette + theme token system
- `src/theme/tokens.ts`: added `secondary100` rung (light + dark) so terracotta
  has the same six-rung ramp as primary. Documented usage rules inline.
- Mechanically swapped 23 token references `t.primaryX → t.secondaryX` across:
  - `app/(main)/bond.tsx` (3 swaps)
  - `app/behavior.tsx` — "Read [cat]" (11 swaps)
  - `app/cat-birthday.tsx` (9 swaps)
- `app/(main)/index.tsx`: Today birthday banner manually rewired to terracotta
  (`t.secondary100/500/700/900`).

### 3d. Health hub → Triage merge
- `app/(main)/triage.tsx`: rewritten. Now has Scan + Recent scans + **Track**
  section (8 rows: vaccinations, medications, weight, appointments, symptom
  timeline, food safety, vet PDF, article library) + **Watch** section
  (5 rows: SRR, pain check, CKD watch, thyroid watch, litter box) + Web
  library tile. The previous "Coming soon" placeholders are gone.
  - Subtitles for Vaccinations/Weight/Appointments are dynamic, pulled from
    `latestWeight`, `nextVaccineDue`, `nextAppointment` selectors in
    `healthStore.ts`.
- `app/settings.tsx`: deleted the "Health hub" Row + its preceding Divider.
  Removed `Stethoscope` import (was only used here).
- `app/health/index.tsx`: orphaned but kept in repo as a defensive deep-link
  target. Sub-routes `/health/vaccinations`, `/health/weight` etc. all still
  work and Triage rows navigate into them.
- Triage Web-library subtitle changed from `"12 vet-sourced articles"` to
  `"Long-form vet-sourced articles"` — kills the rebuild-on-every-article
  problem.

### 3e. Notification system follow-ups (from earlier in session)
- `src/services/notifications.ts`:
  - Quiet hours 22:00–08:00 enforced via `shiftOutOfQuietHours()` inside
    `scheduleOneTimeAt()`. Bypass flag exists for tests.
  - Daily-cap via `claimDailyPushSlot()` — at most 1 ad-hoc push per day from
    streak/insight categories. Daily reminders + annual reminders bypass.
  - New `setWeeklyReadNudge()` — fires 7 days post each behaviour observation
    at 19:00 local.
- `src/state/healthStore.ts`: behaviour-observation events now re-arm the
  weekly Read [cat] nudge.
- `app/cat-profile.tsx`: schedules an initial weekly_read_nudge on save when
  category is enabled and there's no existing scheduledId. Plus
  `confirmQuietHoursTime()` warn-with-override on the medication + check-in
  reminder time pickers.
- `app/settings.tsx`: added "Notifications" Section linking to
  `/notification-settings` (Bell icon, between "Your cats" and "Spread the
  word").

### 3f. JSX-text `\uXXXX` escape bug fixes
The literal strings `·`, `—`, `…` etc. were appearing visibly in
the UI because JSX text nodes / attribute values don't process JS escape
sequences. Fixed in 4 spots by replacing the literal escape strings with
actual UTF-8 chars (`·`, `—`, `…`):
- `app/settings.tsx:322` (the version footer — user reported)
- `app/upgrade-account.tsx:248` (footer paragraph)
- `app/health/food-safety.tsx:154` (search placeholder)
- `app/health/articles.tsx:102` (search placeholder)
JS string literals (inside Alert.alert, ternaries, template literals) were
left alone — escapes work correctly there.

### 3h. Personality Profile v1 (Bond pillar feature)

Built end-to-end this session — closes the second placeholder on Bond
("Personality Profile" tile flipped from SOON to live). Algorithm uses
the Litchfield Feline Five framework + the 39 personality cards already
in the corpus.

Files:
- `src/services/personality.ts` — pure-function algorithm: 5-trait
  vectors (skittishness / outgoingness / dominance / spontaneity /
  friendliness, 0-100 each), 9 archetype targets (Confident-Sociable,
  Curious-Introvert, Anxious-Sensitive, Hunter-Athlete, Affectionate-Lap,
  Velcro-Cat, Skittish-Sensitive, Cool-Observer, Goofball-Playful),
  16 breed priors (regex-matched against `cat.breed`), weighted layer
  aggregator (breed × 0.25 + quiz × 0.25 + checkins × 0.30 + obs × 0.20),
  Euclidean nearest-archetype matcher, confidence formula
- `src/state/personalityStore.ts` — Zustand + AsyncStorage cache for
  computed profiles + per-cat quiz answers; `recompute(catId)` re-runs
  the algorithm against current state
- `app/personality.tsx` — new `/personality` route. Two states: 4-question
  quiz (skippable) → archetype card + 5-trait bars + "what this means"
  body + transparency footer ("how we know" with input counts)
- `app/(main)/bond.tsx` — Personality Profile tile is now live with a
  three-state subtitle (empty / building / stable). NEW badge appears
  only when confidence ≥ 0.7
- `app/_layout.tsx` — registered `/personality` route

Build state at end of v1: free across the board. Pro gating deferred per
user direction. See §4f below for the deliberate-skip list to revisit.

### 3j. Cat Diary v1 (Bond pillar feature)

Built end-to-end this session, including all 5 originally-deferred
follow-ups in the same chapter (per user direction "dont leave anything
for future"). Closes the first placeholder on Bond — Cat Diary tile
flipped from SOON to live with today's entry preview as the subtitle.

**Files:**
- `src/services/diary.ts` — Pure functions:
  - `buildDayContext()` aggregates today's check-in / behaviour
    observations / weight / meds / scans / streak / birthday-or-iversary,
    plus computes streak-milestone (7/30/60/100/180/365), recent
    emergency-tier scan (last 36h), and 9 calendar special days
    (New Year, Valentine's, Christmas, Halloween, both equinoxes, both
    solstices, "first snow likely" mid-Nov)
  - `generateDiaryEntry()` builds system + user prompts (with cat
    metadata, archetype voice-hint, day's data, special-day directives),
    calls `completeJson` with strict JSON schema (`{entry, mood_word}`),
    attaches cat profile photo as `imageBase64` for vision (best-effort
    base64 read via `expo-file-system/legacy`)
  - Voice rules baked into system prompt: first-person, 4-7 sentences,
    NEVER baby-talk / "uwu" / lol-cat. Per-archetype voice hints ("you
    weigh things", "you find amusement in small disorders") routed
    automatically when personality store has stable profile.
- `src/state/diaryStore.ts` — Zustand + AsyncStorage. Caches by
  `${catId}:YYYY-MM-DD`. Idempotent `generateForToday(catId, {force?})`.
  Auto-prunes to last 365 entries per cat. Local copy of
  `countCheckinStreak`. Fires `diary_entry_generated` /
  `diary_entry_generation_failed` analytics with full prompt-context
  props.
- `app/diary.tsx` — `/diary` route. Auto-generates today's entry on
  mount; spinner while generating; warning + retry on failure. Hero
  card terracotta-themed, body in Source Serif 4. Below: archive list
  (cards expandable on tap). Rewrite + Share buttons under hero.
  Pro-gating: free sees today + 7 archive entries; Pro sees full
  archive. "Unlock the full archive" tile when `hiddenCount > 0`,
  routes to `/paywall?source=diary_archive`. Schedules daily 7pm
  reminder on mount (idempotent re-arm).
- `src/components/DiaryShareCard.tsx` — Off-screen 1080×1920 (IG-story)
  render target. Cat photo + sage→terracotta gradient overlay + entry
  text in serif on translucent cream card + "CatMD · catmd.pet"
  brand mark. Mounted only while a share is in flight (top: -99999,
  collapsable=false), captured by `react-native-view-shot`'s
  `captureRef`, shared via `expo-sharing`. Two-frame wait between
  mount + capture so layout completes before tree-walk.
- `app/_layout.tsx` — Registered `/diary` route.
- `src/services/notifications.ts` — New `setDailyDiaryReminder()` —
  `scheduleDailyAt({hour: 19, minute: 0, ...})`. Expo's daily trigger
  uses local device time, so the user gets pinged at 7pm wherever they
  are (timezone-aware automatically).
- `src/state/notifPrefsStore.ts` — New `diary_entry` notification
  category, default ON.
- `app/notification-settings.tsx` — Toggle row added (NotePencil icon,
  "Cat Diary — Daily at 7pm. Your cat has thoughts about today.").
- `app/(main)/bond.tsx` — Cat Diary tile flipped from SOON to live.
  Subtitle: today's entry preview truncated to ~110 chars at word
  boundary if cached; CTA copy otherwise. NEW badge once an entry exists.
- `package.json` — Added `react-native-view-shot 4.0.3` (for the
  share-card capture). 0 other dep changes.

**Cost / latency**: gpt-4o-mini, ~500 tokens output, temperature 0.85
(high for voice variation). ~$0.0003 per entry, ~2-4s typical latency.
Aggressive cache: don't regenerate same date unless user taps Rewrite.

### 3k. Analytics wiring across new modules

The typed `AnalyticsEvent` map in `src/services/analytics.ts` was
extended in two passes this session. **Final state: 45 events total,
zero defined-but-unfired** (audit performed at end-of-session).

**Pass 1 — initial Personality + Diary wiring (11 events):**

Personality Profile (4):
- `personality_quiz_started` — quiz UI shown for a cat
- `personality_quiz_completed` — finished or skipped (props record which)
- `personality_profile_viewed` — archetype rendered; props include
  archetype, confidence_band, confidence_pct, and which input layers
  contributed (breed prior, quiz, checkin_count, behavior_obs_count)
- `personality_profile_refreshed` — manual recompute tap

Cat Diary (7):
- `diary_opened` — props: had_today_cached
- `diary_entry_generated` — fired from inside `diaryStore.generateForToday`
  with full prompt-context props (is_birthday, is_adoption_iversary,
  streak_milestone, recent_emergency_scan, special_day, had_photo,
  had_archetype, forced_rewrite). This is the funnel we'll mine to tune
  which special-day prompts produce shareable entries.
- `diary_entry_generation_failed` — props: reason (truncated 200 chars), forced_rewrite
- `diary_entry_rewrote` — user tapped Rewrite
- `diary_entry_shared` — capture + share both succeeded; props: is_today
- `diary_share_failed` — capture or share threw
- `diary_reminder_scheduled` — 7pm reminder armed; props: changed

**Pass 2 — Chat MVP + relevance gates + missing-funnel audit (11 more):**

Chat (5):
- `chat_opened` — props: had_history
- `chat_message_sent` — length, used_suggested_prompt
- `chat_message_received`
- `chat_message_failed` — reason
- `chat_cleared`

Relevance gates (2):
- `scan_rejected_irrelevant_photo` — kind, reason
- `behavior_rejected_no_cat` — reason

Missing funnel audit added (6):
- `behavior_observation_started` — source ('camera' | 'library')
- `behavior_observation_completed` — frame_count, had_audio, tag_count,
  top_tags (top 3 comma-joined), observation_length. **This was the
  biggest single gap — the entire Read [cat] success path had no
  telemetry; only the no-cat-detected failure was tracked.**
- `behavior_observation_failed` — reason
- `personality_archetype_revealed` — archetype, days_to_reveal. Fires
  EXACTLY ONCE per cat, in `personalityStore.recompute()`, when
  confidence first crosses the 0.7 threshold. Subsequent recomputes
  don't re-fire because the previous-confidence comparison guards it.
- `birthday_screen_opened` — is_pro, album_size. Fires once per cat
  per mount via a `useRef` guard, after albumPhotos useMemo settles.
- `birthday_album_paywall_tapped` — pre-navigation tap on the
  upgrade CTA from the cat-birthday screen.
- `notification_category_toggled` — category, enabled. Every flip in
  `/notification-settings`. Per-category opt-in/out signal.

**Existing events extended:**
- `paywall_viewed.source` enum gained `'diary_archive'` and
  `'birthday_album'` so the two new upgrade CTAs share the existing
  paywall funnel infra.

All `track()` calls are fire-and-forget (the analytics service
soft-fails when SDK isn't loaded / disabled / no key). PostHog flushes
at 5 events or 30 seconds, whichever first. No PII attached.

**Audit method (re-runnable):**
```python
import re, os
fired = set()
for root, _, files in os.walk('.'):
    if 'node_modules' in root: continue
    for fn in files:
        if not (fn.endswith('.tsx') or fn.endswith('.ts')): continue
        p = os.path.join(root, fn)
        if 'analytics.ts' in p: continue
        with open(p, 'r', encoding='utf-8') as f: src = f.read()
        for m in re.finditer(r"track\(\s*\{?[^}]*?type:\s*'([^']+)'", src, re.S):
            fired.add(m.group(1))
with open('src/services/analytics.ts','r',encoding='utf-8') as f:
    defs = set(re.findall(r"type:\s*'([^']+)'", f.read()))
print('UNFIRED:', sorted(defs - fired))
```
Re-run any time you want to confirm coverage.

### 3l. Chat tab MVP (Chat pillar — closes the fourth pillar)

Replaces the SOON placeholder on the Chat tab with a working AI cat
companion. ~700 lines, 0 new dependencies (reuses existing AI client +
RAG + CatContext).

**Files:**
- `src/ai/client.ts` (extended) — new `completeText({system, messages})`
  for plain-text chat completions. Multi-turn message array. Optional
  vision attachment to last user turn.
- `src/services/chat.ts` — orchestrator. Per user message: build
  CatContext (14d window) → embed message → RAG top-6 cards (min
  confidence 0.5) → inject into system prompt → `completeText` with
  full history → return `{reply, citedCards}`. Voice rules baked in:
  knowledgeable cat-care companion, never diagnoses, defers symptoms
  to Triage, calls out genuine emergencies explicitly. Personality
  archetype voice hint when stable.
- `src/state/chatStore.ts` — Zustand + AsyncStorage. Per-cat thread
  (single conversation). Cap: 60 visible turns (older pruned at write
  time), 14 sent to LLM as context. `sendMessage(catId, text)` async,
  `clearForCat` for new conversation.
- `app/(main)/chat.tsx` — real UI. Header with cat avatar + clear
  button. Empty state shows 4 cat-aware suggested prompts. Bubbles
  (user right primary500, assistant left surfaceElevated). Citations
  under assistant turns ("From: Tail-tip twitch · Allogrooming").
  Typing indicator: "Looking that up about Lily…" Footer: "AI
  companion — never diagnoses. For symptoms, run a Triage scan."
- 5 analytics events: `chat_opened`, `chat_message_sent`,
  `chat_message_received`, `chat_message_failed`, `chat_cleared`.

**Cost:** ~$0.0005 per turn. Latency ~2-4s. No streaming yet — typing
indicator is the placeholder; streaming is v2 polish.

### 3m. Diary white-screen crash fix

User reported: tapping Cat Diary tile → page turns white → app hangs.

**Root cause (most likely):** `react-native-view-shot`'s native module
was added mid-development for the share-card export. The eager import
at the top of `app/diary.tsx` crashed the whole route module if the
native side hadn't linked cleanly in the AAB build pipeline. Module
load failure on a route → white screen.

**Fix:**
- Removed eager `import ViewShot, { captureRef } from 'react-native-view-shot'`
- Removed eager `import * as Sharing from 'expo-sharing'`
- Both are now lazy-loaded *inside* `onShare()` via dynamic `import()`,
  with try/catch that surfaces a friendly "Sharing not available on
  this build" if the load fails
- Replaced `<ViewShot>` wrapper with a plain `<View>` (captureRef
  accepts any View ref); `collapsable={false}` so the off-screen view
  isn't optimised away by the native renderer
- Net: screen always mounts. Share button degrades gracefully if
  native deps are broken. captureRef + Sharing are loaded the moment
  Share is tapped, not at module-load.

**Lesson logged:** Any newly-added native dep should be lazy-loaded at
the call site, not eager-imported at the top of a route file. Module
load is a hard failure that takes the entire route down; lazy-load
turns it into a recoverable per-feature failure.

### 3n. Triage + Read [cat] relevance gates

User-reported feedback: someone uploaded a photo of their garden in
triage and the AI confidently produced a triage assessment based on
nothing. Trust-eroding.

**Fix in `src/ai/classify.ts`:**
- Renamed return to `ClassifyResult { mode, kind, confidence, reason }`
- New `mode = 'irrelevant'` when classifier reports `kind: 'other'`
  with HIGH confidence
- System prompt explicitly tells the model to err toward "cat present"
  on ambiguous photos — over-rejecting a real cat photo is worse than
  letting an ambiguous one through
- Decision rule pulled into pure function `deriveMode(kind, confidence)`
  for testability
- Backward-compat `classifyPhoto()` retained (folds 'irrelevant' to
  'general' for legacy callers); new code uses `classifyPhotoFull()`

**Triage gate in `app/scan.tsx`:**
- Calls `classifyPhotoFull` first
- If `mode === 'irrelevant'`, blocks the triage LLM call entirely
- Surfaces the model's reason inline: *"That photo doesn't look
  cat-related — appears to be a garden with potted plants. Remove the
  photo (or attach a cat / litter-box photo) and try again."*
- Fires `scan_rejected_irrelevant_photo` analytics with `kind` + reason

**Read [cat] gate in `src/services/behaviorObservation.ts`:**
- New `NoCatDetectedError` exception class
- `assertCatInFrames(frames)` runs `classifyPhotoFull` on the FIRST
  frame (cheap — one call vs N frames; if cat is in clip at all it's
  almost always in frame 1)
- Both `analyzeBehavior()` and `analyzeBehaviorWithContext()` call it
  before the main vision call
- `app/behavior.tsx` `handleError` has a specific path: *"We couldn't
  see Lily in this clip — appears to be a lawn. Record again with Lily
  clearly in frame."* + fires `behavior_rejected_no_cat`

**Soft-fail open:** if the classifier itself errors, both flows
default to `'general'` / let through. Better to allow than to lock
out the user on a transient AI / network blip.

### 3o. Play Console submit-flow learning

User uploaded build #7a42a08d manually to Play Console and got the
warning: *"There is no deobfuscation file associated with this App
Bundle."* Non-blocking — upload succeeded. But it means R8-obfuscated
crash stack traces won't deobfuscate cleanly in Play Console.

**Going-forward fix:** use `eas submit --platform android --latest`
instead of manual AAB upload. EAS auto-attaches the `mapping.txt`
ProGuard file generated during the build, so Play Console gets both
artefacts together and the warning never appears.

`eas.json` already has the production submit config:
```
"production": { "android": { "track": "internal", "releaseStatus": "draft" } }
```

So no config changes needed — just substitute `eas submit` for the
manual upload step from the next build onward.

### 3i. Phase-2 knowledge cards
- `cards_phase2_batch5.jsonl` — 15 cards (6 behaviour + 5 lifestyle + 4
  personality breeds: Sphynx, BSH, Russian Blue, Scottish Fold).
- `cards_phase2_batch6.jsonl` — 10 cards added at session end:
  - **Personality (3)**: Burmese, Birman, Devon Rex
  - **Behavior (4)**: flehmen response, redirected aggression,
    petting-induced aggression, the feline vocal repertoire
  - **Lifestyle (3)**: dental brushing protocol + alternatives,
    dog-cat coexistence, moving house with cats (the 2-week protocol)
- All 85 manual Phase-2 cards (across 6 batch files) embedded + upserted
  to Supabase via `embed_and_load.py`.
- **Live Supabase corpus**: **632 cards total** (Phase-1 medical ~547 +
  Phase-2 manual 85). By Phase-2 category: behavioral 56, personality 39,
  lifestyle 38.
- This change does NOT need an AAB rebuild — Triage RAG queries Supabase
  directly. Already affecting live scans.

---

## 4. Pending / next chapters

### 4a. ~~Personalization~~ → SHIPPED in build #1a178898 (versionCode 15)

**Status**: ✅ done. See §3a for component spec + §6 for usage notes.

Original spec preserved below for reference / future iteration.

**Spec** (from earlier in session, user agreed):

- Surfaces that get the personalization:
  - Today (top ~140-180px hero band)
  - Bond (top ~140-180px hero band, terracotta-skewed)
  - Cat-birthday (full-bleed hero, no other content competing)
- Surfaces that explicitly DO NOT get it:
  - Triage / scan flow / Watch monitors / Settings / Chat / cat-profile editor — clinical clarity beats decoration
- Treatment specifics:
  - Source: `cat.photo_uri`
  - Render: `<ImageBackground>` with blur radius ~14–20px, opacity ~25–35%
  - Overlay: sage→terracotta linear gradient at ~50% opacity
  - Below the hero: cards/content sit on cream as today, no further imagery
  - **Fallback** (no photo set): soft sage→terracotta gradient with optional
    cat-silhouette texture. NEVER an empty state or broken-image icon.
- Why duotone, not raw photo:
  1. Hides photo-quality issues (lighting, blur, off-angle, busy background)
  2. Brand-tints regardless of cat's coat color (ginger and black cats both
     produce a recognizable CatMD-branded hero)
  3. Textural presence rather than photographic — feels designed

**Implementation plan when picked up**:
1. New reusable component: `src/components/DuotoneCatHero.tsx`
2. Apply on `app/(main)/index.tsx` (Today) — top hero band
3. Apply on `app/(main)/bond.tsx` — top hero band
4. Apply on `app/cat-birthday.tsx` — full-bleed
5. Test with: Pro user with photo, Pro user without photo, free user, multi-cat

### 4b. ~~AAB rebuild~~ → IN FLIGHT as build #1a178898

**Status**: 🟡 triggered, ~15-25 min to artifact.

- Build URL: https://expo.dev/accounts/amit1601/projects/catmd/builds/1a178898-757d-4e63-9452-078babf11998
- versionCode: 15 (auto-bumped from 14, which was the cancelled build #db7d013e)
- Profile: `production` → AAB, channel `production`, paywall=false, analytics=true
- Bundles every §3 in-app change (3a personalization, 3b tab reorder, 3c palette,
  3d Health hub → Triage merge, 3e notifications, 3f JSX-text fixes).
- Next time, run: `cd D:/apps/catmd && npx eas-cli build --platform android --profile production --non-interactive --no-wait`

### 4c. App icon swap — ABANDONED (2026-05-01)

User tried the v2 Sora prompts; outputs still didn't beat the existing icon
("sadder than existing one"). **Decision: keep the existing icon.** Don't
reopen this thread unless user revisits. Keep the existing `app.json` icon
config untouched.

### 4f. Personality Profile — deliberate skips for follow-up

These were intentionally omitted from v1 to keep the build tight. All
hooks/extension points are isolated in the existing files — re-opening
this work shouldn't require rewrites.

**Pro-tier features (decision deferred per user — "discuss that later"):**
1. **Cat-cat compatibility** — for multi-cat households. Compute pairwise
   archetype-distance + activity-level / dominance compatibility; render
   a "compatibility score + likely friction points" card. Source material
   for the rules is in `cards_phase2_strategic.jsonl` (multi-cat dynamics)
   + `cards_phase2_manual.jsonl` (N+1 litter rule, vertical territory).
2. **Cat-owner compatibility quiz** — owner takes a parallel 6-8 question
   self-assessment, system maps owner archetype, outputs a compatibility
   score + practical implications. Highest viral-share potential of any
   Pro feature in the roadmap.
3. **Drift over time** — cache profile snapshots weekly, render a
   small "How [name] has changed over the last 90 days" chart. Some
   apparent personality drift is actually data-density improvement (more
   inputs → tighter measurement); some is real (medical conditions can
   shift baseline). Worth its own UX care.
4. **Share-card export** — Instagram-story-format 1080×1920 image.
   Cat photo + archetype + trait bars + "Built with CatMD · catmd.pet"
   footer. Needs `react-native-view-shot` dep (~30 KB add).

**Engine improvements:**
5. **Auto-recompute on health-event triggers** — currently recomputes on
   personality screen mount + Bond tab mount. A 5-line addition in
   `healthStore.addEvent` could trigger recompute after every check-in /
   behaviour observation. Fast + idempotent so cost is trivial; UX
   benefit is the Bond tile subtitle stays fresh without a tab visit.
6. **Confidence-aware NEW badge animation** — when confidence crosses the
   0.7 threshold for the first time, a subtle "your archetype is in"
   moment (haptic + reveal). Right now the tile silently flips state.
7. **Onboarding personality nudge** — subtle prompt during onboarding to
   "take 4 questions about [name]" so the profile is seeded day-1.
   Not aggressive — single CTA, clearly skippable. We agreed quiz
   stays at first-Bond-tap, but a soft nudge in onboarding could
   capture engaged users earlier without adding friction.
8. **Refined breed priors** — current 16 breeds. Could add 10+ more
   from cards we authored later (Burmese, Birman, Devon Rex from
   batch6 — already in BREED_PRIORS; plus Tonkinese, Manx, Oriental
   Shorthair, Cornish Rex, etc. as we author those cards).

### 4d. Landing audit — second-pass corrections (DONE, deployed)

User flagged two more triage-leaning items on the live landing AFTER the
Round 2 deploy. Both fixed in worker version `75a15e77`:

1. **Hero meta line** — was `Triage only, not a diagnosis · No vet
   relationship implied · Anonymous by default`. Replaced with
   `Cat-only by design · Four pillars, one app · Private by default`.
   The privacy promise survives (real differentiator); the legalistic
   triage disclaimers are gone (they belong in /disclaimer, not the hero).

2. **Trust strip** — was 5/7 medical sources (Merck, Cornell, AAFP, ISFM,
   ASPCA Poison Control). Rebalanced to 2/7 medical + 5/7 covering
   welfare / behaviour / lifestyle / personality / ethology:
   - Cornell Feline Health Center · Merck Veterinary Manual *(medical)*
   - AAFP & ISFM Cat-Friendly Practice *(welfare bridge)*
   - Pam Johnson-Bennett *(behaviour — Cat Behavior Associates)*
   - Jackson Galaxy *(environmental design / lifestyle)*
   - Bradshaw & Turner Ethology *(scientific ethology)*
   - Litchfield Feline Five *(personality science)*
   - Dropped: ASPCA Poison Control (too narrowly clinical for the hero
     trust-strip; can stay as a citation inside specific articles).

### 4e. Background / lower priority

- **Background card-author agent stalled** — spawned mid-session targeting
  30+ new Phase-2 cards into `cards_phase2_batch6.jsonl`. Stream watchdog
  hit 600s timeout right as the agent was about to write the file. Existing
  75 manual + Phase-1 = 622 cards in Supabase remain unaffected. To retry:
  spawn with **tighter scope** (10 cards at a time, not 30+) so the agent
  finishes in well under the watchdog window. See agent prompt at the end
  of session transcript for the gap-analysis (which breeds, behaviours,
  lifestyle topics still uncovered).
- **More long-form articles** — 5 launched today. Could add 2-3 more per
  section. Source material: 75 manual Phase-2 cards in
  `knowledge-pipeline/data/cards_phase2_*.jsonl`. Roughly 2 hours per
  article (1500 words + FAQs + schema + alt text).
- **OG image for landing page itself** — currently uses default. Worth a
  dedicated 1200×630 hero for social shares of `https://catmd.pet/` root.
- **Verify build #1a178898 artifact** — once EAS finishes the build, check
  for any runtime crashes specifically around the new `<DuotoneCatHero>`
  component. The blur + SVG gradient combination is platform-tested
  (Android Skia engine handles both fine), but worth a clean install
  verification on a real device.

---

## 5. Key file paths (catalog)

### App (React Native + Expo)
- `app/_layout.tsx` — root stack
- `app/(main)/_layout.tsx` — Tabs (Today / Triage / Bond / Chat); has Android
  edge-to-edge safe-area fix
- `app/(main)/index.tsx` — **Today** dashboard (birthday banner now terracotta)
- `app/(main)/triage.tsx` — **Triage** + Track + Watch sections (newly merged)
- `app/(main)/bond.tsx` — **Bond** tab (terracotta-themed)
- `app/(main)/chat.tsx` — **Chat** tab
- `app/behavior.tsx` — Read [cat] body-language reader (terracotta)
- `app/cat-profile.tsx` — Cat profile editor (with quiet-hours guard on reminder UI)
- `app/cat-birthday.tsx` — Pro birthday album (terracotta)
- `app/notification-settings.tsx` — per-category toggles
- `app/settings.tsx` — Account/Data/Legal (Health hub Row removed)
- `app/health/*.tsx` — sub-routes still exist; Triage navigates into them

### App services & state
- `src/services/notifications.ts` — Expo wrapper, quiet hours, daily cap, all category fires
- `src/state/healthStore.ts` — health events, streak counter, post-checkin triggers, behaviour-obs nudge re-arm
- `src/state/notifPrefsStore.ts` — per-category enabled flags + scheduledIds map
- `src/state/catStore.ts` — cat profiles, age derivation from DOB
- `src/state/scanStore.ts` — triage scan history
- `src/services/sync.ts` — Supabase round-trip
- `src/theme/tokens.ts` — design tokens (sage primary + terracotta secondary)

### Web (Cloudflare Worker)
- `proxy/worker.ts` — main worker entry
- `proxy/landing.ts` — landing page HTML (heavily rebranded today)
- `proxy/library.ts` — library hub + 17 article bodies (5 sections, 5 new launch articles)
- `proxy/legal.ts` — terms/privacy/disclaimer
- `proxy/wrangler.toml` — worker config; static assets in `./public`
- `proxy/public/library/{slug}.webp` — 17 hero images (1200×630)

### Knowledge pipeline (Python)
- `knowledge-pipeline/src/embed_and_load.py` — embed + Supabase upsert
- `knowledge-pipeline/src/enumerate_topics.py` — topic enumeration with
  Phase 1/2 categories
- `knowledge-pipeline/src/extract_cards.py` — LLM extraction
- `knowledge-pipeline/data/cards_phase2_*.jsonl` — manual Phase-2 batches
  (manual + strategic + batch3 + batch4 + batch5 = 75 unique cards)
- `knowledge-pipeline/data/cards_phase2_all_manual.jsonl` — combined dedupe
- `knowledge-pipeline/.env` — OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY all set
- Re-run embed: `cd knowledge-pipeline && python -c "import asyncio; from src.embed_and_load import run; from pathlib import Path; asyncio.run(run(Path('data/cards_phase2_all_manual.jsonl')))"`

---

## 6. Specs & handoffs (paste-ready)

### Hero image generator prompts (already used for 5 launch articles)

Shared style preamble:
> *Photorealistic photograph, warm natural afternoon light, soft and golden
> but not harsh. Color palette dominated by cream/beige (#FAF7F2) backgrounds
> with sage green (#5B8A7A) accents and warm terracotta (#C97B63) highlights.
> 1200×630 wide horizontal aspect ratio (1.9:1, Open Graph hero size).
> Editorial premium feel — like a Kinfolk magazine article on cat care, not
> a stock photo. Negative space on one side for potential text overlay. NO
> text in the image. NO cartoon style. NO harsh shadows or studio lighting.
> NO multiple cats unless specified. NO cluttered backgrounds.*

Per-article prompts: see the prior conversation message ("The 5 prompts" section).
Saved to `proxy/public/library/{slug}.webp` already.

### Personalization hero specifics

When implementing §4a:
- **Image filter chain**: blur ~14-20px, opacity 0.25-0.35, then a `LinearGradient`
  overlay (`sage #5B8A7A` → `terracotta #C97B63`) at ~0.5 opacity
- **Library on RN**: `expo-linear-gradient` for the overlay,
  `react-native`'s `<ImageBackground>` for the photo (already in deps)
- **Heights**:
  - Today: 140-180px depending on safe-area-top
  - Bond: 140-180px
  - Birthday: full-bleed (the entire screen above content)
- **Fallback**: if `cat.photo_uri` is null/undefined, render just the gradient.
  Optionally add an `<Image>` of a faint cat-silhouette SVG for texture.

---

## 7. Decision log (so future-you doesn't re-litigate)

| Decision | Reasoning |
|---|---|
| Keep CatMD name | Brand equity in name + .pet domain + library SEO already accruing. Repositioning the *meaning* of "MD" (medical + demeanour + daily) is cheaper than a 9–12 month brand decay window. |
| Two-anchor palette over single warmer | Two-anchor lets surfaces self-identify (sage = clinical, terracotta = relational) without users reading anything. Headspace/Calm pattern. Single warmer would lose the medical-trust signal sage carries. |
| Move pillar band UP after trust strip | Original placement inside features section meant visitors saw "Cats hide illness" (triage-only problem cards) before any pillar narrative. Moving it up reorders the brand story above the medical story. |
| Reframe problem section to 4 pillars | Old: 4 triage cards (48h urethral, just been quiet, silent kidney, feline-only). New: 4 pillar-mapped cards (mask emotion → Bond, hide illness → Triage, individuals → Personality, need design → Lifestyle). Same selling power, full brand range. |
| Mockup leads with Bond, not Triage | Bond/Read [cat] is the most differentiated capability — no competitor reads body language from 6-second video. Showing Triage in the hero made us look like "another symptom checker." Now Triage is one floating callout. |
| Don't author breed-by-breed personality articles yet | We have ~10 breed-personality cards in Phase-2 corpus but the launch breadth was prioritized over depth. Add depth in batches when traffic data shows which breeds people actually search for. |
| Health hub merged into Triage | Settings is for account/data/legal, not clinical workflow. Same urgency mindset brings owners to triage and to log a vaccination. Three verbs (Scan / Track / Watch) form a coherent Triage tab. Sub-routes `/health/*` kept since they're complete and tested. |
| Quiet hours: shift one-shot, warn-with-override on user-set | One-shot pushes (streak/insight/birthday/nudge) silently shift into 8am+ window because the user never picked the time — silent shift is OK there. User-set recurring reminders (medication, daily check-in) get a warn dialog because silent shifting would mismatch what they see in the picker UI. Override allowed for legitimate cases (early-morning thyroid meds). |
| 5 launch articles, not 4 or 10 | 4 was the minimum for one-per-new-section. 10 would have stretched the work over multiple sessions. 5 gives Read your cat two articles (highest SEO interest) and one each for the other 3 new sections. |
| Convert PNGs server-side, not via online tool | Pillow was already available via Anaconda. cwebp/magick were not installed. Pillow with `quality=82, method=6` produced 38–74 KB files — comparable to existing hero images (30–100 KB). |
| Don't put corpus counts in copy | Corpus grows; copy doesn't auto-update; every count change forces an AAB rebuild for in-app or a worker deploy for web. Qualitative phrasing ("extensive corpus", "long-form vet-sourced") is evergreen. |

---

## 8. Knowledge corpus state

- **Live Supabase**: 632 cards
  - Phase-1 medical: ~547 (from earlier sessions)
  - Phase-2 manual: 85 cards across 6 batch files
    - `cards_phase2_manual.jsonl` (20)
    - `cards_phase2_strategic.jsonl` (10)
    - `cards_phase2_batch3.jsonl` (15)
    - `cards_phase2_batch4.jsonl` (15)
    - `cards_phase2_batch5.jsonl` (15)
    - `cards_phase2_batch6.jsonl` (10) — Burmese, Birman, Devon Rex,
      flehmen, redirected aggression, petting-induced aggression, vocal
      repertoire, dental brushing, dog-cat coexistence, moving protocol
  - **By Phase-2 category**: 56 behavioral, 39 personality, 38 lifestyle (some are Phase-1 too)
- **Embeddings**: text-embedding-3-small (1536-dim)
- **Index**: pgvector on `public.knowledge_cards`
- **Idempotent upsert**: on conflict by `topic`. Re-running `embed_and_load.py`
  is safe.

### Still-uncovered topics (for future batches)
- **Personality breeds** still missing: Cornish Rex, Tonkinese, Manx,
  Oriental Shorthair, Turkish Angora, Japanese Bobtail, Savannah, American
  Shorthair, Egyptian Mau, Chartreux, Snowshoe, Munchkin (~12 breeds).
- **Behavior** still missing: bunting vs allorubbing distinction, wool-
  sucking, pica, tail-quivering vertical (mid-marking), nape-biting,
  territorial spraying vs urine-marking, "made you look" stare-aside
  displacement, nighttime activity bursts, imminent-attack cues, purring
  as self-soothing.
- **Lifestyle** still missing: cold-weather management, water fountain
  preferences, cat-safe pest control, baby + cat introduction, boarding
  vs cat-sitter, holiday absence planning, claw care + trim cadence,
  choosing a feline-friendly vet, pet insurance considerations,
  end-of-life decision framework.

---

## 9. Pre-flight checks before AAB build

When ready to build, verify:

1. ✅ `app.json` icon + splash files match the chosen Sora output (if icon swap is in scope)
2. ✅ `eas.json` production profile is current
3. ✅ Test on a clean device — palette swap on Bond surfaces should be visibly terracotta, sage-side surfaces unchanged
4. ✅ Birthday banner (Today) renders terracotta when `cat.dob_iso` MM-DD == today
5. ✅ JSX-text `\uXXXX` fixes — settings footer should now read "CatMD v0.1 · Informational only — not veterinary advice." with proper symbols
6. ✅ Triage tab shows Track + Watch sections (not "Coming soon" placeholders)
7. ✅ Settings → Notifications row navigates to `/notification-settings`
8. ✅ Settings → no longer shows a "Health hub" row
9. ✅ TypeScript: `npx tsc --noEmit` passes from project root
10. ✅ Knowledge corpus: `python knowledge-pipeline/scripts/validate_corpus.py` passes (if using that gate)

Build commands:
```
# preview APK (test build)
cd D:/apps/catmd && eas build --platform android --profile preview

# production AAB (upload to Play)
cd D:/apps/catmd && eas build --platform android --profile production
```

---

## 10. Open questions / things future-you may need to decide

- **OG image for landing page**: still using default? Worth a dedicated 1200×630
  hero specific to https://catmd.pet/ root? Currently the sources/library articles
  have heroes but the home page doesn't.
- **`/health/index.tsx`** orphan: keep as defensive deep-link target or delete?
  Currently leaning keep (small file, no harm, defensive).
- **Cat Diary, AI Companion, Personality Profile, Cat Studio**: all marked "soon"
  on the landing page. Build order TBD — likely Personality Profile next since
  the corpus and framework are already there.
- **Sitemap auto-regeneration**: `library.ts` header says deploys auto-update
  the sitemap. Verified for new article slugs but spot-check
  `https://catmd.pet/sitemap.xml` after next deploy.
- **Cat-birthday album for free-tier**: currently shows lock + upgrade CTA. Decide
  if a 3-photo teaser is worth A/B testing for conversion.

---

## 11. How to resume this session

If a fresh agent/window picks this up:

1. **Read this entire file first.** It's the source of truth.
2. **Confirm decisions in §1 are still locked in** with the user before
   starting work.
3. **Check AAB build #26f0fbf1** (versionCode 19, current) status:
   - URL: https://expo.dev/accounts/amit1601/projects/catmd/builds/26f0fbf1-98b7-4b09-827b-84e7958c2b9c
   - **If finished + healthy:** suggest `eas submit --platform android --latest`
     instead of manual upload. Per §3o, that auto-attaches the
     ProGuard/R8 mapping file so Play Console can deobfuscate crash
     stack traces — manual upload skips the mapping and triggers a
     non-blocking warning.
   - **If failed:** read the build log. Likely culprits at this point in
     the codebase: `classifyPhotoFull` integration in scan.tsx or
     behaviorObservation.ts (new code paths); `react-native-view-shot`
     native linking again (lazy-load fix is in §3m but if EAS prebuild
     re-broke something, the import path itself could fail at compile
     time).
4. **Build chronology this session** (for context):
   - `#db7d013e` versionCode 14 — cancelled mid-build (premature trigger)
   - `#1a178898` versionCode 15 — first ship (Personality + Diary +
     duotone hero)
   - `#94a7d504` versionCode 16 — duotone reverted to avatar pattern
   - `#7a42a08d` versionCode 17 — Diary white-screen fix + Chat MVP
   - `#1422e017` versionCode 18 — relevance gates + analytics
   - **`#26f0fbf1` versionCode 19 — current** — Zustand bug fix +
     Cat Studio + Onboarding refresh
5. **Most likely user requests next**:
   - "Eyeball the new build" — install via internal track. Things to
     verify on-device: Cat Diary opens cleanly (no white screen);
     attempting to triage a non-cat photo gets refused with a friendly
     reason; recording a non-cat video in Read [cat] gets refused
     similarly; Chat tab's empty state with 4 cat-aware suggested
     prompts; Today / Bond avatar headers (no muddy duotone).
   - "Submit to Play" — `cd D:/apps/catmd && npx eas-cli submit --platform android --latest`. Per §3o.
   - "More cards" — re-spawn the tight-scope card agent. See §8 gap list.
   - "Polish what shipped" — see §4f for personality follow-ups; diary
     follow-ups would be: streaming responses, photo input UI, action
     handoffs from chat to triage, conversation summarisation past
     MAX_TURNS, per-cat shared memory.
   - "Build the next thing" — Cat Studio (movie-poster remixes / songs
     / greeting cards) is the next "soon" tile. After that, all four
     pillars are real with no "soon" placeholders in primary nav.
6. **Closed decisions — don't reopen unless user explicitly revisits:**
   - Sora icon (§4c) — kept existing
   - Duotone hero — abandoned in favour of clean avatar (§3a)
   - Pro gating discussion — deferred per user direction during diary
     deferred-items chapter
   - Health hub naming — retired; lives as Track + Watch in Triage tab
7. **Net new modules in repo since end of build #7a42a08d:**
   - `src/ai/classify.ts` (rewritten — relevance gate)
   - `src/services/behaviorObservation.ts` (relevance gate added)
   - `app/scan.tsx` (rejection UI)
   - `app/behavior.tsx` (rejection UI + observation_started/completed/failed)
   - `app/cat-birthday.tsx` (screen_opened + paywall_tapped events)
   - `app/notification-settings.tsx` (category_toggled event)
   - `src/state/personalityStore.ts` (archetype_revealed milestone)
   - `src/services/analytics.ts` (10 new event types, paywall_viewed source extended)

End of checkpoint. Last updated: 2026-05-02 (overnight session work)
— AAB **#26f0fbf1 / versionCode 19** in flight, includes Zustand
infinite-loop fix + Cat Studio v1 + Onboarding refresh + chat action
handoffs. **Live state at checkpoint write:**
- Web: 20 long-form articles live at https://catmd.pet/library
  (worker `0056fa1c-d14b-43e0-a07d-9c4c5700d306`)
- Supabase: 642 cards (59 behavioral + 42 personality + 42 lifestyle)
- App-side: 6 net-new chapters since the last user-attended pause
  (Cat Studio v1, Onboarding refresh, Zustand fix, Bond reorder, chat
  action handoffs, +10 cards, +3 articles).
