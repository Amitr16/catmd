/**
 * EmailNudgeStore — drives the "add an email so {Cat} remembers you on
 * a new phone" nudge on the Today tab.
 *
 * Why this exists: CatMD is anonymous-first by design. The downside of
 * anonymous is everything (diary, personality, photos, named people)
 * lives on this device. A factory reset, lost phone, or fresh install
 * loses it all. Adding a verified email links the device to a Supabase
 * account and lets the data survive — but anonymous users won't add an
 * email unless they understand the trade-off in CAT terms ("Lily
 * remembers you on a new phone"), not user terms ("data backup").
 *
 * Cadence: don't pester. Escalating-snooze pattern:
 *
 *   - First show: Day 3+ since install (let onboarding settle)
 *   - 1st "Not now":  snooze 7 days
 *   - 2nd "Not now":  snooze 14 days
 *   - 3rd "Not now":  snooze 30 days
 *   - 4th "Not now":  permanent (still reachable via Settings → Add email)
 *
 * Skipped automatically once `hasConfirmedEmail` flips true — see the
 * banner component for the auth-state read.
 *
 * Persists in AsyncStorage so the cadence survives app kills.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type State = {
  /** ms timestamp of the first time the store was hydrated (proxy for install). */
  firstSeenTs: number | null;
  /** ms timestamp last time the banner was shown. */
  lastShownTs: number | null;
  /** Total times the user tapped "Not now". */
  dismissCount: number;
  /** ms timestamp the next nudge is allowed (null = no snooze). */
  snoozeUntil: number | null;
  /** True after the 4th dismiss — hide permanently from passive surfaces. */
  permanentlyDismissed: boolean;

  /** Mark the first time the store hydrates so we can age the user. */
  ensureFirstSeen: () => void;
  /** Read-only helper: should the banner render right now? */
  shouldShow: (opts: { hasConfirmedEmail: boolean }) => boolean;
  /** Record that the banner was rendered (debounce same-day re-shows). */
  markShown: () => void;
  /** User tapped "Not now" → snooze with escalating cadence. */
  dismiss: () => void;
  /** Reset everything — used on email-confirmed transition so a future
   *  unlink (rare edge case) doesn't immediately re-nudge. */
  reset: () => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const SNOOZE_LADDER: number[] = [
  7 * DAY_MS,   // 1st dismiss → 7 days
  14 * DAY_MS,  // 2nd → 14 days
  30 * DAY_MS,  // 3rd → 30 days
  // 4th → permanently_dismissed instead of further snoozing
];

const MIN_INSTALL_AGE_MS = 3 * DAY_MS; // don't nudge during onboarding window
const SAME_DAY_REPRESS_MS = 18 * 60 * 60 * 1000; // don't re-show within 18h

export const useEmailNudgeStore = create<State>()(
  persist(
    (set, get) => ({
      firstSeenTs: null,
      lastShownTs: null,
      dismissCount: 0,
      snoozeUntil: null,
      permanentlyDismissed: false,

      ensureFirstSeen: () => {
        if (get().firstSeenTs == null) {
          set({ firstSeenTs: Date.now() });
        }
      },

      shouldShow: ({ hasConfirmedEmail }) => {
        if (hasConfirmedEmail) return false;
        const s = get();
        if (s.permanentlyDismissed) return false;
        const now = Date.now();
        if (s.snoozeUntil != null && now < s.snoozeUntil) return false;
        if (s.firstSeenTs == null) return false;
        if (now - s.firstSeenTs < MIN_INSTALL_AGE_MS) return false;
        if (s.lastShownTs != null && now - s.lastShownTs < SAME_DAY_REPRESS_MS) {
          return false;
        }
        return true;
      },

      markShown: () => {
        set({ lastShownTs: Date.now() });
      },

      dismiss: () => {
        const s = get();
        const nextCount = s.dismissCount + 1;
        if (nextCount > SNOOZE_LADDER.length) {
          set({ dismissCount: nextCount, permanentlyDismissed: true, snoozeUntil: null });
        } else {
          const ladderIdx = nextCount - 1;
          set({
            dismissCount: nextCount,
            snoozeUntil: Date.now() + SNOOZE_LADDER[ladderIdx],
          });
        }
      },

      reset: () => {
        set({
          dismissCount: 0,
          snoozeUntil: null,
          permanentlyDismissed: false,
          lastShownTs: null,
          // firstSeenTs is NOT reset — it's the install-age anchor
        });
      },
    }),
    {
      name: '@catmd/email_nudge_v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Migration-safe: when we add new fields in the future, partialize
      // returns the current shape and unknown fields get default values.
    },
  ),
);
