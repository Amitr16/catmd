/**
 * Postcard store — caches generated postcards per cat per day.
 *
 * Cache key: `${catId}:${YYYY-MM-DD}`. Idempotent — generating today's
 * postcard a second time returns the cached one unless `force: true`
 * is passed (e.g., user tapped "Regenerate caption" or "Refresh
 * photos").
 *
 * Editable caption: when the user edits the AI-generated caption, we
 * mutate the cached postcard in place via `updateCaption`. Original AI
 * caption is preserved on `caption_ai_original` so we can offer a
 * "reset to AI version" UX and track edit-rate as a quality signal.
 *
 * Storage: AsyncStorage via Zustand persist (same pattern as diaryStore).
 *
 * Stable empty array constant + useMemo selector pattern prevents the
 * Zustand infinite-render-loop bug we hit with the diary store earlier
 * this session.
 */
import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  gatherTodaysPhotos,
  generatePostcard,
  todayKey,
  type Postcard,
  type PostcardPhoto,
} from '../services/postcard';
import { localDateKey } from '../services/photoStudio';
import { useCatStore } from './catStore';
import { useHealthStore } from './healthStore';
import { useScanStore } from './scanStore';
import { usePhotoStudioStore } from './photoStudioStore';
import { usePersonalityStore } from './personalityStore';
import { hasEnoughDataForReveal } from '../services/personality';
import { track } from '../services/analytics';

const MAX_POSTCARDS_PER_CAT = 90; // ~3 months of daily postcards

type State = {
  /** Per-cat postcard cache, key: `${catId}:${YYYY-MM-DD}`. */
  postcards: Record<string, Postcard>;
  /** Whether a generation is in flight per cat. */
  generating: Record<string, boolean>;

  /**
   * Generate (or fetch cached) today's postcard for the cat. Returns
   * null if no photos exist for today (the screen surfaces an
   * empty-state CTA prompting the user to capture one).
   *
   * `force: true` regenerates the caption even when cached.
   * `force: 'photos_only'` re-aggregates photos without a new caption
   *   (used when user tapped "Refresh photos" but kept the caption).
   */
  generateForToday: (
    catId: string,
    opts?: { force?: boolean | 'photos_only' },
  ) => Promise<Postcard | null>;

  /** Update the editable caption in place — keeps caption_ai_original. */
  updateCaption: (catId: string, date: string, caption: string) => void;

  /** Read today's cached postcard without generating. */
  getTodaysPostcard: (catId: string) => Postcard | null;

  /** All cached postcards for a cat, newest first. */
  getPostcardsForCat: (catId: string) => Postcard[];

  /**
   * Drop the cached postcard for today (active local date). Used when
   * the cached postcard's photos are dead (user deleted gallery photos
   * after the postcard was generated) so the screen can fall through
   * to the empty-state CTA instead of rendering broken images.
   */
  clearTodayForCat: (catId: string) => void;

  /** Wipe by cat (GDPR delete). */
  clearForCat: (catId: string) => void;
  clearAll: () => void;
};

function entryKey(catId: string, date: string): string {
  return `${catId}:${date}`;
}

export const usePostcardStore = create<State>()(
  persist(
    (set, get) => ({
      postcards: {},
      generating: {},

      generateForToday: async (catId, opts = {}) => {
        const force = opts.force === true;
        const photosOnly = opts.force === 'photos_only';
        const today = todayKey();
        const key = entryKey(catId, today);

        // Pull fresh peer-store state
        const cat = useCatStore.getState().cats.find((c) => c.id === catId);
        if (!cat) throw new Error('No active cat');

        // Postcard photo source: TODAY's photos from the canonical
        // gallery (photoStudioStore). Triage scan + symptom photos are
        // intentionally excluded — they're medical context, not social.
        const todayKeyLocal = localDateKey();
        const galleryToday = usePhotoStudioStore
          .getState()
          .getPhotosForDate(catId, todayKeyLocal);
        // max: 3 — we randomly sample 3 from today's pool. Was 4 when
        // the daily photo cap was 4 (so all 4 always made the collage);
        // now that photos are unlimited, 3 keeps the collage tight and
        // gives variety across re-rolls.
        const photos = gatherTodaysPhotos({ cat, galleryToday, max: 3 });
        if (photos.length === 0) return null;

        // photos_only path: keep caption, refresh photos array
        if (photosOnly) {
          const cached = get().postcards[key];
          if (cached) {
            const updated: Postcard = { ...cached, photos };
            set((s) => ({ postcards: { ...s.postcards, [key]: updated } }));
            return updated;
          }
          // Fall through to full generation if nothing cached.
        }

        // Cache hit (and not forced regenerate) → return cached
        if (!force && !photosOnly) {
          const cached = get().postcards[key];
          if (cached) return cached;
        }

        // Mark generating
        set((s) => ({ generating: { ...s.generating, [catId]: true } }));

        try {
          const personalityProfile = usePersonalityStore
            .getState()
            .getProfile(catId);
          const archetype =
            personalityProfile && hasEnoughDataForReveal(personalityProfile)
              ? personalityProfile.archetype
              : null;

          // Probe whether each event-type happened today (drives the
          // prompt's day-vibe context). Scan + symptom photos no longer
          // feed the postcard collage (they're medical, not social), but
          // the FACT that a scan happened today is still useful prompt
          // context for the LLM caption.
          const todayKeyStr = today;
          const isToday = (iso: string) => {
            try {
              const d = new Date(iso);
              const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              return k === todayKeyStr;
            } catch {
              return false;
            }
          };
          const events = useHealthStore.getState().events;
          const scans = useScanStore.getState().scans;
          const todays = events.filter((e) => e.cat_id === catId && isToday(e.ts));
          const hasCheckinToday = todays.some((e) => e.type === 'daily_checkin');
          const hasReadCatToday = todays.some((e) => e.type === 'behavior_observation');
          const hasScanToday = scans.some(
            (s) => s.cat_id === catId && isToday(s.created_at),
          );

          // Most-recent check-in mood today (drives caption mood word)
          const todaysCheckin = todays
            .filter((e) => e.type === 'daily_checkin')
            .sort((a, b) => b.ts.localeCompare(a.ts))[0];
          const todaysMood = todaysCheckin
            ? ((todaysCheckin.payload as { mood?: string }).mood ?? null)
            : null;

          // Body-language tags from today's Read session (if any) —
          // give the caption something concrete to riff off.
          const bodyLanguageTags = todays
            .filter((e) => e.type === 'behavior_observation')
            .flatMap((e) => (e.payload as { tags?: string[] }).tags ?? [])
            .slice(0, 5);

          // Birthday / adoption-iversary today (calendar-match on MM-DD)
          const isBirthday = (() => {
            if (!cat.dob_iso) return false;
            try {
              const dob = new Date(cat.dob_iso);
              const now = new Date();
              return dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate();
            } catch {
              return false;
            }
          })();
          const isAdoptionIversary = (() => {
            if (!cat.adopted_on_iso) return false;
            try {
              const adopted = new Date(cat.adopted_on_iso);
              const now = new Date();
              return (
                adopted.getMonth() === now.getMonth() &&
                adopted.getDate() === now.getDate()
              );
            } catch {
              return false;
            }
          })();

          // Streak milestone landed today (matches diary's milestone set)
          const STREAK_MILESTONES = [7, 14, 30, 60, 90, 180, 365];
          const checkinDays = new Set(
            events
              .filter((e) => e.cat_id === catId && e.type === 'daily_checkin')
              .map((e) => {
                const d = new Date(e.ts);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              }),
          );
          let currentStreak = 0;
          {
            const cursor = new Date();
            cursor.setHours(0, 0, 0, 0);
            while (
              checkinDays.has(
                `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
              )
            ) {
              currentStreak++;
              cursor.setDate(cursor.getDate() - 1);
            }
          }
          const streakMilestone = STREAK_MILESTONES.includes(currentStreak)
            ? currentStreak
            : null;

          const postcard = await generatePostcard({
            cat,
            photos,
            archetype,
            hasCheckinToday,
            hasScanToday,
            hasReadCatToday,
            todaysMood,
            bodyLanguageTags,
            streakMilestone,
            isBirthday,
            isAdoptionIversary,
          });

          // Cache + prune to MAX
          set((s) => {
            const next = { ...s.postcards, [key]: postcard };
            const forCat = Object.entries(next)
              .filter(([k]) => k.startsWith(`${catId}:`))
              .sort(([a], [b]) => b.localeCompare(a));
            if (forCat.length > MAX_POSTCARDS_PER_CAT) {
              for (const [oldKey] of forCat.slice(MAX_POSTCARDS_PER_CAT)) {
                delete next[oldKey];
              }
            }
            return { postcards: next };
          });

          // Cloud backup — fire-and-forget. Photo URIs are local file://
          // until B3 (Storage upload); cross-device restore will see the
          // postcard text but the photos won't render until B3 ships.
          void import('../services/sync').then(({ syncPostcardToCloud }) =>
            syncPostcardToCloud({
              catId,
              postcard: {
                id: postcard.id,
                date: postcard.date,
                caption: postcard.caption,
                caption_ai_original: postcard.caption_ai_original,
                photos: postcard.photos.map((p) => ({
                  uri: p.uri,
                  width: p.width,
                  height: p.height,
                })),
                generated_at: postcard.generated_at,
              },
            }).catch(() => {}),
          );

          track({
            type: 'postcard_generated',
            props: {
              photo_count: postcard.photos.length,
              had_archetype: archetype !== null,
              forced_regenerate: force,
            },
          });
          // Unified activation event for marketing-attribution funnels
          // (audit 2026-05-16). Fires alongside postcard_generated.
          track({ type: 'core_feature_used', props: { feature: 'postcard' } });

          return postcard;
        } catch (e) {
          track({
            type: 'postcard_generation_failed',
            props: {
              reason: (e instanceof Error ? e.message : 'unknown').slice(0, 200),
            },
          });
          throw e;
        } finally {
          set((s) => {
            const generating = { ...s.generating };
            delete generating[catId];
            return { generating };
          });
        }
      },

      updateCaption: (catId, date, caption) =>
        set((s) => {
          const k = entryKey(catId, date);
          const existing = s.postcards[k];
          if (!existing) return s;
          return {
            postcards: {
              ...s.postcards,
              [k]: { ...existing, caption },
            },
          };
        }),

      getTodaysPostcard: (catId) =>
        get().postcards[entryKey(catId, todayKey())] ?? null,

      getPostcardsForCat: (catId) =>
        Object.values(get().postcards)
          .filter((p) => p.cat_id === catId)
          .sort((a, b) => b.date.localeCompare(a.date)),

      clearTodayForCat: (catId) =>
        set((s) => {
          const today = todayKey();
          const key = entryKey(catId, today);
          if (!s.postcards[key]) return s;
          const postcards = { ...s.postcards };
          delete postcards[key];
          return { postcards };
        }),

      clearForCat: (catId) =>
        set((s) => {
          const postcards = { ...s.postcards };
          for (const k of Object.keys(postcards)) {
            if (k.startsWith(`${catId}:`)) delete postcards[k];
          }
          const generating = { ...s.generating };
          delete generating[catId];
          return { postcards, generating };
        }),

      clearAll: () => set({ postcards: {}, generating: {} }),
    }),
    {
      name: 'catmd-postcards',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ postcards: state.postcards }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Convenience hooks (stable-reference pattern — see diaryStore for why)
// ---------------------------------------------------------------------------

export function useTodaysPostcard(catId: string | null | undefined): Postcard | null {
  return usePostcardStore((s) =>
    catId ? s.postcards[entryKey(catId, todayKey())] ?? null : null,
  );
}

export function usePostcardGenerating(catId: string | null | undefined): boolean {
  return usePostcardStore((s) => (catId ? !!s.generating[catId] : false));
}

/** All cached postcards for a cat, newest first. Stable selector. */
export function usePostcardsForCat(catId: string | null | undefined): Postcard[] {
  const postcards = usePostcardStore((s) => s.postcards);
  return useMemo(() => {
    if (!catId) return [] as Postcard[];
    return Object.values(postcards)
      .filter((p) => p.cat_id === catId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [postcards, catId]);
}

/** Helper to detect whether today has any photos worth posting. */
export function hasPhotosForTodayPostcard(catId: string | null | undefined): boolean {
  if (!catId) return false;
  const cat = useCatStore.getState().cats.find((c) => c.id === catId);
  if (!cat) return false;
  const galleryToday = usePhotoStudioStore
    .getState()
    .getPhotosForDate(catId, localDateKey());
  const photos = gatherTodaysPhotos({ cat, galleryToday, max: 4 });
  return photos.length > 0;
}
