/**
 * Notifications — Expo wrapper for CatMD's reminder + engagement pushes.
 *
 * Categories (each toggled per-cat in notifPrefsStore):
 *   1. daily_checkin       — daily, user-set time (cat-profile reminder UI)
 *   2. medication          — daily, user-set time (cat-profile reminder UI)
 *   3. birthday            — yearly, scheduled when DOB is set
 *   4. adoption_iversary   — yearly, scheduled when adopted_on is set
 *   5. streak_milestone    — fired ad-hoc by healthStore at 7/14/30/60/90/180/365
 *   6. insight             — fired ad-hoc by healthStore on pattern triggers
 *   7. weekly_read_nudge   — re-armed 7 days post each behaviour observation
 *   8. diary_entry         — daily 19:00 generic "tap to read" — SUPPRESSED while cat_voice_evening is on
 *   9. postcard_ready      — daily 19:00 social-card prompt
 *  10. cat_studio_poster   — weekly Sunday 10:00 movie-poster reveal
 *  11. outcome_check       — ad-hoc, follows up on triage scans
 *  12. daily_photo_studio  — daily 11:00 "snap a photo" nudge
 *  13. cat_voice_evening   — daily 19:00, body = real cat-voice 1-liner from
 *                            today's diary; replaces the generic diary_entry
 *                            ping when enabled (viral-lever feature, see
 *                            marketing/chat-as-viral-lever.md §2)
 *  14. weekly_reading      — Sunday 19:00, body = mood-agnostic teaser, opens
 *                            the /weekly-reading screen where the cat reads
 *                            the human (viral-lever §5)
 *
 * Trust rails (HARD rules — see comment block below):
 *   - Quiet hours 22:00–08:00 local: any one-shot scheduled inside this
 *     window is shifted forward to 08:00.
 *   - Daily cap: streak/insight pushes consume a single "ad-hoc slot" per
 *     day. Daily / annual reminders are exempt (user opted into time).
 *
 * Identifiers are stored in notifPrefsStore (key: `${catId}:${category}`)
 * so we can cancel/replace cleanly when the user toggles off, deletes a
 * cat, or re-saves a profile.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const NOTIF_CHANNEL = 'catmd-reminders';

// ---------------------------------------------------------------------------
// Trust rails — quiet hours + daily cap
// ---------------------------------------------------------------------------
//
// Cats are not the kind of audience you train to swipe-away push fatigue.
// We promise (in onboarding + Settings) two hard rules:
//
//   1. No pushes between 22:00 and 08:00 local time.
//   2. At most one "ad-hoc" push per day (streak / insight / nudge).
//
// Daily reminders (medication, daily check-in) are user-scheduled at a
// time they pick, so they bypass the cap (the user opted into that exact
// minute). Annual reminders (birthday, adoption-iversary) also bypass —
// they are at most twice/year per cat, the user is expecting them, and
// missing them would defeat the point. Quiet hours still apply to *all*
// scheduled fires below.

const QUIET_HOURS_START = 22; // inclusive — no fires from 22:00…
const QUIET_HOURS_END = 8;    // …until 08:00 the next morning.

function isInQuietHours(hour: number): boolean {
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

/**
 * If `d` falls inside quiet hours, shift forward to 08:00 of the
 * appropriate day. Returns a new Date; never mutates the input.
 */
export function shiftOutOfQuietHours(d: Date): Date {
  const out = new Date(d.getTime());
  const h = out.getHours();
  if (!isInQuietHours(h)) return out;
  if (h < QUIET_HOURS_END) {
    // Early morning — same day at 08:00.
    out.setHours(QUIET_HOURS_END, 0, 0, 0);
  } else {
    // Late evening — bump to next day at 08:00.
    out.setDate(out.getDate() + 1);
    out.setHours(QUIET_HOURS_END, 0, 0, 0);
  }
  return out;
}

const LAST_PUSH_DATE_KEY = 'catmd-notif-last-push-date';

function todayKey(): string {
  // Local-date YYYY-MM-DD (NOT toISOString — that's UTC).
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Atomically claim today's "1 ad-hoc push" slot.
 *  - Returns true → caller may fire; storage now records today as used.
 *  - Returns false → already fired something today, caller must skip.
 *
 * Soft-fails open (returns true) on storage errors so a transient
 * AsyncStorage hiccup doesn't make us swallow notifications silently.
 */
export async function claimDailyPushSlot(): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(LAST_PUSH_DATE_KEY);
    const today = todayKey();
    if (last === today) return false;
    await AsyncStorage.setItem(LAST_PUSH_DATE_KEY, today);
    return true;
  } catch {
    return true;
  }
}

// Foreground handler — show the banner while app is open. Safe to set once.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let channelInitialized = false;

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || channelInitialized) return;
  await Notifications.setNotificationChannelAsync(NOTIF_CHANNEL, {
    name: 'CatMD reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#5B8A7A',
  });
  channelInitialized = true;
}

/** Returns true if permission is granted; prompts if not yet decided. */
export async function ensureNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  if (settings.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync();
    return !!req.granted;
  }
  return false;
}

export type TimeOfDay = { hour: number; minute: number };

export function parseHHMM(v: string | null | undefined): TimeOfDay | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { hour: h, minute: min };
}

export function formatHHMM(t: TimeOfDay): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

/** Schedule a daily recurring notification. Returns the identifier. */
export async function scheduleDailyAt(opts: {
  hour: number;
  minute: number;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<string | null> {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  await ensureAndroidChannel();
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data ?? {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: opts.hour,
        minute: opts.minute,
        channelId: NOTIF_CHANNEL,
      } as any,
    });
  } catch (e) {
    console.warn('[CatMD] scheduleDailyAt:', e);
    return null;
  }
}

/**
 * Schedule a one-shot notification at a specific future timestamp.
 * Returns the identifier, or null if permission denied or the date is in the past.
 */
export async function scheduleOneTimeAt(opts: {
  fireAt: Date;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Set true to bypass quiet-hours shifting (e.g. for tests). */
  bypassQuietHours?: boolean;
}): Promise<string | null> {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  await ensureAndroidChannel();
  const fireAt = opts.bypassQuietHours
    ? opts.fireAt
    : shiftOutOfQuietHours(opts.fireAt);
  const seconds = Math.round((fireAt.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data ?? {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
        channelId: NOTIF_CHANNEL,
      } as any,
    });
  } catch (e) {
    console.warn('[CatMD] scheduleOneTimeAt:', e);
    return null;
  }
}

/** Schedule a weekly recurring notification. Weekday: 1=Sun…7=Sat (expo). */
export async function scheduleWeeklyAt(opts: {
  weekday: number;           // 1-7
  hour: number;
  minute: number;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<string | null> {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  await ensureAndroidChannel();
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data ?? {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: opts.weekday,
        hour: opts.hour,
        minute: opts.minute,
        channelId: NOTIF_CHANNEL,
      } as any,
    });
  } catch (e) {
    console.warn('[CatMD] scheduleWeeklyAt:', e);
    return null;
  }
}

export async function cancelNotification(id: string | null | undefined) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    console.warn('[CatMD] cancelNotification:', e);
  }
}

/**
 * Schedule a yearly anniversary notification at 09:00 local time on a
 * fixed MM-DD. Used for cat birthdays + adoption-iversaries.
 *
 * Implementation note: expo-notifications doesn't have a native "yearly"
 * trigger, so we schedule the next occurrence as a one-shot. When the
 * notification fires (or when the user re-saves the cat profile), we
 * reschedule for the next year. The rescheduling is handled by the
 * caller — usually cat-profile.tsx on save.
 */
export async function scheduleAnnualAt(opts: {
  monthIndex: number;        // 0-11 (Jan = 0)
  day: number;               // 1-31
  hour?: number;             // default 9
  minute?: number;           // default 0
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<string | null> {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  await ensureAndroidChannel();

  const now = new Date();
  const hour = opts.hour ?? 9;
  const minute = opts.minute ?? 0;

  // Compute the next occurrence (this year if still upcoming, else next year).
  let fireAt = new Date(now.getFullYear(), opts.monthIndex, opts.day, hour, minute, 0, 0);
  if (fireAt.getTime() <= now.getTime()) {
    fireAt = new Date(now.getFullYear() + 1, opts.monthIndex, opts.day, hour, minute, 0, 0);
  }
  // Validate (e.g. Feb 30 → invalid)
  if (Number.isNaN(fireAt.getTime())) return null;

  return scheduleOneTimeAt({
    fireAt,
    title: opts.title,
    body: opts.body,
    data: opts.data,
  });
}

/**
 * Cat-birthday reminder. Reschedules whenever called — caller is
 * responsible for cancelling the prior id first.
 */
export async function setBirthdayReminder(opts: {
  catName: string;
  dobIso: string;             // YYYY-MM-DD
  catId: string;
}): Promise<string | null> {
  const dob = new Date(opts.dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  return scheduleAnnualAt({
    monthIndex: dob.getMonth(),
    day: dob.getDate(),
    hour: 9,
    minute: 0,
    title: `🎂 It's ${opts.catName}'s birthday today`,
    body: `Tap for ${opts.catName}'s photo album of the past year.`,
    data: { route: '/cat-birthday', catId: opts.catId, kind: 'birthday' },
  });
}

/**
 * Adoption-iversary reminder. Same pattern as birthday but on the
 * adoption-date MM-DD.
 */
export async function setAdoptionIversaryReminder(opts: {
  catName: string;
  adoptedOnIso: string;       // YYYY-MM-DD
  catId: string;
}): Promise<string | null> {
  const date = new Date(opts.adoptedOnIso);
  if (Number.isNaN(date.getTime())) return null;
  const yearsTogether = new Date().getFullYear() - date.getFullYear();
  return scheduleAnnualAt({
    monthIndex: date.getMonth(),
    day: date.getDate(),
    hour: 9,
    minute: 0,
    title: `🏡 ${yearsTogether > 0 ? yearsTogether + ' year' + (yearsTogether === 1 ? '' : 's') + ' with ' : 'Adoption-iversary for '}${opts.catName}`,
    body: `Tap to see what changed this year.`,
    data: { route: '/cat-birthday', catId: opts.catId, kind: 'adoption' },
  });
}

/**
 * Streak-milestone push — celebrates 7/14/30/60-day check-in streaks.
 * Fires once when the milestone is first hit. Caller (healthStore)
 * decides when to call this; this function just creates the immediate
 * one-shot.
 */
export async function fireStreakMilestoneNotification(opts: {
  catName: string;
  days: number;
}): Promise<string | null> {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  await ensureAndroidChannel();
  // Daily cap — at most one ad-hoc push per day across all categories.
  if (!(await claimDailyPushSlot())) return null;
  // Fire ~30 sec from now so it lands shortly after the check-in.
  // scheduleOneTimeAt applies quiet-hours; if it's currently 22:00-08:00
  // local, the celebration will land at 08:00 the next morning, which is
  // still on-brand (first-thing positive ping).
  return scheduleOneTimeAt({
    fireAt: new Date(Date.now() + 30 * 1000),
    title: `🔥 ${opts.days}-day check-in streak`,
    body: `Nice work staying close to ${opts.catName}'s baseline.`,
    data: { route: '/(main)', kind: 'streak' },
  });
}

/**
 * Insight push — fires when CatContext patterns hit a concerning trend
 * (e.g. 3+ "off" mood check-ins in a week). Brief, actionable, never
 * alarming.
 */
/**
 * Morning Mew — daily 8:00 AM push that fires a cat-voice morning
 * greeting. Body is picked from today's mood (lottery resolved at
 * scheduling time using archetype + today's signals + user feedback)
 * so the lockscreen line MATCHES the day's mood the cat is in.
 *
 * IMPORTANT: this is a RECURRING daily trigger — same line repeats
 * if the mood doesn't change. For per-day mood variation in the
 * notification body, the app should cancel + re-schedule each evening
 * when the next day's mood becomes computable. For Phase 1 (ships
 * today, simple), the recurring schedule uses the mood at install/
 * schedule time. Acceptable tradeoff — the cat's voice register is
 * still mood-shaped; the line just won't re-roll until the schedule
 * is refreshed.
 *
 * Phase 2 will cancel + re-arm nightly so each morning's notification
 * body reflects tomorrow's freshly-rolled mood.
 *
 * Caller (notification-settings toggle, or onboarding completion)
 * is responsible for cancelling the prior id before re-arming so the
 * user doesn't get duplicate 8 AM pings.
 */
export async function setMorningMewReminder(opts: {
  catName: string;
  catId: string;
  hour?: number;
  minute?: number;
  body?: string;
}): Promise<string | null> {
  const hour = opts.hour ?? 8;
  const minute = opts.minute ?? 0;
  // Body provided by caller (typically the result of
  // pickMorningGreeting for today's mood). Fallback is the
  // activation-rescue copy (2026-05-21 — first-open-activation-rescue
  // campaign): chat-coded language to drive Today→Chat funnels,
  // since the KPI is chat_message_sent_users / app_opened_users.
  // The cat-voice register is preserved — "has thoughts" is warmer
  // than the original generic "has to say" while still implying the
  // user can hear them.
  const body = opts.body ?? `${opts.catName} has thoughts. Tap to hear them.`;
  return scheduleDailyAt({
    hour,
    minute,
    title: `${opts.catName} is awake`,
    body,
    data: {
      route: '/daily-card',
      catId: opts.catId,
      kind: 'morning_mew',
    },
  });
}

/**
 * Daily Postcard reminder — fires every evening at 19:00 local phone
 * time. Different from the diary reminder: postcards are about photos
 * (social-share moment), diary is about reflection. Both can fire on
 * the same evening; users can disable independently in
 * notification-settings.
 *
 * Caller (typically the Postcard screen on first open, or the
 * notification-settings toggle) is responsible for cancelling the prior
 * id before re-arming.
 */
export async function setDailyPostcardReminder(opts: {
  catName: string;
  catId: string;
}): Promise<string | null> {
  return scheduleDailyAt({
    hour: 19,
    minute: 0,
    title: `${opts.catName}'s postcard is ready`,
    body: `Tap to compose today's social card.`,
    data: { route: '/postcard', catId: opts.catId, kind: 'postcard_ready' },
  });
}

/**
 * Daily Photo Studio reminder — fires every day at 11:00 local. Sits in
 * the morning-bustle-aftermath slot, well before the 19:00 diary +
 * postcard pings, and well after the user's check-in / medication
 * windows. Aim is "you've got the cat in eyeshot, take 10 seconds and
 * snap one photo for the time-lapse."
 *
 * Caller (Photo Studio screen on first open + notification-settings
 * toggle) is responsible for cancelling the prior id before re-arming.
 */
export async function setDailyPhotoStudioReminder(opts: {
  catName: string;
  catId: string;
}): Promise<string | null> {
  return scheduleDailyAt({
    hour: 11,
    minute: 0,
    title: `📸 Daily photo of ${opts.catName}`,
    body: `Ten seconds. The time-lapse builds itself.`,
    data: { route: '/photo-studio', catId: opts.catId, kind: 'photo_studio' },
  });
}

/**
 * Daily Cat Diary reminder — fires every evening at 19:00 local phone
 * time. Body uses the cat's name to feel personal. Tap deep-links into
 * the diary screen which auto-generates the entry on open.
 *
 * "19:00 local" means whatever the device's local time is — Expo's daily
 * trigger is timezone-aware to the device, so a user who travels won't
 * get pinged at 4am in another timezone.
 *
 * Caller (typically the diary screen on first open, or the
 * notification-settings toggle) is responsible for cancelling the prior
 * id before re-arming.
 */
export async function setDailyDiaryReminder(opts: {
  catName: string;
  catId: string;
}): Promise<string | null> {
  return scheduleDailyAt({
    hour: 19,
    minute: 0,
    title: `${opts.catName} has thoughts about today`,
    body: `Tap to read what ${opts.catName} wrote.`,
    data: { route: '/diary', catId: opts.catId, kind: 'diary_entry' },
  });
}

// `setCatVoiceEveningPush` was REMOVED 2026-05-09 with the 7pm-gate
// diary-writing redesign. It used to schedule a per-day 19:00 push
// with the entry's highlight as body, predicated on the entry being
// generated EARLIER in the day. Under the 7pm gate, entries can
// only be generated at or after 19:00 — meaning the push would land
// at tomorrow 19:00 with TODAY's highlight, mistiming content vs day.
// Replaced by `setDailyDiaryReminders` (below) which schedules a
// 7-day rolling window of generic "diary is waiting" pushes; the
// user taps one and the entry generates fresh on screen open.

/**
 * Daily Diary reminder — schedules a 7-day rolling window of generic
 * "Lily's diary is waiting" pushes at 19:00 local time.
 *
 * ── Why a 7-day window vs perma-recurring ──────────────────────────
 * If we used a perma-recurring trigger (`{ hour: 19, repeats: true }`),
 * users who stop opening the app keep getting pushes forever, which
 * Android demotes the channel for (3-4 ignored pushes → automatic
 * importance downgrade → never recoverable). Worse: the user mutes
 * the app entirely. The 7-day rolling window solves this: every
 * time the user opens the app, we re-arm 7 days of pushes; if they
 * stop opening, the tail expires and pushes go silent.
 *
 * ── Why generic body, not entry highlight ──────────────────────────
 * Pre 2026-05-09 the cat-voice push body carried the entry's
 * highlight ("The bird at the window was unreasonable for thirty
 * seconds"). Under the new 7pm-gate diary design, entries can ONLY
 * be generated at or after 19:00 — meaning today's 19:00 has
 * already passed by the time we'd schedule. The push would land at
 * tomorrow 19:00 with TODAY's highlight, mistiming content vs the
 * day. So the body is now generic; user taps it and the diary
 * generates fresh on screen open. Daily ritual, not stale recap.
 *
 * ── Caller contract ────────────────────────────────────────────────
 * Caller cancels any prior reminder IDs (from notifPrefsStore's
 * `getDiaryReminderIds`) before calling this, then stores the
 * returned array via `setDiaryReminderIds`. Typically called once
 * per app foreground / boot, debounced.
 */
export async function setDailyDiaryReminders(opts: {
  catId: string;
  catName: string;
}): Promise<string[]> {
  const ids: string[] = [];
  const now = new Date();
  // Schedule for the next 7 days at 19:00 local. If today's 19:00
  // hasn't passed, day 0 = today; otherwise day 0 = tomorrow.
  const dayZero = new Date();
  dayZero.setHours(19, 0, 0, 0);
  if (dayZero.getTime() <= now.getTime() + 60 * 1000) {
    dayZero.setDate(dayZero.getDate() + 1);
  }
  for (let i = 0; i < 7; i++) {
    const fireAt = new Date(dayZero);
    fireAt.setDate(fireAt.getDate() + i);
    const id = await scheduleOneTimeAt({
      fireAt,
      title: opts.catName,
      body: `${opts.catName}'s diary is waiting — open to read today's entry.`,
      data: {
        route: '/diary',
        catId: opts.catId,
        kind: 'diary_reminder',
      },
    });
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * Weekly Body Language nudge — fires 7 days after the last behaviour
 * observation (or 7 days after first scheduling, if the user has never
 * recorded one). Caller is responsible for cancelling any prior id.
 *
 * Lands at 19:00 local on the target day — outside quiet hours, after
 * dinner, when phones get picked up. We pin to 19:00 specifically so
 * the nudge feels like a "weekly ritual" rather than a random ping.
 */
export async function setWeeklyReadNudge(opts: {
  catName: string;
  catId: string;
  daysFromNow?: number;       // default 7
}): Promise<string | null> {
  const days = opts.daysFromNow ?? 7;
  const fireAt = new Date();
  fireAt.setDate(fireAt.getDate() + days);
  fireAt.setHours(19, 0, 0, 0);
  return scheduleOneTimeAt({
    fireAt,
    title: `📹 Body Language check on ${opts.catName}`,
    body: `It's been a week since the last body-language check. 6 seconds of footage and the AI does the rest.`,
    data: { route: '/behavior', catId: opts.catId, kind: 'weekly_read_nudge' },
  });
}

/**
 * Weekly "she noticed" reading — Sunday 19:00 local push that
 * opens the /weekly-reading screen. Body is a teaser one-liner; the
 * actual reading is generated lazily on screen open (we can't
 * pre-fetch reliably from a notification trigger on Android).
 *
 * The teaser body deliberately uses curiosity-bait, Co-Star style:
 *   "I have notes about your week."
 *   "I have been watching."
 *   "There are observations."
 *
 * Caller (typically chat / personality screen first-open + a settings
 * toggle) is responsible for cancelling the prior id before re-arming.
 *
 * See: marketing/chat-as-viral-lever.md §5.
 */
export async function setWeeklyReadingReminder(opts: {
  catName: string;
  catId: string;
}): Promise<string | null> {
  const teasers = [
    'I have notes about your week.',
    'I have been watching.',
    'There are observations.',
    'You think I do not notice. I do.',
  ];
  // Deterministic per (cat, ISO-week) so the lock-screen body is
  // STABLE across re-arms (chat-tab mount cycles re-run this code,
  // and a freshly-randomised teaser each mount means the body the
  // user sees on Sunday could differ from the body that was queued
  // earlier in the week). Hash by week-key + cat → same teaser
  // through Saturday, fresh teaser starting Monday.
  const isoWeek = computeIsoWeekKey(new Date());
  let h = 2166136261 >>> 0;
  const seed = `${opts.catId}:${isoWeek}`;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const teaser = teasers[h % teasers.length]!;
  return scheduleWeeklyAt({
    weekday: 1, // 1 = Sunday in expo's weekly trigger
    hour: 19,
    minute: 0,
    title: opts.catName,
    body: teaser,
    data: {
      route: '/weekly-reading',
      catId: opts.catId,
      kind: 'weekly_reading',
    },
  });
}

/**
 * ISO 8601 week-key, e.g. "2026-W18". Local helper so notifications
 * don't import services/weeklyReading just for this.
 */
function computeIsoWeekKey(d: Date): string {
  const target = new Date(d.getTime());
  const dayNum = (d.getDay() + 6) % 7; // Mon = 0
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    );
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Weekly Cat Studio poster — fires every Sunday at 10:00 local. The
 * notification announces a fresh AI-generated movie poster (lazy-
 * generated on app open from photos of the past 7 days).
 *
 * Why Sunday 10am:
 *   - Sunday morning is when phones get picked up casually — a good
 *     "delight push" window vs the weekday utility/check-in cadence.
 *   - Outside the 22:00–08:00 quiet-hours rail.
 *   - One full new poster per week — feels like a weekly ritual without
 *     becoming spammy.
 *
 * Generation itself is lazy: when the user taps the notification + lands
 * on /cat-studio, the screen detects "no auto-poster for this studio
 * week yet" and runs `weeklyAutoGenerate(catId)` on mount. This avoids
 * Android background-execution unreliability — we can't reliably run
 * code at 10am Sunday from a notification trigger, but we CAN make sure
 * the poster shows up as soon as the user opens the app.
 *
 * Caller (Cat Studio screen on first open + notification-settings
 * toggle) is responsible for cancelling the prior id before re-arming.
 */
export async function setWeeklyCatStudioReminder(opts: {
  catName: string;
  catId: string;
}): Promise<string | null> {
  return scheduleWeeklyAt({
    weekday: 1,                // 1 = Sunday in expo's weekly trigger
    hour: 10,
    minute: 0,
    title: `${opts.catName}'s new poster is ready`,
    body: `This week's movie-poster remix just dropped — tap to see it.`,
    data: { route: '/cat-studio', catId: opts.catId, kind: 'cat_studio_poster' },
  });
}

export async function fireInsightNotification(opts: {
  catName: string;
  message: string;
}): Promise<string | null> {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  await ensureAndroidChannel();
  if (!(await claimDailyPushSlot())) return null;
  return scheduleOneTimeAt({
    fireAt: new Date(Date.now() + 30 * 1000),
    title: `${opts.catName} — quick note`,
    body: opts.message,
    data: { route: '/(main)', kind: 'insight' },
  });
}
