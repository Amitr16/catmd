/**
 * healthStore — longitudinal event log per cat.
 *
 * One store, many typed events. Modelled on `scanStore`:
 *   - local-first (Zustand + AsyncStorage)
 *   - fire-and-forget mirror to Supabase `cat_events`
 *   - selector helpers to filter by cat + type
 *
 * Each event is {id, cat_id, type, ts, payload}. The payload shape
 * varies by type — individual helpers + TypeScript discriminated unions
 * keep callers honest.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  deleteHealthEventFromCloud,
  syncHealthEventToCloud,
} from '../services/health';

// ── Event type union ───────────────────────────────────────────────────────
export type HealthEventType =
  | 'vaccination'
  | 'medication_dose'
  | 'weight'
  | 'appointment'
  | 'symptom_photo'
  | 'water_intake'
  | 'litter_box_use'
  | 'srr_measurement'
  | 'pain_score'
  | 'outcome_check'
  | 'feeding'
  | 'daily_checkin'
  | 'behavior_observation'
  | 'meow_translation';

// ── Per-type payload shapes ────────────────────────────────────────────────
export type VaccinationPayload = {
  vaccine: string;                // "FVRCP", "Rabies", "FeLV", "Bordetella", etc.
  given_on: string;               // ISO date
  next_due: string | null;        // ISO date
  administered_by: string | null; // vet / clinic name
  batch_no: string | null;
  notes: string | null;
};

export type MedicationDosePayload = {
  medication: string;             // "Methimazole 2.5mg", "Subcutaneous fluids 100ml"
  dose_given: string | null;      // free-text dose, e.g. "1 tablet" / "100 ml"
  scheduled: boolean;             // was this the daily reminder? or ad-hoc?
  given_at: string;               // ISO timestamp
  notes: string | null;
};

export type WeightPayload = {
  weight_kg: number;
  bcs: number | null;             // body condition score 1-9
  measured_at: string;            // ISO timestamp
  notes: string | null;
};

export type AppointmentPayload = {
  title: string;                  // "Annual check-up", "Dental cleaning"
  scheduled_for: string;          // ISO datetime
  vet: string | null;
  reason: string | null;
  completed: boolean;
  outcome_notes: string | null;   // filled in after the visit
};

export type SymptomPhotoPayload = {
  concern_slug: string;           // groups photos of the same issue: "left-eye-discharge"
  concern_label: string;          // display label
  photo_uri: string;              // local file://
  notes: string | null;
};

export type WaterIntakePayload = {
  ml: number;
  logged_at: string;              // ISO timestamp
};

export type LitterBoxUsePayload = {
  kind: 'urine' | 'stool' | 'both' | 'unknown';
  abnormal: boolean;
  notes: string | null;
  logged_at: string;
};

export type SRRMeasurementPayload = {
  bpm: number;                    // breaths per minute
  duration_s: number;             // how long the user counted
  measured_at: string;
  notes: string | null;
};

export type PainScorePayload = {
  composite: number;              // 0-10 from Feline Grimace Scale
  units: {
    ear_position: number;         // 0-2
    orbital_tightening: number;   // 0-2
    muzzle_tension: number;       // 0-2
    whisker_change: number;       // 0-2
    head_position: number;        // 0-2
  };
  photo_uri: string | null;
  measured_at: string;
};

/**
 * Daily check-in — the 10-second owner-reported baseline that transforms
 * the app from episodic crisis tool to daily habit. Streak counting +
 * anomaly detection run off this stream. One entry per day is the norm;
 * multiple entries on the same day keep the most recent (de-duped by
 * selector helpers, not by the store).
 */
export type DailyCheckinPayload = {
  mood: 'happy' | 'normal' | 'off';
  appetite: 'full' | 'half' | 'none';
  notes: string | null;
  logged_at: string;
};

export type FeedingPayload = {
  // Daily appetite self-report. We persist one observation per logging
  // action; the UI aggregates "normal vs. increased vs. reduced vs. none"
  // counts over rolling windows to detect hyperthyroid triad or anorexia.
  appetite: 'normal' | 'increased' | 'reduced' | 'none';
  food_type: string | null;       // optional: "wet", "dry", "mixed", brand
  amount_g: number | null;        // optional: grams served or eaten
  logged_at: string;
  notes: string | null;
};

export type OutcomeCheckPayload = {
  scan_id: string;                // FK to scanStore
  direction: 'better' | 'same' | 'worse';
  vet_visited: 'yes' | 'no' | 'plan_to';
  helpful_rating: 1 | 2 | 3 | 4 | 5 | null;
  notes: string | null;
  responded_at: string;
};

/**
 * Behaviour observation — Layer-A of the (planned) Body Language Triage
 * stack. The user records a short multi-frame burst of their cat; the AI
 * returns a *descriptive* paragraph (NOT a diagnosis, NOT a triage tier).
 *
 * Why store it: drives daily-active retention (people film fun behaviour
 * clips weekly+), the cumulative log becomes a passive screening tool
 * later (Felix can scan paragraphs for emerging clinical concerns), and
 * — when Layer B (FGS pain) and Layer C (gait) ship — they share the
 * same capture flow, so this event type evolves naturally.
 */
export type BehaviorObservationPayload = {
  observation: string;            // 3-5 sentence descriptive paragraph
  tags: string[];                 // e.g. ["relaxed", "tail-high", "ears-forward"]
  frame_count: number;            // how many frames the model saw
  duration_sec: number | null;    // capture duration if known
  model: string;                  // which AI model generated this (e.g. "gpt-4o-mini")
  notes: string | null;           // user-added note after viewing
  observed_at: string;            // ISO timestamp
};

/**
 * Meow translation event — one row per /translate run. Saves the
 * shareable translation the cat "said", the underlying classification,
 * and the audio transcript so the cat-says greatest-hits scroll can
 * surface the line later. The catContext builder reads this type to
 * populate `recentMeowSignals` (empty placeholder before this event
 * type existed).
 *
 * `intent: 'distress'` is the vet-flag cousin — when the translator
 * classifies a clip as distress, downstream surfaces (Today tab
 * banner, push) can pick it up the same way they pick up hard-urgency
 * triage events. distinct from a triage scan: a meow_translation is
 * cheap + advisory, not a clinical record.
 */
export type MeowTranslationPayload = {
  vocalization_type:
    | 'meow' | 'trill' | 'chirp' | 'purr' | 'hiss'
    | 'growl' | 'yowl' | 'chatter' | 'silent' | 'other';
  intent:
    | 'greeting' | 'demand_food' | 'demand_attention' | 'annoyed'
    | 'playful' | 'comfort_seeking' | 'warning' | 'distress'
    | 'curious' | 'self_soothing' | 'other';
  confidence: 'high' | 'moderate' | 'low';
  /** The shareable cat-voice line (40-160 chars). */
  translation: string;
  /** One-sentence technical reasoning. */
  why: string;
  /** Whether Whisper produced a non-empty transcript. */
  had_audio: boolean;
  /** Whisper transcript when present. */
  audio_transcript: string | null;
  /** AI model that produced the translation (e.g. "gpt-4o-mini"). */
  model: string;
  /** ISO timestamp of when the cat actually vocalised (capture time). */
  observed_at: string;
};

type PayloadByType = {
  vaccination: VaccinationPayload;
  medication_dose: MedicationDosePayload;
  weight: WeightPayload;
  appointment: AppointmentPayload;
  symptom_photo: SymptomPhotoPayload;
  water_intake: WaterIntakePayload;
  litter_box_use: LitterBoxUsePayload;
  srr_measurement: SRRMeasurementPayload;
  pain_score: PainScorePayload;
  outcome_check: OutcomeCheckPayload;
  feeding: FeedingPayload;
  daily_checkin: DailyCheckinPayload;
  behavior_observation: BehaviorObservationPayload;
  meow_translation: MeowTranslationPayload;
};

export type HealthEvent<T extends HealthEventType = HealthEventType> = {
  id: string;
  cat_id: string;
  type: T;
  ts: string;           // ISO timestamp — the event's clinical time
  payload: PayloadByType[T];
  created_at: string;   // ISO timestamp — when the row was written
};

// ── Store ──────────────────────────────────────────────────────────────────
const MAX_EVENTS = 2000;

type State = {
  events: HealthEvent[];

  /** Typed insert. Returns the created event. */
  addEvent: <T extends HealthEventType>(
    input: { cat_id: string; type: T; ts?: string; payload: PayloadByType[T] },
  ) => HealthEvent<T>;

  /** Update a previous event's payload (partial merge). */
  updateEvent: <T extends HealthEventType>(
    id: string,
    patch: Partial<PayloadByType[T]>,
  ) => void;

  deleteEvent: (id: string) => void;
  clearForCat: (catId: string) => void;

  /** Filtered selectors used by screens. Plain functions so consumers
   *  can also call `useHealthStore((s) => ...)` if they prefer. */
  listByType: <T extends HealthEventType>(
    catId: string,
    type: T,
  ) => HealthEvent<T>[];
  listInRange: (catId: string, fromIso: string, toIso: string) => HealthEvent[];
};

/**
 * Count consecutive days with ≥1 daily_checkin for the given cat,
 * ending today. Used by the streak-milestone push trigger.
 *
 * Algorithm: walk backwards day-by-day from today; each day that has
 * any daily_checkin event for this cat extends the streak; first gap
 * ends it. Caps at 366 to bound the loop.
 */
function countCheckinStreak(events: HealthEvent[], catId: string): number {
  const days = new Set<string>();
  for (const e of events) {
    if (e.type !== 'daily_checkin' || e.cat_id !== catId) continue;
    const d = new Date(e.ts);
    if (Number.isNaN(d.getTime())) continue;
    days.add(d.toISOString().slice(0, 10)); // YYYY-MM-DD
  }
  let count = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0); // noon to avoid TZ edge cases
  for (let i = 0; i < 366; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      // Allow today to be the first miss (streak counts up to yesterday's
      // checkin if today isn't done yet) — but only if i === 0.
      if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
  }
  return count;
}

function newId(): string {
  return `he_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useHealthStore = create<State>()(
  persist(
    (set, get) => ({
      events: [],

      addEvent: (input) => {
        const now = new Date().toISOString();
        const event = {
          id: newId(),
          cat_id: input.cat_id,
          type: input.type,
          ts: input.ts ?? now,
          payload: input.payload,
          created_at: now,
        } as HealthEvent<typeof input.type>;
        set((s) => ({ events: [event, ...s.events].slice(0, MAX_EVENTS) }));
        void syncHealthEventToCloud(event as HealthEvent).catch(() => {});
        void import('../services/analytics').then(({ track }) =>
          track({ type: 'health_event_logged', props: { type: input.type } }),
        );

        // ── Trigger-evaluated push notifications ────────────────────
        // After every daily_checkin, evaluate two engagement triggers:
        //   (a) streak milestone — fires at 7/14/30/60/90/180/365 days
        //   (b) "off mood" insight — fires when ≥3 'off' check-ins in
        //       the last 7 days
        // Both honour the per-category opt-in toggle in notifPrefsStore.
        if (input.type === 'daily_checkin') {
          void (async () => {
            try {
              const events = get().events;
              const { useCatStore } = await import('./catStore');
              const cat = useCatStore.getState().cats.find((c) => c.id === input.cat_id);
              if (!cat) return;
              const catName = cat.name;
              const { useNotifPrefsStore } = await import('./notifPrefsStore');
              const prefs = useNotifPrefsStore.getState();
              const {
                fireStreakMilestoneNotification,
                fireInsightNotification,
              } = await import('../services/notifications');

              // (a) Streak — count consecutive days with at least one
              // daily_checkin, ending today.
              if (prefs.enabled.streak_milestone) {
                const days = countCheckinStreak(events, input.cat_id);
                const milestones = [7, 14, 30, 60, 90, 180, 365];
                if (milestones.includes(days)) {
                  await fireStreakMilestoneNotification({ catName, days });
                }
              }

              // (b) Off-mood insight — 3 or more 'off' check-ins in
              // last 7 days. Fires at the *moment* the threshold is
              // first hit (today's check-in is what tipped it).
              if (prefs.enabled.insight) {
                const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const recentCheckins = events.filter(
                  (e) =>
                    e.cat_id === input.cat_id &&
                    e.type === 'daily_checkin' &&
                    new Date(e.ts).getTime() >= cutoff,
                );
                const offCount = recentCheckins.filter(
                  (e) => (e.payload as { mood?: string }).mood === 'off',
                ).length;
                if (offCount === 3) {
                  await fireInsightNotification({
                    catName,
                    message: `${catName} has logged 3 'off' mood check-ins this week. A scan can help interpret what's going on.`,
                  });
                }
              }
            } catch (e) {
              console.warn('[CatMD] post-checkin notification triggers:', e);
            }
          })();
        }

        // ── Weekly Read [cat] nudge — rearm on every observation ────
        // Each successful behaviour observation resets the 7-day clock.
        // We cancel any pending nudge for this cat and schedule a fresh
        // one for 7 days from now at 19:00 local. If they record again
        // before then, this same logic cancels & reschedules. The user
        // never gets nudged about something they just did.
        if (input.type === 'behavior_observation') {
          void (async () => {
            try {
              const { useCatStore } = await import('./catStore');
              const cat = useCatStore.getState().cats.find((c) => c.id === input.cat_id);
              if (!cat) return;
              const { useNotifPrefsStore } = await import('./notifPrefsStore');
              const prefs = useNotifPrefsStore.getState();
              if (!prefs.enabled.weekly_read_nudge) return;
              const { setWeeklyReadNudge, cancelNotification } = await import(
                '../services/notifications'
              );
              const key = `${input.cat_id}:weekly_read_nudge`;
              const prevId = prefs.scheduledIds[key];
              if (prevId) await cancelNotification(prevId);
              const newId = await setWeeklyReadNudge({
                catName: cat.name,
                catId: input.cat_id,
              });
              prefs.setScheduledId(input.cat_id, 'weekly_read_nudge', newId);
            } catch (e) {
              console.warn('[CatMD] rearm weekly_read_nudge:', e);
            }
          })();
        }

        return event;
      },

      updateEvent: (id, patch) => {
        let merged: HealthEvent | null = null;
        set((s) => ({
          events: s.events.map((e) => {
            if (e.id !== id) return e;
            merged = { ...e, payload: { ...e.payload, ...patch } };
            return merged;
          }),
        }));
        if (merged) void syncHealthEventToCloud(merged).catch(() => {});
      },

      deleteEvent: (id) => {
        set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
        void deleteHealthEventFromCloud(id).catch(() => {});
      },

      clearForCat: (catId) => {
        const ids = get().events.filter((e) => e.cat_id === catId).map((e) => e.id);
        set((s) => ({ events: s.events.filter((e) => e.cat_id !== catId) }));
        ids.forEach((id) => void deleteHealthEventFromCloud(id).catch(() => {}));
      },

      listByType: <T extends HealthEventType>(catId: string, type: T) =>
        get().events.filter(
          (e): e is HealthEvent<T> => e.cat_id === catId && e.type === type,
        ),

      listInRange: (catId, fromIso, toIso) => {
        const from = new Date(fromIso).getTime();
        const to = new Date(toIso).getTime();
        return get().events.filter((e) => {
          if (e.cat_id !== catId) return false;
          const t = new Date(e.ts).getTime();
          return t >= from && t <= to;
        });
      },
    }),
    {
      name: 'catmd-health-events',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

// ── Derivations used across screens ────────────────────────────────────────

/** Most recent weight measurement, or null if none. */
export function latestWeight(events: HealthEvent[]): WeightPayload | null {
  const w = events
    .filter((e): e is HealthEvent<'weight'> => e.type === 'weight')
    .sort((a, b) => b.ts.localeCompare(a.ts))[0];
  return w?.payload ?? null;
}

/** Next vaccination due. */
export function nextVaccineDue(events: HealthEvent[]): {
  vaccine: string; next_due: string;
} | null {
  const now = Date.now();
  const upcoming = events
    .filter((e): e is HealthEvent<'vaccination'> => e.type === 'vaccination')
    .map((e) => e.payload)
    .filter((p) => p.next_due && new Date(p.next_due).getTime() >= now)
    .sort((a, b) => (a.next_due ?? '').localeCompare(b.next_due ?? ''));
  const first = upcoming[0];
  return first && first.next_due
    ? { vaccine: first.vaccine, next_due: first.next_due }
    : null;
}

/**
 * Most-recent daily check-in today (in the device's local calendar day),
 * or null if the owner hasn't checked in yet today.
 */
export function todaysCheckin(
  events: HealthEvent[],
): HealthEvent<'daily_checkin'> | null {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const ms = startOfToday.getTime();
  const todays = events
    .filter((e): e is HealthEvent<'daily_checkin'> => e.type === 'daily_checkin')
    .filter((e) => new Date(e.ts).getTime() >= ms)
    .sort((a, b) => b.ts.localeCompare(a.ts));
  return todays[0] ?? null;
}

/**
 * Rolling streak of consecutive daily-checkin days ending today or
 * yesterday. Yesterday counts as still-alive so the habit doesn't feel
 * lost if the owner opens the app in the morning before checking in.
 * Returns 0 when the streak is broken (no checkin yesterday or today).
 */
export function dailyCheckinStreak(events: HealthEvent[]): number {
  const days = new Set<number>();
  for (const e of events) {
    if (e.type !== 'daily_checkin') continue;
    const d = new Date(e.ts);
    d.setHours(0, 0, 0, 0);
    days.add(d.getTime());
  }
  if (days.size === 0) return 0;

  const msPerDay = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  // Streak is "alive" if today or yesterday has a check-in.
  if (!days.has(todayMs) && !days.has(todayMs - msPerDay)) return 0;

  let streak = 0;
  let cursor = days.has(todayMs) ? todayMs : todayMs - msPerDay;
  while (days.has(cursor)) {
    streak++;
    cursor -= msPerDay;
  }
  return streak;
}

/** Next appointment. */
export function nextAppointment(events: HealthEvent[]): AppointmentPayload | null {
  const now = Date.now();
  const upcoming = events
    .filter((e): e is HealthEvent<'appointment'> => e.type === 'appointment')
    .map((e) => e.payload)
    .filter((p) => !p.completed && new Date(p.scheduled_for).getTime() >= now)
    .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
  return upcoming[0] ?? null;
}
