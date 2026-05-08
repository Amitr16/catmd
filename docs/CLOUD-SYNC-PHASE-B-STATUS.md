# Cloud Sync Phase B — Implementation Status

> **Status as of 2026-05-06 EOD**: Sync infrastructure 100% built and
> TS-clean. **NOT yet active** until the Supabase migration is run.
> **NOT yet usable cross-platform** until B1 (sign-in UI) ships.
>
> Resume from this doc when picking up B1 + B3.

---

## What got built this session

### ✅ Phase B2 — sync infrastructure (DONE)

| Component | Where | Notes |
|---|---|---|
| **Migration SQL** | `knowledge-pipeline/supabase/schema-cloud-backup-phase-b.sql` | 195 lines. Idempotent. Must be run on Supabase before any of the new sync helpers will succeed. |
| **8 new sync helpers** | `src/services/sync.ts` (after the existing `applyPulledIdentity`) | `syncDiaryEntryToCloud`, `syncChatTurnToCloud`, `syncPersonalityToCloud`, `syncPostcardToCloud`, `syncCatStudioPosterToCloud`, `syncWeeklyReadingToCloud`, `syncCatRemindersToCloud`, `syncNotifPrefsToCloud`. All fire-and-forget per-mutation. |
| **`pullPhaseBFromCloud()`** | `src/services/sync.ts` | Parallel fetch of all 7 cat_events types + 2 dedicated tables. ~140 lines. |
| **`applyPulledPhaseB()`** | `src/services/sync.ts` | Restores 8 stores via direct setState (bypasses per-mutator cloud-resync to avoid feedback loops). ~120 lines. |
| **`restoreFromCloudIfNeeded()` extended** | `src/services/sync.ts` | Now also runs Phase B pull + apply in parallel with the existing identity pull. |
| **`RestoreSummary` type extended** | `src/services/sync.ts` | New counts: `appliedDiaryEntries`, `appliedChatTurns`, `appliedPersonalityCats`, `appliedPostcards`, `appliedCatStudioPosters`, `appliedWeeklyReadings`, `appliedReminderCats`, `appliedNotifPrefs`. |

### ✅ Store mutator wirings (DONE — 8 of 8)

| Store | Hook point | What gets pushed |
|---|---|---|
| `diaryStore` | After every entry generation set() (`generateForToday`) | Diary entry text + mood word + date + photo URI metadata |
| `chatStore` | After every assistant turn (in `sendMessage`) | Both user turn AND assistant turn (with cited cards, actions, learned facts, field updates) |
| `personalityStore` | `saveQuiz` + after every `recompute` | Quiz answers + computed profile, single row per cat |
| `postcardStore` | After every postcard generation set() | Caption + caption_ai_original + photos metadata + date |
| `catStudioStore` | After manual `generatePoster` AND `weeklyAutoGenerate` | Poster id + week_id + variant_id + theme + photo_uri (local) + metadata |
| `weeklyReadingStore` | After every reading generation set() | Reading body + verdict + week_key |
| `notificationStore` | After `setMedReminder` AND `setCheckinReminder` | Per-cat reminder times (med_time, checkin_time, weekday). Notif IDs stay device-local. |
| `notifPrefsStore` | After `setEnabled` | Full per-user enabled map |

### 🔧 Bug fix included in migration

The existing schema's `cat_events.type` CHECK constraint was missing
`daily_checkin` and `behavior_observation` — both are valid
HealthEventType values that have been silently failing to push since
they were added. The Phase B migration extends the CHECK to include
them, so they'll start syncing once it's run.

---

## What's NOT done (deferred)

### ❌ B1 — Cross-platform sign-in flow

**What's missing:** UI + auth flow that lets a user with an existing
email account on one platform sign in on a different platform.

**Why it matters:** without B1, the data IS uploaded to Supabase under
`auth.uid()`, but a user moving from iOS → Android cannot retrieve
their `auth.uid()` because:
1. They get an anonymous session on the new device
2. They try to enter their email via Subscribe → email gate
3. `addEmailToAccount` calls `signUp(email, password)` because there's
   no existing-email session
4. Supabase rejects: `"User already registered"`
5. No fallback path to `signInWithEmail` exists in the UI

**What's needed:**
1. **`src/services/auth.ts`** — wrap `addEmailToAccount` to detect the
   "User already registered" error code and throw a typed error
   (e.g. `class EmailAlreadyExistsError extends Error`).
2. **`app/upgrade-account.tsx`** — in the form-submit error handler,
   catch `EmailAlreadyExistsError` and switch to a new sign-in stage
   that:
   - Shows password field for the existing account
   - Calls `signInWithEmail(email, password)` (already in auth.ts:97)
   - On success, runs `restoreFromCloudIfNeeded()` (already in sync.ts)
   - Shows the restore summary toast
3. **Forgot-password recovery** — add a "Forgot password?" link that
   calls `supabase.auth.resetPasswordForEmail(email)` and opens a
   recovery flow. Probably a separate `app/reset-password.tsx` screen.
4. **Settings entry point** — add a Settings → "Sign in to existing
   CatMD account" entry that routes to
   `/upgrade-account?mode=signin&email=...` so users can manually
   trigger a restore on a fresh install.
5. **`useAuthSession` hook** — may need to detect the new sign-in
   flow (vs. signup flow) so the upgrade-account screen doesn't
   confuse them.

**Effort:** ~2-3 hrs of focused code.

### ❌ B3 — Photos and posters to Supabase Storage

**What's missing:** the binary uploads. Photo Studio gallery, Cat
Studio posters, and postcard photos are still local `file://` URIs.
Cross-device restore brings the metadata (Postcard caption, Poster
theme/week_id, etc.) but the rendered images don't follow.

**What's needed:**
1. **Storage bucket** — `user-media` bucket already created by the
   migration with per-user-folder RLS (`<user_id>/<photo_id>.jpg`).
2. **Upload helpers in `src/services/sync.ts`:**
   - `uploadPhotoToStorage(localUri: string, photoId: string): Promise<string>` — reads the local file, uploads to `user-media/<userId>/<photoId>.jpg`, returns the cloud URL
   - `uploadPosterToStorage(localUri: string, posterId: string): Promise<string>` — same shape, .png
   - `downloadPhotoFromStorage(cloudPath: string, localTargetUri: string): Promise<void>` — for restore
3. **Wire upload-on-save:**
   - `photoStudioStore.addPhoto` — upload after local save, store both `photo_uri` (local) and `cloud_storage_url` (cloud) on the photo record
   - `catStudioStore.generatePoster` + `weeklyAutoGenerate` — same pattern after the poster's local PNG is saved
   - `postcardStore` — postcards reference photos that may already have cloud URLs; if not, upload here
4. **Wire download-on-restore:**
   - In `applyPulledPhaseB`, after applying postcards / posters / photo metadata, iterate referenced cloud URLs and download to `documentDirectory/photo-studio/<catId>/<photoId>.jpg`
   - Update the local store entries with the rebuilt local URIs
5. **Progress UI** — restore takes time when there are 50+ photos.
   Show "Downloading 8/12 photos…" during restore.
6. **Schema additions** — `cloud_storage_url` field on `PhotoStudioPhoto`,
   `CatStudioPoster`. Type updates + migration to existing local stores.

**Effort:** ~3 hrs.

### ❌ Plan doc update

`docs/CLOUD-SYNC-AND-RESTORE-PLAN.md` still says "Phase B not yet
shipped." It should be updated when B1 + B3 land to reflect reality
and to mark the in-prep commitments as done.

---

## ⚠️ CRITICAL: prerequisite for any of this to work

**Run the migration on Supabase before installing any build that has
this code.**

Without the migration:
- New sync helpers will fail silently — Supabase rejects upserts that
  don't match the `cat_events.type` CHECK constraint
- The new tables (`cat_reminders`, `notif_prefs`) don't exist
- The `user-media` storage bucket doesn't exist
- The `daily_checkin` and `behavior_observation` bug stays unfixed

Failures are caught and logged via `console.warn` — they don't break
the app, just silently lose new pushes. Same offline-first pattern as
existing sync.

**To run:** copy `knowledge-pipeline/supabase/schema-cloud-backup-phase-b.sql`
into the Supabase SQL Editor and execute. Idempotent — safe to re-run.

---

## Audit — what could break

### ✅ Verified safe

- **TS check is clean** (zero errors in user code, only pre-existing
  `node_modules` noise)
- **All sync helper imports** are dynamic/lazy via `void import()` — no
  circular dep risks at module-load time
- **Per-mutator wiring** uses `.catch(() => {})` so individual sync
  failures never propagate to the UI
- **No existing functionality changed** — sync helpers are pure
  additions; existing push helpers (catStore, scanStore, healthStore)
  are untouched
- **Restore guards intact** — `restoreFromCloudIfNeeded()` still only
  fires on fresh-install all-local-empty check. Phase B pull is gated
  by the same condition.
- **`RestoreSummary` extension** — additive only; existing consumers
  reading just the original counts still work
- **Marker / type discriminators** — the new event types
  (`diary_entry`, `chat`, `personality_quiz`, `postcard`,
  `cat_studio_poster`, `weekly_reading`) don't collide with existing
  types. The CHECK constraint extension is purely additive.

### 🟡 Likely-safe but unverified

- **Sync push timing** — every diary entry / chat turn / postcard /
  poster / weekly reading triggers a fire-and-forget Supabase upsert.
  At high volumes (e.g. heavy chat usage) this is many small POST
  requests. The existing pattern is the same; new types just add to
  the existing per-mutation pattern. Should be fine for typical usage.
- **Cat Studio poster `image_uri` shape** — the wiring uses optional
  chaining: `(poster as { image_uri?: string; photo_uri?: string }).image_uri ?? ...photo_uri`.
  TS-clean but assumes the runtime shape has one of those fields.
  Verified against `CatStudioPoster` type. If a different field name
  is used (e.g. `uri`), cloud will store an empty string. Low impact —
  metadata still restores; binary restore is B3 anyway.
- **Postcard `photos` shape** — wiring maps `postcard.photos` directly
  with `.map((p) => ({ uri, width, height }))`. Verified against
  `PostcardPhoto` type. Should be safe.
- **Weekly reading `id` synthesis** — the type has no `id` field, so
  we synthesise `weekly_reading:${catId}:${week_key}` as the cat_events
  primary key. Idempotent on regeneration. Safe.
- **Diary entry `id` synthesis** — same, `diary:${cat_id}:${date}`.

### 🔴 Known limitations

- **Photo binaries don't sync yet (B3)** — `photoStudioStore` is NOT
  wired in this session because the upload pipeline doesn't exist yet.
  Photo metadata WOULD sync if photoStudioStore had a sync helper, but
  the binary file:// URIs would just sit in cloud as broken references
  on the receiving device. Better to skip the metadata until B3 ships
  the actual upload + download.
- **Cross-platform restore is non-functional yet (B1)** — Pro user
  with email A on iOS reinstalling on Android can NOT yet access their
  cloud data. The data is uploaded; the UI to retrieve it isn't built.
- **Multi-device live sync** — pull is one-shot at restore. If user
  edits the cat on Device A while logged in on Device B, Device B sees
  stale state until next restart + restore. Not in scope for Phase B.

---

## Resume checklist for next session

When picking up B1 + B3:

1. **Confirm the migration was run** on Supabase. Test by pushing a
   `daily_checkin` event from the app and querying `cat_events` for
   `type='daily_checkin'`. If 0 rows, the migration didn't take.
2. **Build vc 68** (chat fixes from earlier) OR **vc 69** (chat fixes
   + Phase B sync). Either way, install fresh and verify a diary
   entry / chat turn / postcard pushes to Supabase.
3. **Tackle B1 first** — it's smaller than B3 and unblocks the actual
   user-facing "restore on new device" promise.
4. **Then B3** — photo upload pipeline. Test with a small photo first
   (memory + bandwidth concerns).
5. **Update `docs/CLOUD-SYNC-AND-RESTORE-PLAN.md`** to mark Phase B as
   shipped.

---

## Files modified this session (Phase B)

```
knowledge-pipeline/supabase/schema-cloud-backup-phase-b.sql   (NEW, 195 lines)
src/services/sync.ts                                          (+679 lines)
src/state/diaryStore.ts                                       (+13 lines)
src/state/chatStore.ts                                        (+6 lines)
src/state/personalityStore.ts                                 (+18 lines)
src/state/postcardStore.ts                                    (+19 lines)
src/state/catStudioStore.ts                                   (+30 lines)
src/state/weeklyReadingStore.ts                               (+13 lines)
src/state/notificationStore.ts                                (+22 lines)
src/state/notifPrefsStore.ts                                  (+9 lines)
docs/CLOUD-SYNC-PHASE-B-STATUS.md                             (NEW, this file)
```

No changes to existing functions — all changes are additive.
TS check passes. No build triggered.
