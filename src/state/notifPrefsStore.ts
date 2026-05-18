/**
 * Notification preferences — per-category opt-in toggles + scheduled-id
 * tracking so we can cancel/re-schedule cleanly when the user toggles
 * a category off.
 *
 * Design: a single Zustand store, persisted via async-storage (same
 * pattern as catStore + healthStore). Each category has an `enabled`
 * flag and (optionally) a `scheduledId` for the in-flight notification.
 *
 * Categories chosen for 0.1.5:
 *   - daily_checkin       (existing — managed by cat-profile reminder UI)
 *   - medication          (existing — managed by cat-profile reminder UI)
 *   - birthday            (NEW — yearly, scheduled when DOB is set)
 *   - adoption_iversary   (NEW — yearly, scheduled when adopted_on is set)
 *   - streak_milestone    (NEW — fired by healthStore on milestone hit)
 *   - insight             (NEW — fired by CatContext-pattern triggers)
 *   - weekly_read_nudge   (NEW — Sunday 7pm if no behaviour-obs in past 7d)
 *
 * The user-facing Settings → Notifications screen lets owners toggle
 * each category. Disabled categories don't fire even if their schedule
 * trigger condition is met.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type NotifCategory =
  | 'daily_checkin'
  | 'medication'
  | 'birthday'
  | 'adoption_iversary'
  | 'streak_milestone'
  | 'insight'
  | 'weekly_read_nudge'
  | 'diary_entry'
  | 'postcard_ready'
  | 'cat_studio_poster'
  | 'outcome_check'
  | 'daily_photo_studio'
  /**
   * Cat-voice evening push — fires at 19:00 with a 1-liner pulled
   * from today's diary entry as the body. The Co-Star-shaped lock-
   * screen-shareable push (see marketing/chat-as-viral-lever.md §2).
   * Re-armed each time a fresh diary entry is generated.
   */
  | 'cat_voice_evening'
  /**
   * Weekly "she noticed" reading — Sunday 19:00 push that opens the
   * /weekly-reading screen where the cat reads the HUMAN. Implements
   * marketing/chat-as-viral-lever.md §5.
   */
  | 'weekly_reading'
  /**
   * Morning Mew — daily 8:00 AM push that fires a mood-shaped "good
   * morning" line from the cat's voice. Body = pickMorningGreeting()
   * for today's mood. Tap → opens /daily-card. Daily ritual hook —
   * the cat is the first voice the user hears every morning.
   * Added 2026-05-13.
   */
  | 'morning_mew';

export type NotifPrefs = {
  // Per-category enabled flags (all default ON; user opts out)
  enabled: Record<NotifCategory, boolean>;

  // In-flight scheduled notification ids — used to cancel/replace cleanly.
  // Key: cat_id + ':' + category. Value: expo-notifications id string.
  scheduledIds: Record<string, string>;

  // Diary daily-reminder rolling window (added 2026-05-09 with the
  // 7pm-gate diary redesign). Stores up to 7 scheduled push IDs per
  // cat — one per upcoming day. On every app foreground we cancel
  // these and reschedule for the next 7 days, so a user who stops
  // opening the app stops getting "diary is waiting" pushes after
  // ~7 quiet days. Stored separately from scheduledIds because that
  // map's one-id-per-category contract doesn't fit a multi-id case.
  diaryReminderIds: Record<string, string[]>;
};

type Actions = {
  setEnabled: (category: NotifCategory, enabled: boolean) => void;
  setScheduledId: (
    catId: string,
    category: NotifCategory,
    id: string | null,
  ) => void;
  getScheduledId: (catId: string, category: NotifCategory) => string | null;
  setDiaryReminderIds: (catId: string, ids: string[]) => void;
  getDiaryReminderIds: (catId: string) => string[];
  clearAll: () => void;
};

const defaultEnabled: Record<NotifCategory, boolean> = {
  daily_checkin: true,
  medication: true,
  birthday: true,
  adoption_iversary: true,
  streak_milestone: true,
  insight: true,
  weekly_read_nudge: true,
  diary_entry: true,
  postcard_ready: true,
  cat_studio_poster: true,
  outcome_check: true,
  daily_photo_studio: true,
  cat_voice_evening: true,
  weekly_reading: true,
  morning_mew: true,
};

export const useNotifPrefsStore = create<NotifPrefs & Actions>()(
  persist(
    (set, get) => ({
      enabled: { ...defaultEnabled },
      scheduledIds: {},
      diaryReminderIds: {},

      setEnabled: (category, enabled) => {
        set((state) => ({
          enabled: { ...state.enabled, [category]: enabled },
        }));
        // Cloud backup — single row per user, full enabled map. Push
        // the merged result so cloud always reflects the user's
        // latest opt-in state.
        const next = get().enabled;
        void import('../services/sync').then(({ syncNotifPrefsToCloud }) =>
          syncNotifPrefsToCloud(next as Record<string, boolean>).catch(() => {}),
        );
      },

      setScheduledId: (catId, category, id) =>
        set((state) => {
          const key = `${catId}:${category}`;
          const next = { ...state.scheduledIds };
          if (id) {
            next[key] = id;
          } else {
            delete next[key];
          }
          return { scheduledIds: next };
        }),

      getScheduledId: (catId, category) => {
        const key = `${catId}:${category}`;
        return get().scheduledIds[key] ?? null;
      },

      setDiaryReminderIds: (catId, ids) =>
        set((state) => ({
          diaryReminderIds: { ...state.diaryReminderIds, [catId]: ids },
        })),

      getDiaryReminderIds: (catId) => get().diaryReminderIds[catId] ?? [],

      clearAll: () =>
        set({
          enabled: { ...defaultEnabled },
          scheduledIds: {},
          diaryReminderIds: {},
        }),
    }),
    {
      name: 'catmd-notif-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/** Convenience hook for a single category's enabled flag. */
export function useNotifEnabled(category: NotifCategory): boolean {
  return useNotifPrefsStore((s) => s.enabled[category] ?? true);
}
