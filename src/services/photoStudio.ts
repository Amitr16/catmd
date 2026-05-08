/**
 * Photo Studio service — daily-photo log + monthly time-lapse.
 *
 * Concept (Bond pillar): the user takes ONE photo of their cat per day.
 * The app builds a chronological log; users can scroll past months and
 * play back any month as an auto-cycling time-lapse. Over months/years
 * this becomes a record of the cat — coat changes, posture, weight,
 * "the cat at age 3 vs age 5." Extra-meaningful at memorial time.
 *
 * v1 SCOPE (this file + photoStudioStore):
 *   - Capture / replace today's photo
 *   - Persist photos under a stable per-cat folder so URIs survive
 *     Android gallery garbage-collection (cat-profile.tsx stores the
 *     ephemeral picker URI directly, which can disappear — Photo Studio
 *     COPIES the asset to documentDirectory).
 *   - Group by month for the landing screen
 *   - Cap at 365 photos per cat (one year). Older auto-evicted.
 *
 * v2 DEFERRED (intentionally — see comments on each):
 *   - AI vision pass on add (coat/posture/weight cues, "camera saw"
 *     caption). Brief promises this — defer until capture loop validates.
 *   - Health-trend insights from cross-photo deltas (route via
 *     CatContext patterns).
 *   - Time-lapse video EXPORT (vs in-app playback). RN video stitching
 *     is heavy and the MVP is the playback loop, not the export.
 *   - Multi-photo per day.
 *
 * Ownership boundaries:
 *   - photoStudio.ts (this file)  → pure helpers, file-system copy, types
 *   - photoStudioStore.ts         → Zustand state + add/delete/evict
 *   - app/photo-studio.tsx        → screen (camera CTA, grid, time-lapse)
 */
import * as FileSystem from 'expo-file-system/legacy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PhotoStudioPhoto = {
  id: string;
  cat_id: string;
  /** YYYY-MM-DD local. One photo per cat per day; re-take overwrites. */
  date: string;
  /** Stable file:// URI under documentDirectory. */
  uri: string;
  /** ISO timestamp the photo was added. */
  added_at: string;
  /** Where the photo came from. Used for analytics + future UX. */
  source: 'camera' | 'gallery';
  /**
   * Optional pixel dims. Useful for future video-export sizing decisions
   * but the in-app time-lapse just uses CSS resizeMode and doesn't need
   * it. Best-effort — set if ImagePicker reports them.
   */
  width?: number;
  height?: number;
  /**
   * Identity-match results, populated async after the photo is added.
   * Undefined while the check is in flight or on legacy entries.
   * Undefined → render no pill (assume single-cat optimistic). Once
   * set, the UI can render a "✓" / "⚠" / "Lily not detected" pill
   * and downstream consumers (postcard, body language) can filter.
   */
  cat_count?: number;
  /** Was the active cat (per profile photo) detected? */
  target_present?: boolean;
  /** Match confidence 0–1. 0 when no profile photo existed. */
  target_confidence?: number;
  /** Position of the target cat in frame. Diagnostic / future UX. */
  target_position?:
    | 'only'
    | 'left'
    | 'right'
    | 'center'
    | 'top'
    | 'bottom'
    | 'foreground'
    | 'background'
    | 'none';
  /** Set to true when the user has explicitly confirmed the match. */
  target_user_confirmed?: boolean;

  // ─── Subject tagging (added 2026-05-04) ─────────────────────────
  // The "Not Lily?" identity pill above is now retained as internal
  // metadata only — never surfaced in UI. The richer subject system
  // below replaces it: vision describes everyone in the frame
  // (people + other pets), the user names them, names persist in a
  // per-cat directory, diary memory recalls recurring subjects.

  /**
   * Vision-detected subjects in the frame. Populated async after the
   * photo is added (~2-4s round trip). Undefined until detection
   * completes; null after detection if vision returned nothing.
   *
   * The user is not blocked on this — they can tap "Tag who's here"
   * before the detection finishes and the chip suggestions update
   * once it lands.
   */
  /**
   * Vision-detected subject metadata. The shape evolved 2026-05-04:
   *
   * v1 (legacy): { people: number, pets: number, description: string,
   *   detected_at: string } — just counts + scene blurb.
   *
   * v2 (current): { people: PersonDescription[], pets: PetDescription[],
   *   description: string, detected_at: string } — per-person and
   *   per-pet rich attribute objects (~10 attrs each) used by
   *   services/subjects.ts:matchDetectedToDirectory() to recognise
   *   the same person across photos without face-recognition ML.
   *
   * Older photos captured before the upgrade still have v1 data; the
   * tag-sheet UI handles both shapes via runtime Array.isArray
   * checks. Typed as `unknown` for the people/pets fields so the
   * compiler doesn't enforce a specific shape — runtime guards
   * dispatch on what's actually there.
   */
  detected_subjects?: {
    /** v1: number of people; v2: array of per-person descriptions. */
    people: unknown;
    /** v1: number of pets; v2: array of per-pet descriptions. */
    pets: unknown;
    /** Free-text scene description (kept across both versions). */
    description: string;
    /** Local timestamp this detection landed. */
    detected_at: string;
  };

  /**
   * User-applied subject tags. Each tag links to a directory entry
   * (`subject_id`), with a denormalised name + kind for fast render.
   * Empty array = user hasn't tagged anyone yet (or the only subject
   * is the cat themselves).
   */
  subjects?: SubjectTag[];
};

/**
 * A subject tag attached to a single photo. Links to a directory
 * entry via `subject_id`; the name + kind are denormalised so the UI
 * can render without joining against the directory store.
 */
export type SubjectTag = {
  /** Stable id matching DirectoryEntry.id. */
  subject_id: string;
  /** Cached display name at tag time (e.g. "Bella", "Mom"). */
  name: string;
  /** Cached kind at tag time. */
  kind: SubjectKind;
  /** ISO timestamp the tag was attached. */
  tagged_at: string;
};

/** What kind of subject a directory entry represents. */
export type SubjectKind = 'person' | 'pet' | 'other';

/** Per-month bucket used by the screen for sectioned rendering. */
export type PhotoMonthBucket = {
  /** YYYY-MM (e.g. "2026-05"). Sortable lexicographically. */
  monthKey: string;
  /** Human label e.g. "May 2026". */
  label: string;
  /** Photos in this month, newest-first. */
  photos: PhotoStudioPhoto[];
};

// ---------------------------------------------------------------------------
// Date helpers (local-time, never UTC — same convention as postcard.ts)
// ---------------------------------------------------------------------------

/** YYYY-MM-DD for local time. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM for local time. */
export function localMonthKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Human-readable month label, e.g. "May 2026". Falls back to monthKey on parse fail. */
export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map((s) => parseInt(s, 10));
  if (!y || !m) return monthKey;
  return `${MONTH_NAMES[m - 1] ?? '?'} ${y}`;
}

/**
 * Group photos into per-month buckets, newest-month first. Photos within
 * each bucket are also sorted newest-first by `date`.
 */
export function groupByMonth(photos: PhotoStudioPhoto[]): PhotoMonthBucket[] {
  const map = new Map<string, PhotoStudioPhoto[]>();
  for (const p of photos) {
    const monthKey = p.date.slice(0, 7); // YYYY-MM
    const list = map.get(monthKey) ?? [];
    list.push(p);
    map.set(monthKey, list);
  }
  const buckets: PhotoMonthBucket[] = [];
  for (const [monthKey, list] of map.entries()) {
    list.sort((a, b) => b.date.localeCompare(a.date));
    buckets.push({
      monthKey,
      label: formatMonthLabel(monthKey),
      photos: list,
    });
  }
  buckets.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return buckets;
}

// ---------------------------------------------------------------------------
// File-system: stable photo persistence
// ---------------------------------------------------------------------------
//
// The picker returns a URI that's safe in the immediate future but not
// guaranteed across sessions: on Android, content:// URIs expire when
// the gallery app GCs them, and cache:// paths are wiped by the OS
// under storage pressure. The gallery is a long-tail feature — we want
// the May 2026 photo to still exist in May 2027. So we COPY each
// captured asset to a stable file:// path under documentDirectory.
//
// Path scheme: `<documentDirectory>photo-studio/<catId>/<photoId>.jpg`
// — id-based, so multiple photos per day coexist without collision.
//   (Was originally date-based — we relaxed to allow multiple photos
//   per day in 2026-05-02. Old date-based photos persist with their
//   original paths; the store just remembers the URI it was given.)

const ROOT_FOLDER = 'photo-studio';

/** Build the destination path for a given cat + photo id. */
export function stablePhotoPath(catId: string, photoId: string): string {
  // Sanitise — catIds are uuids in our store, but defensive.
  const safeCatId = catId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safePhotoId = photoId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${FileSystem.documentDirectory}${ROOT_FOLDER}/${safeCatId}/${safePhotoId}.jpg`;
}

/**
 * Copy a picker-supplied URI into a stable per-cat path. Returns the
 * stable file:// URI on success, or null if the copy fails (caller
 * should surface a friendly error and NOT add the photo to the store).
 *
 * If the source URI === target path (e.g. an internal copy round-trip),
 * this is a no-op and returns the path. Defensive against same-path
 * edge cases.
 */
export async function copyPhotoToStable(opts: {
  sourceUri: string;
  catId: string;
  photoId: string;
}): Promise<string | null> {
  try {
    const target = stablePhotoPath(opts.catId, opts.photoId);

    // Ensure the per-cat folder exists. makeDirectoryAsync with intermediates
    // is a no-op if the folder already exists.
    const folder = target.slice(0, target.lastIndexOf('/'));
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});

    // Same-path re-take — nothing to do.
    if (opts.sourceUri === target) return target;

    // Defensive: if a file at the target path somehow already exists
    // (id collision, retry path, etc), delete it first so copyAsync
    // doesn't fail on Android.
    const info = await FileSystem.getInfoAsync(target);
    if (info.exists) {
      await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
    }

    await FileSystem.copyAsync({ from: opts.sourceUri, to: target });
    return target;
  } catch (e) {
    console.warn('[PhotoStudio] copyPhotoToStable failed:', e);
    return null;
  }
}

/**
 * Best-effort delete of the on-disk asset for a photo. Used by the
 * store's deletePhoto + cap-evict path so we don't leak documentDirectory.
 * Idempotent — never throws to the caller.
 */
export async function deletePhotoFile(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  if (!uri.startsWith('file://')) return; // foreign URI, leave alone
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    console.warn('[PhotoStudio] deletePhotoFile failed:', e);
  }
}

/**
 * Wipe every photo on disk for a given cat. Used by cat-deletion +
 * GDPR-delete flows. Best-effort.
 */
export async function deleteAllPhotosForCat(catId: string): Promise<void> {
  try {
    const safeCatId = catId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const folder = `${FileSystem.documentDirectory}${ROOT_FOLDER}/${safeCatId}`;
    const info = await FileSystem.getInfoAsync(folder);
    if (info.exists) {
      await FileSystem.deleteAsync(folder, { idempotent: true });
    }
  } catch (e) {
    console.warn('[PhotoStudio] deleteAllPhotosForCat failed:', e);
  }
}

/** Today's photo from a list, or null. */
export function findTodaysPhoto(
  photos: PhotoStudioPhoto[],
  catId: string,
  today: string = localDateKey(),
): PhotoStudioPhoto | null {
  return photos.find((p) => p.cat_id === catId && p.date === today) ?? null;
}

// ---------------------------------------------------------------------------
// ImagePicker helper — used by every "take a photo" entry point
// ---------------------------------------------------------------------------
//
// Single source of truth for camera vs library access + permission flow.
// Bond tab's hero capture card AND the Photos screen both call this; the
// caller handles UI state (loading, errors) + analytics + the actual
// store insert. Keeps capture behaviour consistent across surfaces and
// avoids duplicating the permission boilerplate.
//
// Native `expo-image-picker` is dynamic-imported so module-link issues
// degrade to a friendly error rather than a white-screen crash — same
// defensive pattern as the share modules in postcard.tsx + diary.tsx.

export type PickedPhoto = {
  uri: string;
  width?: number;
  height?: number;
};

export type PhotoSource = 'camera' | 'gallery';

/**
 * Open the camera or photo library and return the user's selection
 * as an array. The gallery path supports MULTI-SELECT (up to
 * `selectionLimit`); the camera path always returns at most one
 * photo (camera is single-shot by nature).
 *
 * Returns an empty array when the user cancels (no error). Throws
 * when permission is denied or the picker module fails to load —
 * caller surfaces the message.
 *
 * `selectionLimit` should be set by the caller to the number of
 * photos they can still accept today (i.e. `DAILY_PHOTO_CAP -
 * todaysPhotos.length`). The picker enforces it natively, so the
 * user can't pick more than the allowed number.
 */
export async function captureViaImagePicker(opts: {
  source: PhotoSource;
  /**
   * Max photos to return. Default 1 (legacy single-photo behaviour).
   * Camera ignores values > 1 — Android/iOS native cameras don't do
   * burst-capture from the picker. Gallery respects up to N.
   */
  selectionLimit?: number;
}): Promise<PickedPhoto[]> {
  const ImagePicker = await import('expo-image-picker');
  const limit = Math.max(1, opts.selectionLimit ?? 1);

  let result: import('expo-image-picker').ImagePickerResult;
  if (opts.source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Camera permission denied');
    }
    result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      // No edit step — daily photos should feel quick, not curated.
      allowsEditing: false,
    });
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Photo library permission denied');
    }
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      // Multi-select only meaningful when the caller has > 1 slot
      // available. The native picker shows a "select multiple"
      // affordance + a counter.
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      allowsEditing: false,
    });
  }

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return [];
  }
  // Defensive: native picker should already cap at `limit`, but
  // double-cap here so callers can rely on the contract.
  return result.assets.slice(0, limit).map((asset) => ({
    uri: asset.uri,
    ...(asset.width != null ? { width: asset.width } : {}),
    ...(asset.height != null ? { height: asset.height } : {}),
  }));
}
