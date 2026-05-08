/**
 * Per-cat reminder configuration + scheduled-notification IDs.
 *
 * Pattern: UI calls `setMedReminder(catId, time)` — the store cancels any
 * existing scheduled notification for that cat, schedules the new one via
 * expo-notifications, and stores the returned identifier. Deleting a cat
 * or disabling the reminder cancels cleanly.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  cancelNotification,
  scheduleDailyAt,
  scheduleWeeklyAt,
  parseHHMM,
} from '../services/notifications';

export type CatReminders = {
  med_time: string | null;         // "HH:MM" local — daily medication reminder
  med_notif_id: string | null;     // expo-notifications identifier
  checkin_time: string | null;     // "HH:MM" local — weekly check-in
  checkin_weekday: number | null;  // 1-7 (1=Sunday)
  checkin_notif_id: string | null;
};

type State = {
  byCat: Record<string, CatReminders>;
  get: (catId: string) => CatReminders;

  setMedReminder: (
    catId: string,
    time: string | null,
    context: { catName: string; meds: string[] },
  ) => Promise<void>;

  setCheckinReminder: (
    catId: string,
    weekday: number | null,
    time: string | null,
    context: { catName: string },
  ) => Promise<void>;

  clearForCat: (catId: string) => Promise<void>;
};

const EMPTY: CatReminders = {
  med_time: null,
  med_notif_id: null,
  checkin_time: null,
  checkin_weekday: null,
  checkin_notif_id: null,
};

export const useNotificationStore = create<State>()(
  persist(
    (set, get) => ({
      byCat: {},

      get: (catId) => get().byCat[catId] ?? EMPTY,

      setMedReminder: async (catId, time, context) => {
        const cur = get().byCat[catId] ?? EMPTY;
        await cancelNotification(cur.med_notif_id);

        let newId: string | null = null;
        const parsed = parseHHMM(time);
        if (parsed) {
          const medsLine = context.meds.length > 0
            ? context.meds.slice(0, 3).join(', ')
            : 'scheduled medication';
          newId = await scheduleDailyAt({
            hour: parsed.hour,
            minute: parsed.minute,
            title: `${context.catName}'s medication`,
            body: `Time to give ${medsLine}.`,
            data: { type: 'med', catId },
          });
        }

        set((s) => ({
          byCat: {
            ...s.byCat,
            [catId]: {
              ...cur,
              med_time: parsed ? time : null,
              med_notif_id: newId,
            },
          },
        }));
        // Cloud backup — push the new reminder state. notif_id stays
        // device-local (never round-tripped). Read fresh from store so
        // we get checkin_time too if it was set previously.
        const after = get().byCat[catId] ?? EMPTY;
        void import('../services/sync').then(({ syncCatRemindersToCloud }) =>
          syncCatRemindersToCloud({
            catId,
            medTime: after.med_time,
            checkinTime: after.checkin_time,
            checkinWeekday: after.checkin_weekday,
          }).catch(() => {}),
        );
      },

      setCheckinReminder: async (catId, weekday, time, context) => {
        const cur = get().byCat[catId] ?? EMPTY;
        await cancelNotification(cur.checkin_notif_id);

        let newId: string | null = null;
        const parsed = parseHHMM(time);
        if (parsed && weekday != null && weekday >= 1 && weekday <= 7) {
          newId = await scheduleWeeklyAt({
            weekday,
            hour: parsed.hour,
            minute: parsed.minute,
            title: `How is ${context.catName} doing?`,
            body: 'Tap to run a weekly check-in scan.',
            data: { type: 'checkin', catId },
          });
        }

        set((s) => ({
          byCat: {
            ...s.byCat,
            [catId]: {
              ...cur,
              checkin_time: parsed ? time : null,
              checkin_weekday: weekday,
              checkin_notif_id: newId,
            },
          },
        }));
        // Cloud backup — same pattern as setMedReminder.
        const after = get().byCat[catId] ?? EMPTY;
        void import('../services/sync').then(({ syncCatRemindersToCloud }) =>
          syncCatRemindersToCloud({
            catId,
            medTime: after.med_time,
            checkinTime: after.checkin_time,
            checkinWeekday: after.checkin_weekday,
          }).catch(() => {}),
        );
      },

      clearForCat: async (catId) => {
        const cur = get().byCat[catId];
        if (!cur) return;
        await Promise.all([
          cancelNotification(cur.med_notif_id),
          cancelNotification(cur.checkin_notif_id),
        ]);
        set((s) => {
          const next = { ...s.byCat };
          delete next[catId];
          return { byCat: next };
        });
      },
    }),
    {
      name: 'catmd-notifications',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
