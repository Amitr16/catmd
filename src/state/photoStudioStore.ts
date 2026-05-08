/**
 * Photo gallery store — the canonical photo source for the Bond pillar.
 *
 * EVERY photo of the cat lives here. Postcard, Diary's vision context,
 * and Cat Studio's reference photo all read from this store. There is
 * no other photo capture flow on the Bond side; the Bond tab's hero
 * card is the entry point.
 *
 * Pattern matches the rest of the Bond stack (postcardStore, diaryStore,
 * catStudioStore): Zustand + AsyncStorage persistence + stable-reference
 * empty-array constants for the convenience hooks (Zustand re-render
 * loop fix).
 *
 * Capacity rules (post 2026-05-04 unlimited-photos rework):
 *   - NO daily cap — users take as many photos per day as they like.
 *     Postcard randomly samples 3 from today's pool to keep collages
 *     fresh. PICKER_BATCH_LIMIT below caps a single multi-select
 *     session at 30 (just so the picker stays responsive).
 *   - MAX_PHOTOS_PER_CAT = 2000 → hard lifetime cap per cat. Bumped
 *     from 1000 alongside the daily-cap removal — power users could
 *     blow through 1000 in weeks at unlimited daily rate. Eviction
 *     is FIFO across all dates.
 *
 * Storage discipline (see services/photoStudio.ts for the file-system
 * layer): photos copied to stable documentDirectory, paths keyed by
 * photo id (NOT date), so multiple photos per day coexist without
 * collision.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as FileSystem from 'expo-file-system/legacy';
import {
  copyPhotoToStable,
  deleteAllPhotosForCat,
  deletePhotoFile,
  localDateKey,
  type PhotoStudioPhoto,
} from '../services/photoStudio';
import { analyzeCats } from '../services/identityMatch';
import { useCatStore } from './catStore';
import { track } from '../services/analytics';

/**
 * Daily cap was REMOVED on 2026-05-04. Users now take unlimited photos
 * per day — the postcard layer (gatherTodaysPhotos) picks 3 at random
 * from the day's pool, so the previous "4 because the postcard layout
 * fit 4" justification went away. Photos are also fuel for the diary
 * (vision context) and the new subject-tagging directory; richer
 * gallery → richer diary memory.
 *
 * The lifetime cap below still applies as a storage guardrail.
 */

/**
 * Hard cap on lifetime per-cat photos. Bumped 1000→2000 alongside the
 * daily-cap removal — at the previous 4/day rate this represented ~6
 * months of capture, but with unlimited daily photos a power user
 * could blow through 1000 in weeks. 2000 ≈ 300 MB at 150 KB/photo,
 * still comfortable on modern devices and well below the OS-imposed
 * "low storage" thresholds we'd want to dodge. When hit, oldest
 * photos across all dates get evicted FIFO.
 */
const MAX_PHOTOS_PER_CAT = 2000;

type State = {
  /** Per-cat photo log, newest-first by added_at. */
  photos: Record<string, PhotoStudioPhoto[]>;

  /**
   * Add a captured photo to the log. Caller passes the picker URI; the
   * store handles the copy-to-stable step + lifetime-cap eviction.
   * Throws on copy failure so the screen can show a retry CTA.
   *
   * Unlimited photos per day — the postcard randomly samples 3 from
   * the day's pool, so users can take as many as they want.
   *
   * `replaced_existing_today` is retained for backwards compat with
   * existing callsites — it's now always `false` (no daily eviction).
   */
  addPhoto: (opts: {
    catId: string;
    sourceUri: string;
    source: 'camera' | 'gallery';
    width?: number;
    height?: number;
    /** Optional explicit date override (defaults to today). */
    date?: string;
  }) => Promise<{
    photo: PhotoStudioPhoto;
    /** Legacy flag. Always false now (unlimited daily photos). */
    replaced_existing_today: boolean;
  }>;

  /**
   * Patch a single photo record in place. Used by the async identity
   * check to write `cat_count` / `target_present` / `target_confidence`
   * after the model returns. Also used by the user-facing "confirm
   * Lily" UI to flip `target_user_confirmed`.
   */
  patchPhoto: (
    catId: string,
    photoId: string,
    patch: Partial<PhotoStudioPhoto>,
  ) => void;

  /** Remove a single photo by id. Best-effort deletes the file too. */
  deletePhoto: (catId: string, photoId: string) => Promise<void>;

  /**
   * Attach a SubjectTag to a photo. The tag links the photo to a
   * directory entry; both sides are mutated in lockstep — this
   * function only touches the photo. Caller is responsible for
   * upserting the directory entry first (typically via
   * `useSubjectDirectoryStore.upsertFromTag`) and passing the
   * resulting subject_id here.
   *
   * Idempotent: re-tagging the same photo with the same subject_id
   * is a no-op (won't duplicate the tag).
   */
  addSubjectToPhoto: (
    catId: string,
    photoId: string,
    tag: import('../services/photoStudio').SubjectTag,
  ) => void;

  /**
   * Remove a SubjectTag from a photo. Caller is responsible for the
   * matching directory-side cleanup (`removeAppearance`).
   */
  removeSubjectFromPhoto: (
    catId: string,
    photoId: string,
    subjectId: string,
  ) => void;

  /**
   * Backfill width/height for any photos that don't have them. Reads
   * the actual pixel dimensions via Image.getSize from the stored URI
   * and patches the record. Only called by the postcard screen — the
   * collage layout picker needs aspect ratios to choose the right
   * tiling, and photos captured by old builds (before addPhoto carried
   * dims through) lack these fields.
   *
   * Returns the count of photos that were hydrated. Missing files /
   * Image.getSize errors are skipped silently — those photos will keep
   * unknown dims and the layout picker falls back to legacy 3-stripes.
   */
  hydratePhotoDims: (catId: string) => Promise<number>;

  /** Read the log for a cat, newest-first by added_at. */
  getPhotosForCat: (catId: string) => PhotoStudioPhoto[];

  /** All photos for a specific date (newest-first), or empty array. */
  getPhotosForDate: (catId: string, date: string) => PhotoStudioPhoto[];

  /**
   * GDPR / cat-delete sweep — wipes records AND on-disk assets for a cat.
   * Async because of the file-system delete; callers can fire-and-forget.
   */
  clearForCat: (catId: string) => Promise<void>;

  clearAll: () => void;
};

/** Generate a stable photo id used for both the record + file path. */
function newPhotoId(): string {
  return `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const usePhotoStudioStore = create<State>()(
  persist(
    (set, get) => ({
      photos: {},

      addPhoto: async ({ catId, sourceUri, source, width, height, date }) => {
        const targetDate = date ?? localDateKey();
        const photoId = newPhotoId();

        // Copy the picker asset to a stable per-cat path keyed by the
        // photo id (NOT the date) so multiple photos for the same day
        // don't collide. If this fails we throw — the screen surfaces
        // a retry CTA. We don't insert a record pointing at an
        // ephemeral picker URI; that'd disappear on Android gallery GC
        // and the photo would silently rot.
        const stableUri = await copyPhotoToStable({
          sourceUri,
          catId,
          photoId,
        });
        if (!stableUri) {
          throw new Error("Couldn't save the photo. Try again.");
        }

        const photo: PhotoStudioPhoto = {
          id: photoId,
          cat_id: catId,
          date: targetDate,
          uri: stableUri,
          added_at: new Date().toISOString(),
          source,
          ...(width != null ? { width } : {}),
          ...(height != null ? { height } : {}),
        };

        const existing = get().photos[catId] ?? [];

        // Daily-cap enforcement was REMOVED on 2026-05-04. Users take
        // unlimited photos per day; the postcard samples 3 at random.
        // The `replaced_existing_today` flag is retained for backwards
        // compatibility with existing callers but is always `false`.
        const replaced_existing_today = false;

        // Insert the new photo and re-sort newest-first by added_at.
        // (date is the logical day; added_at is the precise capture
        // moment — we sort by added_at so re-takes within the same day
        // appear in chronological capture order.)
        const next = [photo, ...existing].sort((a, b) =>
          b.added_at.localeCompare(a.added_at),
        );

        // ── Lifetime-cap eviction ──
        // FIFO by added_at. Drop the OLDEST photos beyond the hard cap.
        if (next.length > MAX_PHOTOS_PER_CAT) {
          const toEvict = next.slice(MAX_PHOTOS_PER_CAT);
          for (const evicted of toEvict) {
            void deletePhotoFile(evicted.uri);
          }
        }
        const trimmed = next.slice(0, MAX_PHOTOS_PER_CAT);

        set((s) => ({
          photos: { ...s.photos, [catId]: trimmed },
        }));

        // Fire identity check in the background. Photo is already
        // saved + visible in the UI; the check fills in cat_count /
        // target_present / target_confidence on the photo record
        // when complete (~1-2 sec). Skipped when user has a single
        // cat AND a profile photo — that's the common case where
        // identity matching is wasted cost (model would always say
        // "yes that's Lily").
        void runIdentityCheck({ photoId, catId, stableUri, set, get });

        // Fire subject detection in the background — fills in
        // detected_subjects so the tag sheet can suggest "tag the
        // person who's here" with vision-grounded counts. Best-effort:
        // any failure leaves detected_subjects undefined and the tag
        // sheet still works (user types names directly).
        void runSubjectDetection({ photoId, catId, stableUri, set, get });

        // Fire world extraction in the background — silent vision pass
        // that pulls objects / places / environment markers out of the
        // photo and feeds them into the worldStore candidate pool.
        // Recurrence-graduates ≥2 sightings within 30 days into real
        // entries the cat references in chat. The user is never told
        // this happens — the magic is them noticing the cat "knows"
        // about the green chair.
        void runWorldExtraction({ catId, stableUri, photoAddedAt: photo.added_at });

        return { photo, replaced_existing_today };
      },

      patchPhoto: (catId, photoId, patch) => {
        set((s) => {
          const list = s.photos[catId] ?? [];
          const idx = list.findIndex((p) => p.id === photoId);
          if (idx < 0) return s;
          const next = [...list];
          next[idx] = { ...next[idx]!, ...patch };
          return { photos: { ...s.photos, [catId]: next } };
        });
      },

      deletePhoto: async (catId, photoId) => {
        const list = get().photos[catId] ?? [];
        const target = list.find((p) => p.id === photoId);
        if (!target) return;
        void deletePhotoFile(target.uri);
        // Cascade: drop all directory appearances for this photo.
        // Lazy import to avoid a hard cycle (subjectDirectoryStore →
        // photoStudio types → photoStudioStore).
        const tags = target.subjects ?? [];
        if (tags.length > 0) {
          void (async () => {
            const { useSubjectDirectoryStore } = await import('./subjectDirectoryStore');
            const dir = useSubjectDirectoryStore.getState();
            for (const tag of tags) {
              dir.removeAppearance(catId, tag.subject_id, photoId);
            }
          })().catch(() => {});
        }
        set((s) => ({
          photos: {
            ...s.photos,
            [catId]: (s.photos[catId] ?? []).filter((p) => p.id !== photoId),
          },
        }));
      },

      addSubjectToPhoto: (catId, photoId, tag) => {
        set((s) => {
          const list = s.photos[catId] ?? [];
          const idx = list.findIndex((p) => p.id === photoId);
          if (idx < 0) return s;
          const photo = list[idx]!;
          const existing = photo.subjects ?? [];
          // Idempotent — no-op if the same subject is already tagged.
          if (existing.some((t) => t.subject_id === tag.subject_id)) {
            return s;
          }
          const next = [...list];
          next[idx] = { ...photo, subjects: [...existing, tag] };
          return { photos: { ...s.photos, [catId]: next } };
        });
      },

      removeSubjectFromPhoto: (catId, photoId, subjectId) => {
        set((s) => {
          const list = s.photos[catId] ?? [];
          const idx = list.findIndex((p) => p.id === photoId);
          if (idx < 0) return s;
          const photo = list[idx]!;
          const existing = photo.subjects ?? [];
          const filtered = existing.filter((t) => t.subject_id !== subjectId);
          if (filtered.length === existing.length) return s; // wasn't tagged
          const next = [...list];
          next[idx] = { ...photo, subjects: filtered };
          return { photos: { ...s.photos, [catId]: next } };
        });
      },

      hydratePhotoDims: async (catId) => {
        const list = get().photos[catId] ?? [];
        const needs = list.filter((p) => !p.width || !p.height);
        if (needs.length === 0) return 0;
        // Lazy import RN's Image so this store stays usable in plain-JS
        // contexts (tests, type-only usage).
        const { Image } = await import('react-native');
        const measure = (uri: string): Promise<{ width: number; height: number } | null> =>
          new Promise((resolve) => {
            try {
              Image.getSize(
                uri,
                (w, h) => resolve(w > 0 && h > 0 ? { width: w, height: h } : null),
                () => resolve(null),
              );
            } catch {
              resolve(null);
            }
          });
        const results = await Promise.all(
          needs.map(async (p) => ({ id: p.id, dims: await measure(p.uri) })),
        );
        let hydrated = 0;
        set((s) => {
          const cur = s.photos[catId] ?? [];
          const next = cur.map((p) => {
            const r = results.find((x) => x.id === p.id);
            if (!r || !r.dims) return p;
            hydrated += 1;
            return { ...p, width: r.dims.width, height: r.dims.height };
          });
          return { photos: { ...s.photos, [catId]: next } };
        });
        return hydrated;
      },

      getPhotosForCat: (catId) => get().photos[catId] ?? [],

      getPhotosForDate: (catId, date) =>
        (get().photos[catId] ?? [])
          .filter((p) => p.date === date)
          .sort((a, b) => b.added_at.localeCompare(a.added_at)),

      clearForCat: async (catId) => {
        await deleteAllPhotosForCat(catId);
        set((s) => {
          const next = { ...s.photos };
          delete next[catId];
          return { photos: next };
        });
      },

      clearAll: () => set({ photos: {} }),
    }),
    {
      name: 'catmd-photo-studio',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

// ---------------------------------------------------------------------------
// Async identity check (multi-cat handling)
// ---------------------------------------------------------------------------
//
// Fires after addPhoto saves the photo to the gallery. The vision call
// takes ~1-2 sec; we don't block the photo save on it. Result lands
// onto the photo record via patchPhoto so the UI can re-render pills
// and downstream consumers (postcard, body language) can filter or
// surface verification UX.
//
// Auto-bootstrap rule: when the cat has NO profile photo and the
// candidate contains exactly ONE cat, we silently set the candidate
// as the profile photo. Subsequent photos benefit from real identity
// matching. When multi-cat AND no profile, we leave profile unset and
// surface a "set Lily's profile photo" pill on the photo (UI side).
//
// Skip rule: when the cat already has a profile photo AND there's only
// ONE cat in the user's catStore, we skip the identity check entirely
// — it's the common case and the answer is always "yes that's Lily."
// Saves ~$0.005 per photo for the 95% of users with a single cat.

async function runIdentityCheck(opts: {
  photoId: string;
  catId: string;
  stableUri: string;
  set: (
    update:
      | Partial<{ photos: Record<string, PhotoStudioPhoto[]> }>
      | ((s: { photos: Record<string, PhotoStudioPhoto[]> }) => Partial<{ photos: Record<string, PhotoStudioPhoto[]> }>),
  ) => void;
  get: () => { photos: Record<string, PhotoStudioPhoto[]> };
}): Promise<void> {
  const { photoId, catId, stableUri } = opts;

  const catState = useCatStore.getState();
  const cat = catState.cats.find((c) => c.id === catId);
  if (!cat) return;

  const onlyCatInApp = catState.cats.length === 1;
  const hasProfile = !!cat.photo_uri;

  // Skip: single cat in app + profile photo set = waste of $$.
  if (onlyCatInApp && hasProfile) {
    // Patch the photo record with optimistic-single-cat result so
    // downstream consumers (postcard filtering, etc) can rely on
    // these fields being defined.
    patchPhotoRecord(opts, {
      cat_count: 1,
      target_present: true,
      target_confidence: 1,
      target_position: 'only',
    });
    return;
  }

  // Read base64 of candidate + (optional) profile.
  const [candidateBase64, profileBase64] = await Promise.all([
    readFileBase64(stableUri),
    hasProfile ? readFileBase64(cat.photo_uri!) : Promise.resolve(null),
  ]);
  if (!candidateBase64) {
    // Couldn't read the photo — leave fields undefined; UI will fall
    // back to optimistic single-cat assumption.
    return;
  }

  track({
    type: 'identity_match_run',
    props: {
      had_profile: hasProfile,
      surface: 'photo_studio_add',
    },
  });

  const result = await analyzeCats({
    candidateBase64,
    profileBase64,
    catName: cat.name,
  });

  if (result.failed) {
    track({
      type: 'identity_match_failed',
      props: { reason: result.reasoning.slice(0, 100) },
    });
  }

  // Auto-bootstrap: no profile + single cat in candidate → set the
  // candidate as the cat's profile photo. Silent. The user will
  // notice indirectly when subsequent multi-cat photos correctly
  // attribute to Lily.
  if (!hasProfile && result.catCount === 1 && !result.failed) {
    catState.patchCat(catId, { photo_uri: stableUri });
    track({
      type: 'identity_match_target_not_found',
      props: { reason: 'auto_bootstrap_set_profile' },
    });
  }

  // Telemetry: model didn't see our cat. Worth noting for tuning.
  if (hasProfile && !result.targetPresent && result.catCount > 0 && !result.failed) {
    track({
      type: 'identity_match_target_not_found',
      props: { reason: `cats_in_frame_${result.catCount}` },
    });
  }

  patchPhotoRecord(opts, {
    cat_count: result.catCount,
    target_present: result.targetPresent,
    target_confidence: result.targetConfidence,
    target_position: result.targetPosition,
  });
}

/** Internal helper: patch a photo record from inside runIdentityCheck. */
function patchPhotoRecord(
  ctx: {
    photoId: string;
    catId: string;
    set: (
      update:
        | Partial<{ photos: Record<string, PhotoStudioPhoto[]> }>
        | ((s: { photos: Record<string, PhotoStudioPhoto[]> }) => Partial<{ photos: Record<string, PhotoStudioPhoto[]> }>),
    ) => void;
    get: () => { photos: Record<string, PhotoStudioPhoto[]> };
  },
  patch: Partial<PhotoStudioPhoto>,
): void {
  ctx.set((s) => {
    const list = s.photos[ctx.catId] ?? [];
    const idx = list.findIndex((p) => p.id === ctx.photoId);
    if (idx < 0) return s;
    const next = [...list];
    next[idx] = { ...next[idx]!, ...patch };
    return { photos: { ...s.photos, [ctx.catId]: next } };
  });
}

/** Read a local file:// URI as base64; null on any failure. */
async function readFileBase64(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (!uri.startsWith('file://') && !uri.startsWith('/')) return null;
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Background subject detection (added 2026-05-04)
// ---------------------------------------------------------------------------
// Vision call that fires after a photo lands in the gallery. Counts
// people + other pets visible (excluding the named cat) and writes
// the result to `detected_subjects` on the photo record. The user's
// tag-sheet UI uses these counts to suggest "+ tag the person here"
// chips. Best-effort — failure leaves detected_subjects undefined
// and the tag sheet still works (user types names directly).

async function runSubjectDetection(opts: {
  photoId: string;
  catId: string;
  stableUri: string;
  set: (
    update:
      | Partial<{ photos: Record<string, PhotoStudioPhoto[]> }>
      | ((s: { photos: Record<string, PhotoStudioPhoto[]> }) => Partial<{ photos: Record<string, PhotoStudioPhoto[]> }>),
  ) => void;
  get: () => { photos: Record<string, PhotoStudioPhoto[]> };
}): Promise<void> {
  const { photoId, catId, stableUri } = opts;
  const cat = useCatStore.getState().cats.find((c) => c.id === catId);
  if (!cat) return;

  try {
    const { detectSubjectsForPhoto } = await import('../services/subjects');
    const result = await detectSubjectsForPhoto({
      photoUri: stableUri,
      catName: cat.name,
    });
    if (!result) return;
    patchPhotoRecord(opts, { detected_subjects: result });
    // Analytics carries COUNTS (numbers), not the full description
    // arrays. Description payloads are sensitive (skin tone, etc.)
    // and have no reason to leave the device.
    const peopleCount = Array.isArray(result.people) ? result.people.length : 0;
    const petsCount = Array.isArray(result.pets) ? result.pets.length : 0;
    track({
      type: 'subject_detection_run',
      props: {
        people: peopleCount,
        pets: petsCount,
        had_subjects: peopleCount > 0 || petsCount > 0,
      },
    });
  } catch (e) {
    console.warn('[PhotoStudio] subject detection skipped:', e);
  }
}

// ---------------------------------------------------------------------------
// Background world extraction (added 2026-05-05)
// ---------------------------------------------------------------------------
// Runs after every successful photo add. Fires the vision pass in
// `services/worldExtraction.ts`, which pulls objects/places/environment
// markers out of the photo and feeds them into the worldStore candidate
// pool. Best-effort — failure is silent (telemetry captures it via the
// world_extraction_run event with `error` populated).
//
// Skipped when there's no cat record (defensive — addPhoto already
// requires a catId, but a stale catId could slip through).

async function runWorldExtraction(opts: {
  catId: string;
  stableUri: string;
  photoAddedAt: string;
}): Promise<void> {
  const cat = useCatStore.getState().cats.find((c) => c.id === opts.catId);
  if (!cat) return;
  try {
    const { extractWorldFromPhoto } = await import('../services/worldExtraction');
    await extractWorldFromPhoto({
      catId: opts.catId,
      catName: cat.name,
      photoUri: opts.stableUri,
      observedAt: opts.photoAddedAt,
      source: 'photo',
    });
  } catch (e) {
    // Already telemetered inside extractWorldFromPhoto — just swallow.
    console.warn('[PhotoStudio] world extraction skipped:', e);
  }
}

// ---------------------------------------------------------------------------
// Convenience hooks (stable-reference pattern — see chatStore comment for
// full background. Selectors that build new arrays/objects every render
// trigger Zustand's "Maximum update depth exceeded" loop.)
// ---------------------------------------------------------------------------

const EMPTY_PHOTOS: PhotoStudioPhoto[] = Object.freeze([]) as unknown as PhotoStudioPhoto[];

/**
 * Sorted (newest-first by added_at) photo log for the cat. Subscribes
 * to the raw `photos[catId]` reference and derives via useMemo so
 * re-renders only fire on actual changes.
 */
export function usePhotosForCat(catId: string | null | undefined): PhotoStudioPhoto[] {
  const list = usePhotoStudioStore((s) =>
    catId ? s.photos[catId] ?? EMPTY_PHOTOS : EMPTY_PHOTOS,
  );
  return useMemo(() => {
    if (!catId) return EMPTY_PHOTOS;
    // Already sorted by addPhoto, but defensive: re-sort on every read so
    // a future bulk-import path that bypasses addPhoto can't subtly
    // break the screen's chronological layout.
    return [...list].sort((a, b) => b.added_at.localeCompare(a.added_at));
  }, [list, catId]);
}

/**
 * All of today's photos for the cat (newest-first). Used by Bond's
 * hero card + the postcard photo aggregator. Returns an empty array
 * when nothing has been captured today yet.
 */
export function useTodaysPhotos(catId: string | null | undefined): PhotoStudioPhoto[] {
  const list = usePhotoStudioStore((s) =>
    catId ? s.photos[catId] ?? EMPTY_PHOTOS : EMPTY_PHOTOS,
  );
  return useMemo(() => {
    if (!catId) return EMPTY_PHOTOS;
    const today = localDateKey();
    return list
      .filter((p) => p.cat_id === catId && p.date === today)
      .sort((a, b) => b.added_at.localeCompare(a.added_at));
  }, [list, catId]);
}

/**
 * Photos in the past N days for the cat (newest-first). Used by Cat
 * Studio's weekly auto-poster reference picker (N=7).
 */
export function usePhotosInLastDays(
  catId: string | null | undefined,
  days: number,
): PhotoStudioPhoto[] {
  const list = usePhotoStudioStore((s) =>
    catId ? s.photos[catId] ?? EMPTY_PHOTOS : EMPTY_PHOTOS,
  );
  return useMemo(() => {
    if (!catId) return EMPTY_PHOTOS;
    const cutoff = Date.now() - days * 86400 * 1000;
    return list
      .filter((p) => p.cat_id === catId && Date.parse(p.added_at) >= cutoff)
      .sort((a, b) => b.added_at.localeCompare(a.added_at));
  }, [list, catId, days]);
}

/**
 * Maximum photos a user can pick in a SINGLE picker session. Not a
 * daily cap — it just keeps the multi-select picker reasonable so a
 * user doesn't accidentally select 200 photos and lock the app for a
 * minute on import. Users can run the picker multiple times in a day
 * to add more.
 *
 * The legacy export `DAILY_PHOTO_CAP` is preserved as an alias so old
 * callsites compile during the migration; it's no longer a per-day
 * limit, just a picker-session limit. The "X / Y today" UI was
 * removed alongside the cap on 2026-05-04.
 */
export const PICKER_BATCH_LIMIT = 30;
/** @deprecated — use PICKER_BATCH_LIMIT. No longer a daily cap. */
export const DAILY_PHOTO_CAP = PICKER_BATCH_LIMIT;
