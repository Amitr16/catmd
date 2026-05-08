/**
 * Cat Studio store — caches generated posters per cat.
 *
 * Capped at 10 posters per cat to bound storage (each base64 PNG is ~200-500 KB
 * at our resolution; 10 × 400 KB = 4 MB per cat which is reasonable).
 * Older generations get evicted when the cap fills.
 *
 * Generation lives in `services/catStudio.ts`. The store wraps it with
 * cache + a `generating` flag for the screen to render a spinner.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  generatePoster,
  getStudioWeekAnchor,
  pickFreshGenre,
  pickWeeklyReferencePhoto,
  type CatStudioPoster,
  type Genre,
} from '../services/catStudio';
import { useCatStore } from './catStore';
import { usePhotoStudioStore } from './photoStudioStore';
import { track } from '../services/analytics';

const MAX_POSTERS_PER_CAT = 10;

type State = {
  /** Per-cat poster cache, newest first. */
  posters: Record<string, CatStudioPoster[]>;
  /** Whether a generation is in flight per cat. UI uses this for spinners. */
  generating: Record<string, boolean>;

  /**
   * Generate a poster for the given cat + genre. Caches the result + returns
   * it. Throws on errors — caller catches and shows a retry CTA.
   */
  generate: (opts: { catId: string; genre: Genre; catPhotoBase64?: string | null }) => Promise<CatStudioPoster>;

  /**
   * Sunday-10am weekly auto-generation.
   *
   * Flow:
   *   1. Find a genre that hasn't been used in the last 3 posters
   *   2. Pick the best reference photo from the past 7 days
   *   3. Call generatePoster, mark it auto:true
   *   4. Cache it (newest-first), evict beyond MAX_POSTERS_PER_CAT
   *   5. Fire `cat_studio_weekly_auto_generated` analytics
   *
   * Idempotent: if the most recent poster is already auto AND was
   * generated after this week's Sunday-10am anchor, this is a no-op.
   * The screen calls this on mount to lazily catch up after a missed
   * Sunday — same pattern as the other weekly schedules.
   *
   * Returns the new poster if generated, or the existing one if it was
   * up-to-date, or null if the screen shouldn't display anything (e.g.
   * cat doesn't exist).
   */
  weeklyAutoGenerate: (catId: string) => Promise<CatStudioPoster | null>;

  /** Read all posters for a cat, newest first. */
  getPostersForCat: (catId: string) => CatStudioPoster[];

  /** Delete a single poster (user can prune). */
  deletePoster: (catId: string, posterId: string) => void;

  /** Wipe all generated posters for a cat (used by GDPR delete). */
  clearForCat: (catId: string) => void;
  clearAll: () => void;
};

export const useCatStudioStore = create<State>()(
  persist(
    (set, get) => ({
      posters: {},
      generating: {},

      generate: async ({ catId, genre, catPhotoBase64 }) => {
        const cat = useCatStore.getState().cats.find((c) => c.id === catId);
        if (!cat) throw new Error('No active cat');

        set((s) => ({ generating: { ...s.generating, [catId]: true } }));
        try {
          const poster = await generatePoster({
            cat,
            genre,
            catPhotoBase64: catPhotoBase64 ?? null,
          });
          set((s) => {
            const existing = s.posters[catId] ?? [];
            const next = [poster, ...existing].slice(0, MAX_POSTERS_PER_CAT);
            return {
              posters: { ...s.posters, [catId]: next },
            };
          });
          // Cloud backup — fire-and-forget. Poster image_uri is local
          // file:// until B3 Storage upload ships.
          void import('../services/sync').then(({ syncCatStudioPosterToCloud }) =>
            syncCatStudioPosterToCloud({
              catId,
              poster: {
                id: (poster as { id: string }).id,
                week_id: (poster as { week_id?: string }).week_id ?? '',
                variant_id: (poster as { genre_id?: string }).genre_id ?? '',
                theme: (poster as { theme?: string }).theme ?? (poster as { genre_id?: string }).genre_id ?? '',
                photo_uri: (poster as { image_uri?: string; photo_uri?: string }).image_uri ?? (poster as { photo_uri?: string }).photo_uri ?? '',
                generated_at: (poster as { generated_at?: string }).generated_at ?? new Date().toISOString(),
                metadata: (poster as { metadata?: Record<string, unknown> }).metadata,
              },
            }).catch(() => {}),
          );
          return poster;
        } finally {
          set((s) => {
            const generating = { ...s.generating };
            delete generating[catId];
            return { generating };
          });
        }
      },

      weeklyAutoGenerate: async (catId) => {
        const cat = useCatStore.getState().cats.find((c) => c.id === catId);
        if (!cat) return null;

        const existing = get().posters[catId] ?? [];
        const anchor = getStudioWeekAnchor();
        const latestAuto = existing.find((p) => p.auto);

        // If we already have an auto-poster generated AFTER this week's
        // Sunday-10am anchor, no work to do — return the existing one.
        if (latestAuto && Date.parse(latestAuto.generated_at) >= anchor.getTime()) {
          return latestAuto;
        }

        // Don't double-fire if a manual generation is already in flight.
        if (get().generating[catId]) return existing[0] ?? null;

        // Pick a genre that doesn't repeat any of the last 3 posters
        const genre = pickFreshGenre({ recentPosters: existing, recentN: 3 });

        // Pick a reference photo from the past 7 days of the gallery.
        // Source-of-truth is photoStudioStore — triage scan + symptom
        // photos are deliberately excluded (they're medical, not
        // poster-flattering).
        const galleryRecent = usePhotoStudioStore
          .getState()
          .getPhotosForCat(catId);
        const refUri = pickWeeklyReferencePhoto({
          cat,
          galleryRecent,
          daysBack: 7,
        });

        // Lazy-load expo-file-system so this module doesn't pay the
        // native-bridge cost on every cold start.
        let catPhotoBase64: string | null = null;
        if (refUri) {
          try {
            const FileSystem = await import('expo-file-system/legacy');
            catPhotoBase64 = await FileSystem.readAsStringAsync(refUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (e) {
            console.warn('[CatStudio] auto-gen: photo read failed:', e);
          }
        }

        set((s) => ({ generating: { ...s.generating, [catId]: true } }));
        try {
          const poster = await generatePoster({
            cat,
            genre,
            catPhotoBase64,
          });
          const autoPoster: CatStudioPoster = { ...poster, auto: true };
          set((s) => {
            const list = s.posters[catId] ?? [];
            const next = [autoPoster, ...list].slice(0, MAX_POSTERS_PER_CAT);
            return { posters: { ...s.posters, [catId]: next } };
          });
          // Cloud backup — same as manual generation path.
          void import('../services/sync').then(({ syncCatStudioPosterToCloud }) =>
            syncCatStudioPosterToCloud({
              catId,
              poster: {
                id: (autoPoster as { id: string }).id,
                week_id: (autoPoster as { week_id?: string }).week_id ?? '',
                variant_id: (autoPoster as { genre_id?: string }).genre_id ?? '',
                theme: (autoPoster as { theme?: string }).theme ?? (autoPoster as { genre_id?: string }).genre_id ?? '',
                photo_uri: (autoPoster as { image_uri?: string; photo_uri?: string }).image_uri ?? (autoPoster as { photo_uri?: string }).photo_uri ?? '',
                generated_at: (autoPoster as { generated_at?: string }).generated_at ?? new Date().toISOString(),
                metadata: (autoPoster as { metadata?: Record<string, unknown> }).metadata,
              },
            }).catch(() => {}),
          );
          // Telemetry — distinct from the manual cat_studio_poster_generated
          // event so we can measure the weekly auto-pipeline separately
          // (open-rate from notification, edit-rate, etc).
          track({
            type: 'cat_studio_weekly_auto_generated',
            props: {
              genre: genre.id,
              had_reference_photo: !!catPhotoBase64,
              recent_genres_skipped: existing.slice(0, 3).map((p) => p.genre_id).join(','),
            },
          });
          return autoPoster;
        } catch (e) {
          console.warn('[CatStudio] weeklyAutoGenerate failed:', e);
          track({
            type: 'cat_studio_weekly_auto_failed',
            props: { reason: e instanceof Error ? e.message.slice(0, 200) : 'unknown' },
          });
          return null;
        } finally {
          set((s) => {
            const generating = { ...s.generating };
            delete generating[catId];
            return { generating };
          });
        }
      },

      getPostersForCat: (catId) => get().posters[catId] ?? [],

      deletePoster: (catId, posterId) =>
        set((s) => {
          const list = s.posters[catId] ?? [];
          return {
            posters: { ...s.posters, [catId]: list.filter((p) => p.id !== posterId) },
          };
        }),

      clearForCat: (catId) =>
        set((s) => {
          const posters = { ...s.posters };
          delete posters[catId];
          const generating = { ...s.generating };
          delete generating[catId];
          return { posters, generating };
        }),

      clearAll: () => set({ posters: {}, generating: {} }),
    }),
    {
      name: 'catmd-cat-studio',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Don't persist the transient generating flags
      partialize: (state) => ({ posters: state.posters }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

/**
 * Module-level stable empty array — same fix as chatStore + diaryStore.
 * Without this, `?? []` returns a new empty array each render and
 * Zustand triggers an infinite re-render loop ("Maximum update depth
 * exceeded").
 */
const EMPTY_POSTERS: CatStudioPoster[] = Object.freeze([]) as unknown as CatStudioPoster[];

export function useCatStudioPosters(catId: string | null | undefined): CatStudioPoster[] {
  return useCatStudioStore((s) =>
    catId ? s.posters[catId] ?? EMPTY_POSTERS : EMPTY_POSTERS,
  );
}

export function useCatStudioGenerating(catId: string | null | undefined): boolean {
  return useCatStudioStore((s) => (catId ? !!s.generating[catId] : false));
}
