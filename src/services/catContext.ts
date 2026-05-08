/**
 * Shared CatContext builder.
 *
 * Single source of truth that every AI-driven module reads from. Aggregates:
 *   - profile (name, breed, age, sex, weight, conditions, meds, lifestyle)
 *   - recent triage outcomes (last 14 days, hard-urgency extends to 90 days)
 *   - recent health events (last 14 days)
 *   - aggregated behaviour-observation tags
 *   - recent meow signals (when Meow decoder ships)
 *   - sleep baseline (when Sleep Coach ships)
 *   - yesterday's diary entry (when Diary ships)
 *
 * The recency rule: a CKD diagnosis from 6 months ago shouldn't bias today's
 * behaviour reading. Stale signals are worse than no signals.
 *
 * Hard-urgency exception: Layer-1 keyword emergencies (lily ingestion, etc.)
 * are clinically persistent and stay relevant for 90 days regardless.
 *
 * This is a pure function — read-only from stores, no side effects, safe to
 * call from anywhere (React, services, even worker code).
 *
 * See spec: drafts/specs/cat-context-builder.md
 */
import type { Lifestyle } from '../state/catStore';
import { useCatStore } from '../state/catStore';
import { useScanStore, type ScanRecord } from '../state/scanStore';
import {
  dailyCheckinStreak as computeDailyCheckinStreak,
  useHealthStore,
  type HealthEvent,
} from '../state/healthStore';
import { useNotificationStore } from '../state/notificationStore';
import { useWorldStore, type WorldEntry } from '../state/worldStore';
import type { UrgencyTier } from '../theme/tokens';

/** Recency configuration. Configurable per call site. */
export type CatContextOptions = {
  /** Default 14 days. Configurable for personality (30) or sleep (7). */
  recencyWindowDays?: number;
  /**
   * If true (default), pulls yesterday's diary entry for narrative continuity.
   * Diary builders pass true; everyone else can leave it default.
   */
  includeYesterdaysDiary?: boolean;
};

const DEFAULT_RECENCY_DAYS = 14;
const HARD_URGENCY_RECENCY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compact version of `ScanRecord` that surfaces only what AI prompts care
 * about. Strips the heavy fields (full differentials, follow-up Q/A, etc.)
 * that would just bloat token usage.
 */
export type RecentTriageRef = {
  scanId: string;
  score: number;
  tier: UrgencyTier;
  primaryConcern: string;          // headline
  hardUrgency: boolean;
  daysAgo: number;
  summary: string;                 // 1-line vet-ready
};

export type CatContext = {
  /** Identity & static profile — always populated when a cat exists. */
  profile: {
    id: string;
    name: string;
    breed: string | null;
    sex: 'male' | 'female' | 'unknown';
    spayedNeutered: boolean | null;
    /** ISO yyyy-mm-dd if known. Authoritative for age. */
    dobIso: string | null;
    /** When the cat joined the household (separate from DOB). */
    adoptedOnIso: string | null;
    ageYears: number | null;
    ageMonths: number | null;
    weightKg: number | null;
    indoorOutdoor: Lifestyle;
    conditions: string[];
    medications: string[];
    notes: string | null;
    emergencyVetName: string | null;
    emergencyVetPhone: string | null;
  } | null;

  /**
   * Per-cat reminder configuration (from notificationStore). Surfaces to
   * the chat prompt so the cat can answer "when is my medicine due?" and
   * "when's the weekly check-in?" without needing to plumb a separate
   * dependency through every consumer.
   */
  reminders: {
    /** "HH:MM" local — daily medication reminder. Null if not set. */
    medTime: string | null;
    /** "HH:MM" local — weekly check-in time. Null if not set. */
    checkinTime: string | null;
    /** 1-7 (1=Sunday) — weekday for the weekly check-in. Null if not set. */
    checkinWeekday: number | null;
  };

  // ── HEALTH-LOG AGGREGATIONS ─────────────────────────────────────────────
  // These tiers were previously in raw `recentEvents` only — invisible to
  // the chat prompt unless the model dug through the blob array. They are
  // now first-class so the cat KNOWS about its own shots, doses, weight
  // trend, and upcoming vet visits — and can mention them proactively,
  // not just when asked. See `renderCatContextForPrompt` for the prompt
  // shape.

  /** Vaccinations — last given per vaccine + next due. */
  vaccinations: {
    /** Last record per unique vaccine name (newest first). */
    history: Array<{
      vaccine: string;
      given_on: string;
      next_due: string | null;
      administered_by: string | null;
    }>;
    /** Soonest upcoming due, or null. */
    nextDue: { vaccine: string; next_due: string; daysUntil: number } | null;
    /** Any vaccine whose next_due has already passed. */
    overdue: Array<{ vaccine: string; next_due: string; daysOverdue: number }>;
  };

  /**
   * Medication-dose history — per medication: last dose, total doses in
   * window, missed-vs-scheduled summary. Drives "did I take my pill
   * today?" / "you've missed 2 doses this week" conversations.
   */
  medicationDoses: {
    perMed: Array<{
      medication: string;
      lastDoseAt: string | null;
      dosesInWindow: number;
      lastMissedAt: string | null;  // most recent scheduled dose with no record
    }>;
    totalDosesInWindow: number;
  };

  /** Weight log + trend (separate from profile.weightKg which is the latest). */
  weightHistory: {
    /** Most recent measurement (also surfaced as profile.weightKg). */
    latest: { weight_kg: number; bcs: number | null; measured_at: string } | null;
    /** Up to 5 most recent measurements (newest first). */
    recent: Array<{ weight_kg: number; bcs: number | null; measured_at: string }>;
    /** 90-day trend if at least 2 measurements exist in the window. */
    trend90d: {
      deltaKg: number;
      direction: 'up' | 'down' | 'stable';
      fromKg: number;
      toKg: number;
    } | null;
  };

  /** Vet appointments — next + recently completed. */
  appointments: {
    next: {
      title: string;
      scheduled_for: string;
      vet: string | null;
      reason: string | null;
      daysUntil: number;
    } | null;
    recentCompleted: Array<{
      title: string;
      scheduled_for: string;
      outcome_notes: string | null;
      daysAgo: number;
    }>;
  };

  /** Pain scores — recent measurements + trend direction. */
  painScores: {
    recent: Array<{ composite: number; measured_at: string; daysAgo: number }>;
  };

  /** Daily-checkin streak — drives habit-forming references. */
  dailyCheckinStreak: number;

  /**
   * World Memory — REAL objects, places, toys, furniture, and
   * environmental context the cat knows about. Populated via the
   * /world screen + chat LOG_OBJECT marker. Replaces stock
   * fabricated references ("the cup at the edge", "the radiator")
   * with cat-grounded specifics ("the green chair", "the garden").
   */
  worldEntries: WorldEntry[];

  /** Recent triage activity, most-recent-first. */
  recentTriage: RecentTriageRef[];

  /** Recent healthStore events (check-ins, weight, behaviour obs, etc.). */
  recentEvents: HealthEvent[];

  /**
   * Aggregated behaviour-observation tags across the recency window.
   * Keys are tag names ("relaxed", "tail-high", etc.); values are counts.
   * Helps personality + diary modules see patterns over single observations.
   */
  behaviorTags: Record<string, number>;

  /** Recent meow signals — placeholder until Meow decoder ships. */
  recentMeowSignals: Array<{
    type: 'distress' | 'translation';
    label: string;
    confidence: number;
    daysAgo: number;
  }>;

  /** Sleep baseline — placeholder until Sleep Coach ships. */
  sleepBaseline: {
    avgSleepHours: number | null;
    avgSrr: number | null;
    last7DayTrend: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
  } | null;

  /** Yesterday's diary body (if requested + Diary feature has shipped). */
  yesterdaysDiary: string | null;

  /**
   * Aggregated daily check-in patterns over the recency window. Triage,
   * behaviour reader, and Diary all read this to know whether the cat
   * has been "off" or "happy" recently — without re-aggregating.
   */
  checkinPatterns: CheckinPattern;

  /** Provenance — lets prompts reason about freshness. */
  generatedAt: string;
  recencyWindowDays: number;
};

// ── helpers ──────────────────────────────────────────────────────────────

function daysAgoFrom(iso: string, now: number): number {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return Infinity;
  return Math.max(0, Math.floor((now - ts) / DAY_MS));
}

function ageYearsFromMonths(months: number | null): number | null {
  if (months == null) return null;
  return Math.round((months / 12) * 10) / 10;
}

/**
 * Derive age in months from a DOB ISO string. Per catStore convention,
 * `dob_iso` is authoritative when present; `age_months` is the fallback
 * for owners who only know an approximate age. We honour that contract:
 * if DOB is set, recompute age from it on every read so the cat ages
 * correctly without anyone needing to update a stored counter.
 */
function ageMonthsFromDobIso(dobIso: string | null): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = Date.now();
  const ms = now - dob.getTime();
  if (ms < 0) return null;
  // 30.44 days/month average across the year
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)));
}

/**
 * Aggregate the last N days of daily_checkin events into a structured
 * pattern object that's easy for AI prompts to reference.
 *
 * Why surface this in CatContext: a triage on Tuesday should know the cat
 * has had three "off mood" check-ins this week. A behaviour reader
 * should know the cat skipped breakfast yesterday. Without aggregation,
 * the raw recentEvents are a soup of timestamps the model has to sort
 * through.
 */
type CheckinPattern = {
  mood: { happy: number; normal: number; off: number };
  appetite: { full: number; half: number; none: number };
  daysLogged: number;
  mostRecentMood: 'happy' | 'normal' | 'off' | null;
  mostRecentAppetite: 'full' | 'half' | 'none' | null;
  mostRecentAt: string | null;
};

function aggregateCheckinPatterns(
  events: HealthEvent[],
  windowDays: number,
): CheckinPattern {
  const cutoffMs = Date.now() - windowDays * DAY_MS;
  const checkins = events
    .filter((e) => e.type === 'daily_checkin')
    .filter((e) => new Date(e.ts).getTime() >= cutoffMs)
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const out: CheckinPattern = {
    mood: { happy: 0, normal: 0, off: 0 },
    appetite: { full: 0, half: 0, none: 0 },
    daysLogged: 0,
    mostRecentMood: null,
    mostRecentAppetite: null,
    mostRecentAt: null,
  };

  const seenDays = new Set<string>();
  for (const e of checkins) {
    const p = e.payload as { mood?: string; appetite?: string };
    if (p.mood && p.mood in out.mood) {
      out.mood[p.mood as keyof typeof out.mood]++;
    }
    if (p.appetite && p.appetite in out.appetite) {
      out.appetite[p.appetite as keyof typeof out.appetite]++;
    }
    seenDays.add(new Date(e.ts).toISOString().slice(0, 10));
  }
  out.daysLogged = seenDays.size;
  if (checkins.length > 0) {
    const latest = checkins[0];
    const p = latest.payload as { mood?: string; appetite?: string };
    out.mostRecentMood = (p.mood as CheckinPattern['mostRecentMood']) ?? null;
    out.mostRecentAppetite = (p.appetite as CheckinPattern['mostRecentAppetite']) ?? null;
    out.mostRecentAt = latest.ts;
  }
  return out;
}

/**
 * Build a complete CatContext for the given cat id.
 *
 * Returns a fully-populated context object with the configured recency
 * window applied. Returns a context with `profile: null` when the cat id
 * does not exist — callers should treat that as "no cat" and skip
 * AI-driven features.
 */
export function buildCatContext(
  catId: string,
  opts: CatContextOptions = {},
): CatContext {
  const recencyWindowDays = opts.recencyWindowDays ?? DEFAULT_RECENCY_DAYS;
  const includeYesterdaysDiary = opts.includeYesterdaysDiary ?? false;
  const now = Date.now();
  const cutoffMs = now - recencyWindowDays * DAY_MS;
  const hardUrgencyCutoffMs = now - HARD_URGENCY_RECENCY_DAYS * DAY_MS;

  // ── 1. Profile (read from catStore) ────────────────────────────────────
  // Per the catStore contract, dob_iso is authoritative when present —
  // we recompute age every time so the cat's age stays current without
  // anyone touching age_months. Fall back to age_months only when DOB
  // is unset (owner only knew approximate age at onboarding).
  const cat = useCatStore.getState().cats.find((c) => c.id === catId);
  const ageMonthsResolved =
    ageMonthsFromDobIso(cat?.dob_iso ?? null) ?? cat?.age_months ?? null;
  const profile: CatContext['profile'] = cat
    ? {
        id: cat.id,
        name: cat.name,
        breed: cat.breed,
        sex: cat.sex,
        spayedNeutered: cat.spayed_neutered,
        dobIso: cat.dob_iso,
        adoptedOnIso: cat.adopted_on_iso,
        ageYears: ageYearsFromMonths(ageMonthsResolved),
        ageMonths: ageMonthsResolved,
        weightKg: cat.weight_kg,
        indoorOutdoor: cat.indoor_outdoor,
        conditions: cat.conditions ?? [],
        medications: cat.medications ?? [],
        notes: cat.notes,
        emergencyVetName: cat.emergency_vet_name,
        emergencyVetPhone: cat.emergency_vet_phone,
      }
    : null;

  // ── Reminders (read from notificationStore) ───────────────────────────
  // Per-cat reminder times surfaced so chat can answer "when is my
  // medicine due?" without separate plumbing. Always returns the shape;
  // null fields when nothing is configured.
  const remindersRaw = useNotificationStore.getState().get(catId);
  const reminders: CatContext['reminders'] = {
    medTime: remindersRaw.med_time,
    checkinTime: remindersRaw.checkin_time,
    checkinWeekday: remindersRaw.checkin_weekday,
  };

  // ── Health-log aggregations (read from healthStore) ───────────────────
  // Pre-aggregate the raw event blobs so chat can READ each tier (shots,
  // doses, weight trend, appointments, pain scores) without having to
  // parse `recentEvents` itself. The cat can now mention them proactively
  // — "you forgot my pill yesterday" / "I'm 4.5 kg, gained 300g in 90
  // days" / "the vet visit is Tuesday" / "the FVRCP shot is overdue."
  const allCatEvents = useHealthStore.getState().events.filter((e) => e.cat_id === catId);

  // Vaccinations — last per vaccine + next due + overdue
  const vaccEvents = allCatEvents
    .filter((e): e is HealthEvent<'vaccination'> => e.type === 'vaccination')
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const seenVaccines = new Set<string>();
  const vaccHistory: CatContext['vaccinations']['history'] = [];
  for (const e of vaccEvents) {
    const p = e.payload;
    if (seenVaccines.has(p.vaccine.toLowerCase())) continue;
    seenVaccines.add(p.vaccine.toLowerCase());
    vaccHistory.push({
      vaccine: p.vaccine,
      given_on: p.given_on,
      next_due: p.next_due,
      administered_by: p.administered_by,
    });
  }
  const upcomingVacc = vaccHistory
    .filter((v) => v.next_due && new Date(v.next_due).getTime() >= now)
    .sort((a, b) => (a.next_due ?? '').localeCompare(b.next_due ?? ''));
  const overdueVacc = vaccHistory
    .filter((v) => v.next_due && new Date(v.next_due).getTime() < now)
    .map((v) => ({
      vaccine: v.vaccine,
      next_due: v.next_due!,
      daysOverdue: Math.floor((now - new Date(v.next_due!).getTime()) / DAY_MS),
    }));
  const vaccinations: CatContext['vaccinations'] = {
    history: vaccHistory.slice(0, 6),
    nextDue: upcomingVacc[0]
      ? {
          vaccine: upcomingVacc[0].vaccine,
          next_due: upcomingVacc[0].next_due!,
          daysUntil: Math.floor((new Date(upcomingVacc[0].next_due!).getTime() - now) / DAY_MS),
        }
      : null,
    overdue: overdueVacc,
  };

  // Medication doses — group by medication, summarise window + last
  const doseEvents = allCatEvents
    .filter((e): e is HealthEvent<'medication_dose'> => e.type === 'medication_dose')
    .filter((e) => new Date(e.ts).getTime() >= cutoffMs)
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const dosesByMed = new Map<
    string,
    { medication: string; doses: HealthEvent<'medication_dose'>[] }
  >();
  for (const e of doseEvents) {
    const med = e.payload.medication;
    const key = med.toLowerCase();
    if (!dosesByMed.has(key)) dosesByMed.set(key, { medication: med, doses: [] });
    dosesByMed.get(key)!.doses.push(e);
  }
  const medicationDoses: CatContext['medicationDoses'] = {
    perMed: Array.from(dosesByMed.values()).map((m) => {
      const sorted = m.doses.sort((a, b) => b.ts.localeCompare(a.ts));
      return {
        medication: m.medication,
        lastDoseAt: sorted[0]?.ts ?? null,
        dosesInWindow: sorted.length,
        lastMissedAt: null, // future: requires a "scheduled dose" table to compare against
      };
    }),
    totalDosesInWindow: doseEvents.length,
  };

  // Weight history + 90-day trend
  const weightEvents = allCatEvents
    .filter((e): e is HealthEvent<'weight'> => e.type === 'weight')
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const recent5Weight = weightEvents.slice(0, 5).map((e) => ({
    weight_kg: e.payload.weight_kg,
    bcs: e.payload.bcs,
    measured_at: e.payload.measured_at,
  }));
  // Trend: compare oldest measurement in last 90 days vs newest
  const ninetyDaysAgo = now - 90 * DAY_MS;
  const last90dWeights = weightEvents
    .filter((e) => new Date(e.ts).getTime() >= ninetyDaysAgo)
    .sort((a, b) => a.ts.localeCompare(b.ts)); // chronological
  let trend90d: CatContext['weightHistory']['trend90d'] = null;
  if (last90dWeights.length >= 2) {
    const fromKg = last90dWeights[0].payload.weight_kg;
    const toKg = last90dWeights[last90dWeights.length - 1].payload.weight_kg;
    const deltaKg = +(toKg - fromKg).toFixed(2);
    const absDelta = Math.abs(deltaKg);
    // Stable if change < 100g (sub-clinical for a typical cat)
    const direction = absDelta < 0.1 ? 'stable' : deltaKg > 0 ? 'up' : 'down';
    trend90d = { deltaKg, direction, fromKg, toKg };
  }
  const weightHistory: CatContext['weightHistory'] = {
    latest: recent5Weight[0] ?? null,
    recent: recent5Weight,
    trend90d,
  };

  // Appointments — next upcoming + last 3 completed
  const apptEvents = allCatEvents
    .filter((e): e is HealthEvent<'appointment'> => e.type === 'appointment')
    .sort((a, b) => a.payload.scheduled_for.localeCompare(b.payload.scheduled_for));
  const upcomingAppt = apptEvents
    .filter((e) => !e.payload.completed && new Date(e.payload.scheduled_for).getTime() >= now)[0];
  const completedAppts = apptEvents
    .filter((e) => e.payload.completed)
    .sort((a, b) => b.payload.scheduled_for.localeCompare(a.payload.scheduled_for))
    .slice(0, 3);
  const appointments: CatContext['appointments'] = {
    next: upcomingAppt
      ? {
          title: upcomingAppt.payload.title,
          scheduled_for: upcomingAppt.payload.scheduled_for,
          vet: upcomingAppt.payload.vet,
          reason: upcomingAppt.payload.reason,
          daysUntil: Math.floor(
            (new Date(upcomingAppt.payload.scheduled_for).getTime() - now) / DAY_MS,
          ),
        }
      : null,
    recentCompleted: completedAppts.map((e) => ({
      title: e.payload.title,
      scheduled_for: e.payload.scheduled_for,
      outcome_notes: e.payload.outcome_notes,
      daysAgo: Math.floor((now - new Date(e.payload.scheduled_for).getTime()) / DAY_MS),
    })),
  };

  // Pain scores — last 3 within window
  const painEvents = allCatEvents
    .filter((e): e is HealthEvent<'pain_score'> => e.type === 'pain_score')
    .filter((e) => new Date(e.ts).getTime() >= cutoffMs)
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 3);
  const painScores: CatContext['painScores'] = {
    recent: painEvents.map((e) => ({
      composite: e.payload.composite,
      measured_at: e.payload.measured_at,
      daysAgo: Math.floor((now - new Date(e.payload.measured_at).getTime()) / DAY_MS),
    })),
  };

  // Daily check-in streak — gamification anchor
  const dailyCheckinStreakValue = computeDailyCheckinStreak(allCatEvents);

  // World Memory — pull all entries for this cat from worldStore. The
  // diary + chat layers reference these to ground their voice in real
  // items instead of fabricated stock observations.
  const worldEntriesForCat = useWorldStore.getState().getEntriesForCat(catId);

  // ── 2. Recent triage (read from scanStore) ─────────────────────────────
  const allScans = useScanStore.getState().scans as ScanRecord[];
  const catScans = allScans.filter((s) => s.cat_id === catId);

  const recentTriage: RecentTriageRef[] = catScans
    .filter((s) => {
      const ts = new Date(s.created_at).getTime();
      // Hard-urgency events are clinically persistent → 90-day window.
      // Everything else uses the standard recency window.
      const cutoff = s.hard_urgency ? hardUrgencyCutoffMs : cutoffMs;
      return ts >= cutoff;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 8) // cap so prompts don't bloat
    .map((s) => ({
      scanId: s.id,
      score: s.score,
      tier: s.urgency,
      primaryConcern: s.headline,
      hardUrgency: s.hard_urgency,
      daysAgo: daysAgoFrom(s.created_at, now),
      // 1-line summary from explanation. If absent, fall back to headline.
      summary: (s.explanation ?? s.headline ?? '').split('\n')[0].slice(0, 200),
    }));

  // ── 3. Recent events (read from healthStore) ───────────────────────────
  const allEvents = useHealthStore.getState().events;
  const recentEvents = allEvents
    .filter((e) => e.cat_id === catId)
    .filter((e) => new Date(e.ts).getTime() >= cutoffMs)
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  // ── 4. Aggregated behaviour-observation tags ───────────────────────────
  const behaviorTags: Record<string, number> = {};
  for (const e of recentEvents) {
    if (e.type === 'behavior_observation') {
      const tags = (e.payload as { tags?: string[] }).tags ?? [];
      for (const tag of tags) {
        behaviorTags[tag] = (behaviorTags[tag] ?? 0) + 1;
      }
    }
  }

  // ── 5. Meow signals — placeholder until Meow decoder ships ─────────────
  // When Meow decoder ships, it will add 'meow_signal' events to healthStore.
  // For now, we return [].
  const recentMeowSignals: CatContext['recentMeowSignals'] = [];

  // ── 6. Sleep baseline — placeholder until Sleep Coach ships ────────────
  // When Sleep Coach ships, it will write SRR + sleep score events.
  // For now, return null to signal "no baseline yet".
  const sleepBaseline: CatContext['sleepBaseline'] = null;

  // ── 7. Yesterday's diary — placeholder until Diary ships ───────────────
  // When Diary ships, look up the most recent 'diary_entry' event from
  // yesterday's local-date window and surface its body.
  let yesterdaysDiary: string | null = null;
  if (includeYesterdaysDiary) {
    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);
    const startMs = yesterdayStart.getTime();
    const endMs = yesterdayEnd.getTime();
    // The Diary feature will use type 'diary_entry' once added. For now
    // this is a forward-compatible read that returns null.
    const diaryEvent = allEvents.find((e) => {
      if (e.cat_id !== catId) return false;
      // Cast loosely — 'diary_entry' isn't yet in HealthEventType but will be.
      if ((e.type as string) !== 'diary_entry') return false;
      const ts = new Date(e.ts).getTime();
      return ts >= startMs && ts <= endMs;
    });
    yesterdaysDiary =
      (diaryEvent?.payload as { body?: string } | undefined)?.body ?? null;
  }

  // ── 8. Check-in patterns (mood + appetite trends) ──────────────────────
  // Surfaces "3× off mood, 2× missed meals over last week" without each
  // consumer having to re-aggregate. Triage + behaviour reader + Diary
  // all benefit.
  const checkinPatterns = aggregateCheckinPatterns(
    allEvents.filter((e) => e.cat_id === catId),
    recencyWindowDays,
  );

  return {
    profile,
    reminders,
    vaccinations,
    medicationDoses,
    weightHistory,
    appointments,
    painScores,
    dailyCheckinStreak: dailyCheckinStreakValue,
    worldEntries: worldEntriesForCat,
    recentTriage,
    recentEvents,
    behaviorTags,
    recentMeowSignals,
    sleepBaseline,
    yesterdaysDiary,
    checkinPatterns,
    generatedAt: new Date().toISOString(),
    recencyWindowDays,
  };
}

/**
 * Convenience: build a context for the *currently active* cat. Returns null
 * if no cat is active (e.g. before onboarding). Most callers should use this.
 */
export function buildActiveCatContext(
  opts: CatContextOptions = {},
): CatContext | null {
  const activeCatId = useCatStore.getState().activeCatId;
  if (!activeCatId) return null;
  return buildCatContext(activeCatId, opts);
}

/**
 * Render a CatContext as a compact human-readable string suitable for
 * inclusion in an AI system / user prompt. Skips empty sections so prompts
 * don't waste tokens on "No conditions."
 *
 * AI modules that want maximum control over prompt formatting can read the
 * raw CatContext directly — this helper is for the common case.
 */
export function renderCatContextForPrompt(ctx: CatContext): string {
  const lines: string[] = [];

  if (ctx.profile) {
    const p = ctx.profile;
    lines.push('## Cat profile');
    lines.push(`Name: ${p.name}`);
    if (p.breed) lines.push(`Breed: ${p.breed}`);
    // DOB is the authoritative age source — render it so the cat can
    // answer "when's your birthday?" with the actual date, not just "in
    // N days" (which is what anticipationEvents already covers).
    if (p.dobIso) lines.push(`Date of birth: ${p.dobIso}`);
    if (p.ageMonths != null) {
      // Render BOTH years and months — answers both "how old are you"
      // (years) and "how old in months" (precise) without the model
      // having to compute it from the DOB string.
      const years = Math.floor(p.ageMonths / 12);
      const remMonths = p.ageMonths % 12;
      const ageStr =
        years > 0 && remMonths > 0
          ? `${years} years ${remMonths} months (${p.ageMonths} months total)`
          : years > 0
            ? `${years} years (${p.ageMonths} months total)`
            : `${p.ageMonths} months`;
      lines.push(`Age: ${ageStr}`);
    } else if (p.ageYears != null) {
      lines.push(`Age: ~${p.ageYears} years`);
    }
    if (p.adoptedOnIso) lines.push(`Adopted on: ${p.adoptedOnIso}`);
    if (p.weightKg != null) lines.push(`Weight: ${p.weightKg} kg`);
    if (p.sex !== 'unknown') lines.push(`Sex: ${p.sex}`);
    lines.push(`Lifestyle: ${p.indoorOutdoor}`);
    if (p.spayedNeutered != null) {
      lines.push(`Spayed/neutered: ${p.spayedNeutered ? 'yes' : 'no'}`);
    }
    if (p.conditions.length > 0) {
      lines.push(`Known conditions: ${p.conditions.join(', ')}`);
    }
    if (p.medications.length > 0) {
      lines.push(`Current medications: ${p.medications.join(', ')}`);
    }
    if (p.emergencyVetName || p.emergencyVetPhone) {
      const vet = [p.emergencyVetName, p.emergencyVetPhone].filter(Boolean).join(' / ');
      lines.push(`Emergency vet: ${vet}`);
    }
    if (p.notes) lines.push(`Owner notes: ${p.notes}`);
  } else {
    lines.push('No cat profile available.');
  }

  // ── Reminders block — surfaces "when is my medicine due?" answers ──
  const r = ctx.reminders;
  if (r.medTime || r.checkinTime) {
    lines.push('');
    lines.push('## Reminders');
    if (r.medTime) {
      lines.push(`Daily medication reminder: ${r.medTime} (local time, every day)`);
    }
    if (r.checkinTime && r.checkinWeekday != null) {
      const weekdays = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = weekdays[r.checkinWeekday] ?? `weekday-${r.checkinWeekday}`;
      lines.push(`Weekly check-in reminder: ${dayName} at ${r.checkinTime} (local time)`);
    }
  }

  // ── Vaccinations — last given per vaccine + next due + overdue ─────
  const vacc = ctx.vaccinations;
  if (vacc.history.length > 0 || vacc.overdue.length > 0) {
    lines.push('');
    lines.push('## Vaccinations');
    for (const v of vacc.history) {
      const dueStr = v.next_due ? ` (next due ${v.next_due})` : '';
      const byStr = v.administered_by ? ` by ${v.administered_by}` : '';
      lines.push(`- ${v.given_on}: ${v.vaccine}${byStr}${dueStr}`);
    }
    if (vacc.nextDue) {
      lines.push(`NEXT DUE: ${vacc.nextDue.vaccine} on ${vacc.nextDue.next_due} (in ${vacc.nextDue.daysUntil} day${vacc.nextDue.daysUntil === 1 ? '' : 's'})`);
    }
    if (vacc.overdue.length > 0) {
      for (const o of vacc.overdue) {
        lines.push(`OVERDUE: ${o.vaccine} was due ${o.next_due} (${o.daysOverdue} day${o.daysOverdue === 1 ? '' : 's'} late)`);
      }
    }
  }

  // ── Medication doses — adherence summary per medication ────────────
  const md = ctx.medicationDoses;
  if (md.perMed.length > 0) {
    lines.push('');
    lines.push(`## Recent medication doses (last ${ctx.recencyWindowDays} days)`);
    for (const m of md.perMed) {
      const last = m.lastDoseAt
        ? `last dose ${m.lastDoseAt.slice(0, 10)} ${m.lastDoseAt.slice(11, 16)}`
        : 'no doses logged';
      lines.push(`- ${m.medication}: ${m.dosesInWindow} dose${m.dosesInWindow === 1 ? '' : 's'} logged, ${last}`);
    }
  }

  // ── Weight history + 90-day trend ──────────────────────────────────
  const wh = ctx.weightHistory;
  if (wh.recent.length > 0) {
    lines.push('');
    lines.push('## Weight history');
    for (const w of wh.recent) {
      const bcsStr = w.bcs != null ? ` (BCS ${w.bcs}/9)` : '';
      lines.push(`- ${w.measured_at.slice(0, 10)}: ${w.weight_kg} kg${bcsStr}`);
    }
    if (wh.trend90d) {
      const sign = wh.trend90d.deltaKg > 0 ? '+' : '';
      const word =
        wh.trend90d.direction === 'stable'
          ? 'stable'
          : wh.trend90d.direction === 'up'
            ? 'gaining'
            : 'losing';
      lines.push(
        `90-day trend: ${word} (${sign}${wh.trend90d.deltaKg} kg, ${wh.trend90d.fromKg} → ${wh.trend90d.toKg} kg)`,
      );
    }
  }

  // ── Appointments — next + recent completed ─────────────────────────
  const ap = ctx.appointments;
  if (ap.next || ap.recentCompleted.length > 0) {
    lines.push('');
    lines.push('## Vet appointments');
    if (ap.next) {
      const vetStr = ap.next.vet ? ` with ${ap.next.vet}` : '';
      const reasonStr = ap.next.reason ? ` — ${ap.next.reason}` : '';
      lines.push(
        `NEXT: ${ap.next.scheduled_for.slice(0, 16).replace('T', ' ')}${vetStr} — ${ap.next.title}${reasonStr} (in ${ap.next.daysUntil} day${ap.next.daysUntil === 1 ? '' : 's'})`,
      );
    }
    for (const c of ap.recentCompleted) {
      const outcomeStr = c.outcome_notes ? ` → ${c.outcome_notes.slice(0, 100)}` : '';
      lines.push(
        `- ${c.scheduled_for.slice(0, 10)} (${c.daysAgo}d ago): ${c.title}${outcomeStr}`,
      );
    }
  }

  // ── Pain scores — recent FGS measurements ──────────────────────────
  const ps = ctx.painScores;
  if (ps.recent.length > 0) {
    lines.push('');
    lines.push('## Recent pain scores (Feline Grimace Scale, 0-10)');
    for (const p of ps.recent) {
      lines.push(`- ${p.daysAgo}d ago: composite ${p.composite}/10`);
    }
  }

  // ── Daily check-in streak — habit anchor ──────────────────────────
  if (ctx.dailyCheckinStreak >= 3) {
    lines.push('');
    lines.push(`## Daily check-in streak: ${ctx.dailyCheckinStreak} day${ctx.dailyCheckinStreak === 1 ? '' : 's'} in a row`);
  }

  // ── World Memory — REAL things the cat knows ──────────────────────
  // Group by kind so the model sees a structured registry. The
  // accompanying VOICE_RULES rule says: reference items from THIS
  // list, never invent. If the registry is empty, omit the side
  // observation entirely (better than hallucinating).
  if (ctx.worldEntries.length > 0) {
    // Group + sort so the model sees the most-recently-referenced
    // first within each kind (those are the "live" items).
    const byKind: Record<string, WorldEntry[]> = {
      object: [], furniture: [], toy: [], place: [], environment: [],
    };
    for (const e of ctx.worldEntries) {
      if (byKind[e.kind]) byKind[e.kind].push(e);
    }
    const sortByRecent = (a: WorldEntry, b: WorldEntry) => {
      const aRef = a.last_referenced_at ?? a.created_at;
      const bRef = b.last_referenced_at ?? b.created_at;
      return bRef.localeCompare(aRef);
    };
    for (const k of Object.keys(byKind)) byKind[k].sort(sortByRecent);

    lines.push('');
    lines.push(
      "## ⚠️ YOUR WORLD — REAL things in your environment (REFERENCE THESE, NEVER INVENT)",
    );
    lines.push(
      'These are the actual objects, places, toys, and surroundings your human has told you about. When you make a side-observation in a reply or diary entry, draw from THIS list. Do NOT invent props that aren\'t here ("the cup at the edge", "the radiator was cold") — that breaks the bond by referencing things that don\'t exist. If this list is empty for the kind you\'d reference, omit the side-observation entirely; that\'s better than fabricating.',
    );

    const kindLabels: Record<string, string> = {
      object: 'Objects',
      furniture: 'Furniture',
      toy: 'Toys',
      place: 'Places (rooms / outdoor / spots)',
      environment: 'Today / environment',
    };
    for (const [k, list] of Object.entries(byKind)) {
      if (list.length === 0) continue;
      lines.push(`### ${kindLabels[k] ?? k}`);
      for (const e of list.slice(0, 12)) {
        const parts: string[] = [`"${e.name}"`];
        if (e.color) parts.push(`color: ${e.color}`);
        if (e.location) parts.push(`location: ${e.location}`);
        if (e.sentiment) parts.push(`you ${e.sentiment} this`);
        if (e.acquired_at) parts.push(`acquired ${e.acquired_at}`);
        if (e.description) parts.push(`note: ${e.description.slice(0, 120)}`);
        lines.push(`- ${parts.join(' · ')}`);
      }
    }
  }

  if (ctx.recentTriage.length > 0) {
    lines.push('');
    lines.push(`## Recent triage (last ${ctx.recencyWindowDays} days)`);
    for (const t of ctx.recentTriage) {
      const tag = t.hardUrgency ? '⚠️ HARD-URGENCY ' : '';
      lines.push(
        `- ${tag}${t.daysAgo}d ago — ${t.tier} (${t.score}/100): ${t.primaryConcern}`,
      );
    }
  }

  const tagEntries = Object.entries(ctx.behaviorTags).sort(
    (a, b) => b[1] - a[1],
  );
  if (tagEntries.length > 0) {
    lines.push('');
    lines.push(`## Behaviour patterns (last ${ctx.recencyWindowDays} days)`);
    lines.push(
      tagEntries
        .slice(0, 8)
        .map(([tag, count]) => `${tag} (${count}×)`)
        .join(', '),
    );
  }

  // Daily check-in patterns — surface mood + appetite trends + most-recent
  // values. AI prompts use these as the primary "is the owner reporting
  // anything off lately" signal.
  const cp = ctx.checkinPatterns;
  if (cp.daysLogged > 0) {
    lines.push('');
    lines.push(`## Daily check-ins (last ${ctx.recencyWindowDays} days, ${cp.daysLogged} days logged)`);
    const moodParts: string[] = [];
    if (cp.mood.happy > 0) moodParts.push(`${cp.mood.happy}× happy`);
    if (cp.mood.normal > 0) moodParts.push(`${cp.mood.normal}× normal`);
    if (cp.mood.off > 0) moodParts.push(`${cp.mood.off}× off`);
    if (moodParts.length) lines.push(`Mood: ${moodParts.join(', ')}`);
    const appetiteParts: string[] = [];
    if (cp.appetite.full > 0) appetiteParts.push(`${cp.appetite.full}× full`);
    if (cp.appetite.half > 0) appetiteParts.push(`${cp.appetite.half}× half`);
    if (cp.appetite.none > 0) appetiteParts.push(`${cp.appetite.none}× none`);
    if (appetiteParts.length) lines.push(`Appetite: ${appetiteParts.join(', ')}`);
    if (cp.mostRecentMood && cp.mostRecentAppetite) {
      lines.push(`Most recent: ${cp.mostRecentMood} mood + ${cp.mostRecentAppetite} bowl`);
    }
  }

  // Recent behaviour-observation paragraphs (full text, last 1-2). These
  // give the model a richer "what was going on yesterday" picture than tag
  // counts alone — especially valuable for Triage when interpreting a
  // current concern against a recent baseline observation.
  const recentBehaviorObs = ctx.recentEvents
    .filter((e) => e.type === 'behavior_observation')
    .slice(0, 2);
  if (recentBehaviorObs.length > 0) {
    lines.push('');
    lines.push('## Recent behaviour observations');
    for (const e of recentBehaviorObs) {
      const p = e.payload as { observation?: string };
      const daysAgo = Math.floor(
        (Date.now() - new Date(e.ts).getTime()) / DAY_MS,
      );
      if (p.observation) {
        lines.push(`- ${daysAgo}d ago: ${p.observation.slice(0, 250)}`);
      }
    }
  }

  if (ctx.recentMeowSignals.length > 0) {
    lines.push('');
    lines.push('## Recent meow signals');
    for (const m of ctx.recentMeowSignals) {
      lines.push(
        `- ${m.daysAgo}d ago — ${m.type}: ${m.label} (${Math.round(m.confidence * 100)}% confident)`,
      );
    }
  }

  if (ctx.sleepBaseline) {
    lines.push('');
    lines.push('## Sleep baseline');
    if (ctx.sleepBaseline.avgSleepHours != null) {
      lines.push(`Avg sleep: ${ctx.sleepBaseline.avgSleepHours.toFixed(1)}h`);
    }
    if (ctx.sleepBaseline.avgSrr != null) {
      lines.push(`Avg sleeping respiratory rate: ${ctx.sleepBaseline.avgSrr.toFixed(0)}/min`);
    }
    lines.push(`7-day trend: ${ctx.sleepBaseline.last7DayTrend}`);
  }

  if (ctx.yesterdaysDiary) {
    lines.push('');
    lines.push("## Yesterday's diary entry");
    lines.push(ctx.yesterdaysDiary);
  }

  return lines.join('\n');
}

/**
 * Convert a CatContext to the legacy CatProfileSummary shape used by
 * `runTriage()` / `buildTriageUserPrompt()`. Lets the triage module migrate
 * incrementally — callers can pass a full CatContext now and the existing
 * prompt builder continues to work without churn.
 */
export function catContextToProfileSummary(
  ctx: CatContext,
): {
  name: string;
  breed: string | null;
  age_months: number | null;
  weight_kg: number | null;
  sex: 'male' | 'female' | 'unknown';
  indoor_outdoor: Lifestyle;
  conditions: string[];
  medications: string[];
} | null {
  if (!ctx.profile) return null;
  const p = ctx.profile;
  return {
    name: p.name,
    breed: p.breed,
    age_months: p.ageMonths,
    weight_kg: p.weightKg,
    sex: p.sex,
    indoor_outdoor: p.indoorOutdoor,
    conditions: p.conditions,
    medications: p.medications,
  };
}

/**
 * Test-only export — lets a smoke script verify the recency math without
 * mocking the entire store layer.
 */
export const __test__ = {
  DEFAULT_RECENCY_DAYS,
  HARD_URGENCY_RECENCY_DAYS,
  daysAgoFrom,
  ageYearsFromMonths,
};
