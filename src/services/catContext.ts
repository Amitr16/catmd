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
import {
  useWorldStore,
  type WorldEntry,
  type WorldScene,
} from '../state/worldStore';
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

  /**
   * Today, vivid — chronologically-ordered list of TODAY's events. The
   * cat has SHARP recall for today; older days fade into the
   * salience-filtered `recentEvents`. Surfaces as a dedicated "## Today
   * (vivid)" block in the prompt so the cat references today's actual
   * sequence ("you checked in at 09:14 — I felt off; the photo on the
   * green chair at 11:30; ...") instead of treating it as one of 14
   * undifferentiated days.
   *
   * Built from healthStore + scenes today. Mostly facts; one sensory
   * field per row when available.
   */
  todayVivid: Array<{
    /** Event kind for prompt grouping. */
    kind:
      | 'checkin'
      | 'photo_scene'
      | 'behavior_observation'
      | 'meow_translation'
      | 'weight'
      | 'medication_dose'
      | 'water_intake'
      | 'litter_box_use'
      | 'scan';
    /** HH:MM local — what time of day this happened. */
    hhmm: string;
    /** One-line description, sensory-anchored where possible. */
    text: string;
  }>;

  /**
   * What shifted today vs the cat's baseline. Deterministic deltas the
   * model can reference without inventing ("you were quiet this
   * morning", "no photos today"). Capped at 3 to avoid noise.
   */
  todayDeltas: Array<{
    /** Stable id for telemetry. */
    id: 'late_checkin' | 'missed_checkin' | 'no_photos_today' | 'unusual_absence' | 'mood_shift';
    /** One-sentence phrasing the prompt can lift directly. */
    text: string;
  }>;

  /**
   * Body self-image — derived from breed + age + weight + BCS. This is what
   * the cat KNOWS about its own body. Pre-Phase: chat/diary only knew the
   * raw number (4.5 kg) but had no felt-sense vocabulary — Lily couldn't
   * say "I'm a medium-build cat, fast on the curtains, less elegant on
   * the leap to the top shelf" because the prompt didn't carry that.
   *
   * Now derived deterministically here so chat, diary, AND the meow
   * translator all share the same body-attitude — keeps the cat's voice
   * consistent across surfaces.
   *
   * Null when there's no profile at all. Each field nullable so a brand-
   * new cat with no weight logged still gets a partial read (age stage +
   * breed build) without the size-class line.
   */
  bodySelf: {
    /**
     * Age life-stage — kitten / young adult / adult / mature / senior /
     * geriatric. Each comes with a default attitude register the
     * prompt uses to calibrate tone (kitten energy → senior dignity).
     */
    ageStage:
      | 'kitten'
      | 'young_adult'
      | 'adult'
      | 'mature'
      | 'senior'
      | 'geriatric'
      | 'unknown';
    /** One-line attitude hint for the age stage, used in the prompt. */
    ageAttitudeHint: string;
    /**
     * Breed-driven build archetype. Lithe = Bengal / Siamese / Cornish
     * Rex. Medium = DSH / Tonkinese. Sturdy = British Shorthair /
     * Russian Blue. Heavy = Maine Coon / Ragdoll / Persian. Drives the
     * default body-attitude even when no weight is logged.
     */
    buildArchetype: 'lithe' | 'medium' | 'sturdy' | 'heavy' | 'unknown';
    /**
     * Size class derived from weight vs breed-expected range. Null
     * when no weight is logged. Lean = below range; ideal = in range;
     * heavy = above range; chonky = well above range.
     */
    sizeClass: 'lean' | 'ideal' | 'heavy' | 'chonky' | null;
    /**
     * BCS overlay — when logged, sharper than weight-vs-breed because it
     * accounts for body shape, not just mass. Mirrors the 1-9 WSAVA
     * scale collapsed to category.
     */
    bcsClass:
      | 'underweight'   // BCS 1-3
      | 'ideal'         // BCS 4-5
      | 'overweight'    // BCS 6-7
      | 'obese'         // BCS 8-9
      | null;
    /**
     * Composite one-line self-image the prompt can read directly.
     * "lithe young adult Bengal, 4.2 kg, lean" or "stocky senior
     * British Shorthair, 5.8 kg, slightly heavy". Renders cleanly even
     * when half the inputs are missing.
     */
    selfImage: string;
    /**
     * Tone directive for the prompt — one sentence telling the model
     * HOW to weave self-image into the voice. Calibrated to the age +
     * build + size combo so a senior Maine Coon and a kitten Bengal
     * never sound the same.
     */
    toneDirective: string;
  } | null;

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
  /**
   * Today-ONLY check-in fields (audit 2026-05-14 round 10 P1 #2 fix).
   * Pre-fix, chat treated `mostRecentMood` as "today's mood" which
   * leaked yesterday's `off` mood into today's "How you feel today"
   * block + mood-pool gating when the user skipped today's check-in.
   * These fields are null if no check-in landed on the local-today
   * date — callers must distinguish "today" from "most recent".
   */
  todayMood: 'happy' | 'normal' | 'off' | null;
  todayAppetite: 'full' | 'half' | 'none' | null;
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
    todayMood: null,
    todayAppetite: null,
  };

  // Local today's date key in YYYY-MM-DD — same shape as the dateKey
  // helper elsewhere. Used to gate `todayMood` / `todayAppetite`
  // separately from `mostRecentMood` (audit 2026-05-14 round 10).
  const nowLocal = new Date();
  const todayKey = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;

  const seenDays = new Set<string>();
  for (const e of checkins) {
    const p = e.payload as { mood?: string; appetite?: string };
    if (p.mood && p.mood in out.mood) {
      out.mood[p.mood as keyof typeof out.mood]++;
    }
    if (p.appetite && p.appetite in out.appetite) {
      out.appetite[p.appetite as keyof typeof out.appetite]++;
    }
    // Track local-date buckets for daysLogged.
    try {
      const ed = new Date(e.ts);
      const k = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;
      seenDays.add(k);
    } catch {
      // skip malformed timestamps
    }
  }
  out.daysLogged = seenDays.size;
  if (checkins.length > 0) {
    const latest = checkins[0];
    const p = latest.payload as { mood?: string; appetite?: string };
    out.mostRecentMood = (p.mood as CheckinPattern['mostRecentMood']) ?? null;
    out.mostRecentAppetite = (p.appetite as CheckinPattern['mostRecentAppetite']) ?? null;
    out.mostRecentAt = latest.ts;
  }
  // Today-only fields — find the most recent check-in whose LOCAL
  // date matches today. Checkins are already sorted desc by ts so
  // the first one matching today is the most-recent-today.
  for (const e of checkins) {
    try {
      const ed = new Date(e.ts);
      const k = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;
      if (k !== todayKey) continue;
    } catch {
      continue;
    }
    const p = e.payload as { mood?: string; appetite?: string };
    out.todayMood = (p.mood as CheckinPattern['todayMood']) ?? null;
    out.todayAppetite = (p.appetite as CheckinPattern['todayAppetite']) ?? null;
    break;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Body self-image derivation
// ──────────────────────────────────────────────────────────────────────
//
// Pure functions. Take raw profile + latest BCS, return the cat's
// "felt-sense" body image. Designed so chat, diary, and the meow
// translator all share the SAME register — Lily sounds like the same
// cat whether she's writing a diary entry or saying one shareable
// line in the translator.
//
// Why this exists: prior to 2026-05-11 the AI prompts had access to
// weight (4.5 kg) and breed (Maine Coon) but NO derived body-attitude.
// Owners would ask "are you fat?" and get a quoted number, not a
// voiced answer. Now the cat has a self-image — "stocky senior Maine
// Coon, 7.1 kg, appropriate hefty" — and a tone directive telling
// the model HOW to wear it in its voice.

/**
 * Breed → expected weight range + build archetype. Drawn from the AAFP
 * breed-standard summary + popular breed-profile sources. When the
 * owner's cat doesn't match any entry (mixed/DSH/unknown breed), we
 * fall back to the DSH defaults. Ranges are intentionally wide to
 * accommodate sex + neutered-status variance.
 *
 * The build archetype here is the BREED's silhouette — not the
 * individual cat's body. A Maine Coon at the low end of its weight
 * range is still a "heavy" build (long-bodied, dense). A DSH at 6.5kg
 * is "medium build, heavy individual" — the size class captures the
 * individual deviation.
 */
type BreedSpec = {
  /** Lower bound of healthy weight, kg. */
  lowKg: number;
  /** Upper bound of healthy weight, kg. */
  highKg: number;
  build: 'lithe' | 'medium' | 'sturdy' | 'heavy';
};

const BREED_SPECS: Record<string, BreedSpec> = {
  // Lithe / oriental — long-bodied, fine-boned, fast
  'siamese':         { lowKg: 2.5, highKg: 5.0, build: 'lithe' },
  'oriental':        { lowKg: 2.5, highKg: 5.0, build: 'lithe' },
  'oriental shorthair': { lowKg: 2.5, highKg: 5.0, build: 'lithe' },
  'cornish rex':     { lowKg: 2.5, highKg: 4.5, build: 'lithe' },
  'devon rex':       { lowKg: 2.5, highKg: 4.5, build: 'lithe' },
  'abyssinian':      { lowKg: 3.0, highKg: 5.0, build: 'lithe' },
  'bengal':          { lowKg: 3.5, highKg: 7.0, build: 'lithe' },
  'savannah':        { lowKg: 5.0, highKg: 9.0, build: 'lithe' },
  'singapura':       { lowKg: 1.8, highKg: 3.5, build: 'lithe' },
  'sphynx':          { lowKg: 3.0, highKg: 5.5, build: 'lithe' },
  'tonkinese':       { lowKg: 3.0, highKg: 5.5, build: 'lithe' },
  'balinese':        { lowKg: 2.5, highKg: 5.0, build: 'lithe' },
  'japanese bobtail':{ lowKg: 2.5, highKg: 4.5, build: 'lithe' },
  // Medium — DSH default territory
  'domestic shorthair': { lowKg: 3.5, highKg: 5.5, build: 'medium' },
  'dsh':                { lowKg: 3.5, highKg: 5.5, build: 'medium' },
  'mixed':              { lowKg: 3.5, highKg: 5.5, build: 'medium' },
  'domestic longhair':  { lowKg: 3.5, highKg: 5.5, build: 'medium' },
  'dlh':                { lowKg: 3.5, highKg: 5.5, build: 'medium' },
  'burmese':            { lowKg: 3.5, highKg: 5.5, build: 'medium' },
  'turkish angora':     { lowKg: 3.0, highKg: 5.0, build: 'medium' },
  'american shorthair': { lowKg: 4.0, highKg: 6.5, build: 'medium' },
  'egyptian mau':       { lowKg: 3.5, highKg: 5.5, build: 'medium' },
  // Sturdy — broad-bodied, dense, often plush coat
  'british shorthair':  { lowKg: 4.0, highKg: 7.5, build: 'sturdy' },
  'british longhair':   { lowKg: 4.0, highKg: 7.5, build: 'sturdy' },
  'russian blue':       { lowKg: 3.5, highKg: 5.5, build: 'sturdy' },
  'scottish fold':      { lowKg: 3.5, highKg: 6.0, build: 'sturdy' },
  'persian':            { lowKg: 3.5, highKg: 5.5, build: 'sturdy' },
  'exotic shorthair':   { lowKg: 3.5, highKg: 5.5, build: 'sturdy' },
  'chartreux':          { lowKg: 3.5, highKg: 7.0, build: 'sturdy' },
  'manx':               { lowKg: 3.5, highKg: 5.5, build: 'sturdy' },
  'bombay':             { lowKg: 3.5, highKg: 5.0, build: 'sturdy' },
  'snowshoe':           { lowKg: 3.5, highKg: 5.5, build: 'sturdy' },
  // Heavy — large, long-bodied, slow-maturing
  'maine coon':         { lowKg: 4.5, highKg: 8.5, build: 'heavy' },
  'norwegian forest':   { lowKg: 4.0, highKg: 7.5, build: 'heavy' },
  'ragdoll':            { lowKg: 4.5, highKg: 9.0, build: 'heavy' },
  'ragamuffin':         { lowKg: 4.0, highKg: 9.0, build: 'heavy' },
  'siberian':           { lowKg: 4.5, highKg: 8.0, build: 'heavy' },
  'turkish van':        { lowKg: 4.0, highKg: 8.0, build: 'heavy' },
};

/**
 * Look up the breed spec — case-insensitive, partial-match-tolerant.
 * Returns DSH defaults when no entry found.
 */
function specForBreed(breed: string | null): BreedSpec {
  if (!breed) return BREED_SPECS['domestic shorthair']!;
  const key = breed.toLowerCase().trim();
  if (BREED_SPECS[key]) return BREED_SPECS[key]!;
  // Partial-match fallback — handles "Maine Coon mix", "DSH (tabby)"
  for (const [name, spec] of Object.entries(BREED_SPECS)) {
    if (key.includes(name)) return spec;
  }
  return BREED_SPECS['domestic shorthair']!;
}

/**
 * Map life-stage months to a categorical stage + a one-line attitude
 * register the prompt can lean into. Cutoffs come from AAFP/AAHA
 * Feline Life Stage Guidelines (2010, reaffirmed 2021).
 */
function deriveAgeStage(ageMonths: number | null): {
  stage: CatContext['bodySelf'] extends infer T
    ? T extends { ageStage: infer S }
      ? S
      : never
    : never;
  hint: string;
} {
  if (ageMonths == null) {
    return {
      stage: 'unknown',
      hint: 'no age set — speak generally about your body, no age-specific beats',
    };
  }
  if (ageMonths < 12) {
    return {
      stage: 'kitten',
      hint: 'kitten energy — light, fast, curious, occasionally clumsy, EVERYTHING is new',
    };
  }
  if (ageMonths < 36) {
    return {
      stage: 'young_adult',
      hint: 'young-adult swagger — fast, athletic, still showing off, body fully capable',
    };
  }
  if (ageMonths < 84) {
    return {
      stage: 'adult',
      hint: 'adult prime — confident in your body, no apologies, full physical authority',
    };
  }
  if (ageMonths < 132) {
    return {
      stage: 'mature',
      hint: 'middle-aged dignity — still capable but more selective, a touch slower to commit',
    };
  }
  if (ageMonths < 180) {
    return {
      stage: 'senior',
      hint: 'senior wisdom — stairs are a conversation, leaps are calculated, body is to be respected',
    };
  }
  return {
    stage: 'geriatric',
    hint: 'geriatric — slow, deliberate, dignified; the body is the conversation now',
  };
}

/**
 * Compute size class from weight vs breed-expected range.
 * - lean: 10%+ below the low end
 * - ideal: within range
 * - heavy: 0-15% above the high end
 * - chonky: 15%+ above the high end
 */
function deriveSizeClass(
  weightKg: number | null,
  spec: BreedSpec,
): 'lean' | 'ideal' | 'heavy' | 'chonky' | null {
  if (weightKg == null) return null;
  if (weightKg < spec.lowKg * 0.9) return 'lean';
  if (weightKg <= spec.highKg) return 'ideal';
  if (weightKg <= spec.highKg * 1.15) return 'heavy';
  return 'chonky';
}

/**
 * Map BCS 1-9 (WSAVA scale) to a category. Null when not logged —
 * weight-vs-range is the fallback.
 */
function deriveBcsClass(
  bcs: number | null,
): 'underweight' | 'ideal' | 'overweight' | 'obese' | null {
  if (bcs == null) return null;
  if (bcs <= 3) return 'underweight';
  if (bcs <= 5) return 'ideal';
  if (bcs <= 7) return 'overweight';
  return 'obese';
}

/**
 * Build the composite self-image string + tone directive. This is the
 * literal string the prompt sees — keep it short, vivid, and free of
 * clinical register ("BCS 7/9" never appears here; "comfortably plush"
 * does). The tone directive is one sentence telling the model HOW
 * the cat should wear this self-image in its voice — never "I weigh
 * 7.1 kg", always "I'm a heavy cat, you have to actually move me".
 *
 * Exported so callers outside of buildCatContext (e.g. the diary
 * prompt builder, which doesn't construct a full CatContext) can
 * compute the same self-image cheaply from the raw profile fields.
 * Pass the latest BCS separately — the diary already has it from its
 * own weight-event lookup, no need to plumb the whole context.
 */
export function deriveBodySelf(
  profile: {
    name: string;
    breed: string | null;
    ageMonths: number | null;
    weightKg: number | null;
  } | null,
  latestBcs: number | null,
): CatContext['bodySelf'] {
  if (!profile) return null;
  const spec = specForBreed(profile.breed);
  const { stage: ageStage, hint: ageAttitudeHint } = deriveAgeStage(profile.ageMonths);
  const buildArchetype = spec.build;
  const sizeClass = deriveSizeClass(profile.weightKg, spec);
  const bcsClass = deriveBcsClass(latestBcs);

  // Build the self-image string from whichever pieces are populated.
  // Skeleton: "{size-prefix?} {build} {age-stage} {breed}, {weight?}{bcs?}".
  // Example outputs:
  //   "lithe young-adult Bengal, 4.2 kg — ideal weight"
  //   "stocky senior Maine Coon, 7.3 kg — comfortably plush"
  //   "medium adult DSH — weight not logged"
  //   "kitten DSH — still growing"
  const parts: string[] = [];

  // Size prefix only when it deviates from "ideal" — keeps the line
  // from being noisy for in-range cats.
  if (sizeClass === 'lean') parts.push('lean');
  else if (sizeClass === 'heavy') parts.push('a touch heavy for a');
  else if (sizeClass === 'chonky') parts.push('hefty');

  // Build adjective unless we already prefixed with a size word that
  // overrides it (e.g. "lean" implies lithe regardless of breed).
  if (parts.length === 0 || sizeClass === 'heavy' || sizeClass === 'chonky') {
    parts.push(buildArchetype === 'lithe' ? 'lithe' :
               buildArchetype === 'sturdy' ? 'stocky' :
               buildArchetype === 'heavy' ? 'long-bodied' :
               'medium-build');
  }

  // Age stage word
  const ageWord: Record<typeof ageStage, string> = {
    kitten: 'kitten',
    young_adult: 'young-adult',
    adult: 'adult',
    mature: 'middle-aged',
    senior: 'senior',
    geriatric: 'elder',
    unknown: '',
  };
  if (ageWord[ageStage]) parts.push(ageWord[ageStage]);

  // Breed (preserve user's casing if known, otherwise lowercase tag)
  if (profile.breed) parts.push(profile.breed);
  else parts.push('cat');

  let selfImage = parts.join(' ');

  // Weight + BCS suffix
  if (profile.weightKg != null) {
    selfImage += `, ${profile.weightKg} kg`;
  }
  if (bcsClass) {
    const bcsWord = {
      underweight: 'underweight',
      ideal: 'ideal weight',
      overweight: 'comfortably plush',
      obese: 'carrying extra',
    }[bcsClass];
    selfImage += ` — ${bcsWord}`;
  } else if (sizeClass) {
    const sizeWord = {
      lean: 'on the lean side',
      ideal: 'in-range',
      heavy: 'on the heavier side',
      chonky: 'noticeably hefty',
    }[sizeClass];
    selfImage += ` (${sizeWord} for the breed)`;
  } else if (profile.weightKg == null) {
    selfImage += ` — weight not logged`;
  }

  // Tone directive — combines age stage + size attitude. We do NOT
  // tell the model to constantly bring up size; we tell it to wear
  // the body NATURALLY when relevant ("the stairs are a conversation
  // now", "I'm a 7 kg cat, you have to move me, not the other way
  // round"). Negative case: don't apologise, don't fish for
  // reassurance, don't disclose the BCS number out loud.
  const sizeBeats: Record<NonNullable<typeof sizeClass> | 'none', string> = {
    lean: 'when relevant, mention you are lean / fast / sparse — never as a deficiency',
    ideal: 'speak from a body that fits — neutral, capable, no apology',
    heavy: 'when relevant, acknowledge your weight matters — others have to move you',
    chonky: 'wear your size matter-of-factly — gravity, dignity, no shame',
    none: 'speak from your build (lithe vs stocky) — no weight references until logged',
  };
  const sizeBeat = sizeBeats[sizeClass ?? 'none'];

  const toneDirective = [
    `BODY SELF-IMAGE: ${selfImage}.`,
    `Age beat: ${ageAttitudeHint}.`,
    `Body beat: ${sizeBeat}.`,
    'Wear your body in your voice when it is naturally relevant — climbing, jumping, sitting on the human, food, age-related slowness, breed-specific behaviour. Never quote the kg or BCS number out loud; speak in felt-sense ("I am a heavy cat", "I am fast on the curtains", "the stairs are negotiable now"). Never apologise for your size or fish for reassurance.',
  ].join(' ');

  return {
    ageStage,
    ageAttitudeHint,
    buildArchetype,
    sizeClass,
    bcsClass,
    selfImage,
    toneDirective,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Recency × salience filter
// ──────────────────────────────────────────────────────────────────────
//
// Cat memory isn't flat. Routine events fade fast; emotionally-salient
// events persist for weeks. This filter scores every recent event
// against an emotional-salience table, then applies a soft recency
// decay. Events below a threshold are dropped from the prompt — the
// model only sees the events a cat would actually still be carrying.
//
// Importantly: this REDUCES noise in the prompt. Older routine check-
// ins fall off; older hard-urgency triages persist. The cat sounds
// like she remembers what matters, not like she has a 14-day buffer.

/**
 * Emotional-salience weight per event type + payload signal. Higher =
 * sticks longer in memory. Tuned from feline-cognition research:
 * threat (vet, distress) and food-related (missed meal) persist
 * strongest; routine logging fades fastest.
 */
function eventSalience(e: HealthEvent): number {
  switch (e.type) {
    case 'daily_checkin': {
      const p = e.payload as { mood?: string; appetite?: string };
      if (p.appetite === 'none') return 0.85; // skipped meal = sharp
      if (p.mood === 'off') return 0.55;
      if (p.appetite === 'half') return 0.40;
      return 0.20; // routine "happy / full"
    }
    case 'behavior_observation': {
      const tags = ((e.payload as { tags?: string[] }).tags ?? []).join(' ');
      // Negative-state tags lift salience; routine relaxed reads stay low.
      if (/fearful|defensive|distress|hunched|limping|hiding|over/.test(tags))
        return 0.80;
      if (/annoyed|tail-lashing|alert|tracking/.test(tags)) return 0.45;
      return 0.30;
    }
    case 'meow_translation': {
      const p = e.payload as { intent?: string; confidence?: string };
      if (p.intent === 'distress') return 0.90;
      if (p.intent === 'warning' || p.intent === 'annoyed') return 0.55;
      if (p.confidence === 'high') return 0.45;
      return 0.30;
    }
    case 'weight': {
      // Weight events are mildly salient — they only become memorable
      // when paired with a 90-day trend, which the prompt surfaces
      // separately. Keep base low.
      return 0.25;
    }
    case 'symptom_photo':
      return 0.70;
    case 'pain_score': {
      const p = e.payload as { composite?: number };
      if (typeof p.composite === 'number' && p.composite >= 4) return 0.85;
      return 0.45;
    }
    case 'water_intake': {
      // Routine water sips fade fast. Unusually low intake (< 30ml in
      // a single log) is salient because polydipsia / dehydration are
      // clinically meaningful patterns — the cat would notice and
      // mention being thirstier than usual.
      const p = e.payload as { ml?: number };
      if (typeof p.ml === 'number' && p.ml > 0 && p.ml < 30) return 0.70;
      return 0.20;
    }
    case 'litter_box_use': {
      // Normal trips are background noise. ANY flagged-abnormal trip
      // is highly salient — urinary blockage, blood, straining patterns
      // are emergency-tier flags. Unknown kind ('both' / 'unknown')
      // gets a small bump too because it tends to correlate with the
      // owner noticing something unusual enough to log explicitly.
      const p = e.payload as { abnormal?: boolean; kind?: string };
      if (p.abnormal === true) return 0.85;
      if (p.kind === 'both' || p.kind === 'unknown') return 0.40;
      return 0.20;
    }
    case 'medication_dose':
      return 0.30;
    case 'vaccination':
    case 'appointment':
      return 0.40;
    case 'srr_measurement':
      return 0.35;
    case 'outcome_check':
      return 0.55;
    case 'feeding':
      return 0.20;
    default:
      return 0.25;
  }
}

/**
 * Recency decay — modelled as a piecewise curve roughly matching
 * cat-recall research (Takagi et al, Kyoto 2017; AAFP behavioral
 * consensus). Today is full strength; older days fade. NOT exponential
 * decay — the curve has a sharper today/yesterday cliff to mirror how
 * cats segment "now" vs "earlier".
 */
function recencyDecay(daysAgo: number): number {
  if (daysAgo <= 0) return 1.0; // today is vivid
  if (daysAgo === 1) return 0.75; // yesterday: still clear
  if (daysAgo <= 3) return 0.50;
  if (daysAgo <= 7) return 0.30;
  if (daysAgo <= 14) return 0.15;
  return 0.05;
}

/**
 * Persistence score = salience × decay. Events above the threshold
 * stay in the prompt; below are dropped. Threshold tuned so today's
 * routine events still pass (1.0 decay × 0.20 base = 0.20), while
 * 8-day-old routine check-ins (0.30 × 0.20 = 0.06) fall off.
 */
const SALIENCE_KEEP_THRESHOLD = 0.18;

function eventPersistence(e: HealthEvent, now: number): number {
  const daysAgo = daysAgoFrom(e.ts, now);
  return eventSalience(e) * recencyDecay(daysAgo);
}

// ──────────────────────────────────────────────────────────────────────
// Today-vivid + Today-deltas builders
// ──────────────────────────────────────────────────────────────────────

/** Pad a number to "HH:MM" local. */
function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function isToday(iso: string, todayStartMs: number): boolean {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return ts >= todayStartMs;
}

/**
 * Build the chronologically-ordered "today vivid" list. Each row is
 * one event with a time-of-day + a one-line description. Sensory-
 * anchored where the underlying payload affords it.
 */
function buildTodayVivid(
  events: HealthEvent[],
  scenes: WorldScene[],
  todayStartMs: number,
): CatContext['todayVivid'] {
  const rows: CatContext['todayVivid'] = [];

  for (const e of events) {
    if (!isToday(e.ts, todayStartMs)) continue;
    const t = hhmm(e.ts);
    switch (e.type) {
      case 'daily_checkin': {
        const p = e.payload as { mood?: string; appetite?: string };
        const moodWord = p.mood ?? '?';
        const appetiteWord = p.appetite ?? '?';
        rows.push({
          kind: 'checkin',
          hhmm: t,
          text: `owner did the daily check-in. you felt "${moodWord}", bowl was "${appetiteWord}".`,
        });
        break;
      }
      case 'behavior_observation': {
        const p = e.payload as { observation?: string; tags?: string[] };
        // Extract the "Most likely:" line if present, else the first
        // ~120 chars. The cat doesn't need the full multi-channel
        // read — just the headline.
        const obs = (p.observation ?? '').trim();
        const mostLikely = obs.match(/Most likely:\s*([\s\S]+?)(?:\n\n|$)/i);
        const headline = mostLikely
          ? mostLikely[1]!.split(/\n/)[0]!.slice(0, 140)
          : obs.split(/[.!?]\s/)[0]!.slice(0, 140);
        rows.push({
          kind: 'behavior_observation',
          hhmm: t,
          text: `owner recorded a body-language read. headline: "${headline}"`,
        });
        break;
      }
      case 'meow_translation': {
        const p = e.payload as { translation?: string };
        if (p.translation) {
          rows.push({
            kind: 'meow_translation',
            hhmm: t,
            text: `owner translated a meow of yours. the line: "${p.translation}"`,
          });
        }
        break;
      }
      case 'weight': {
        const p = e.payload as { weight_kg?: number };
        if (typeof p.weight_kg === 'number') {
          rows.push({
            kind: 'weight',
            hhmm: t,
            text: `owner weighed you. the scale moved beneath you.`,
          });
        }
        break;
      }
      case 'medication_dose': {
        rows.push({
          kind: 'medication_dose',
          hhmm: t,
          text: `owner gave you medication.`,
        });
        break;
      }
      case 'water_intake': {
        rows.push({
          kind: 'water_intake',
          hhmm: t,
          text: `owner topped up water.`,
        });
        break;
      }
      case 'litter_box_use': {
        rows.push({
          kind: 'litter_box_use',
          hhmm: t,
          text: `owner logged a litter trip.`,
        });
        break;
      }
      default:
        break;
    }
  }

  // Photo scenes — vision-grounded captions from today's photos /
  // video clips. Inserted with their observed_at time.
  for (const s of scenes) {
    if (!isToday(s.observed_at, todayStartMs)) continue;
    rows.push({
      kind: 'photo_scene',
      hhmm: hhmm(s.observed_at),
      text: `photo: ${s.caption}`,
    });
  }

  // Sort chronologically (oldest first within today, so the cat's
  // memory of today reads in order).
  rows.sort((a, b) => a.hhmm.localeCompare(b.hhmm));
  return rows;
}

/**
 * Compute deviations from baseline that the cat would NOTICE. Each
 * delta is one human-readable sentence the prompt can lift verbatim.
 * Deterministic — no LLM. Capped at 3.
 *
 * Rules right now (kept narrow; can grow):
 *   - late_checkin: usually checked-in by 9am, today not yet by 11am
 *   - missed_checkin: usually does check-ins on this weekday, none today by evening
 *   - no_photos_today: usually >=1 photo/day, today none by evening
 *   - mood_shift: today's mood differs sharply from last-3-days modal
 */
function buildTodayDeltas(
  events: HealthEvent[],
  scenes: WorldScene[],
  todayStartMs: number,
  now: number,
): CatContext['todayDeltas'] {
  const out: CatContext['todayDeltas'] = [];
  const nowDate = new Date(now);
  const currentHour = nowDate.getHours();

  // ── Build baselines from the last 14 days (excluding today) ──────
  const fourteenDaysAgoMs = now - 14 * DAY_MS;

  // Typical hour of first daily_checkin per day
  const firstCheckinHoursByDay = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'daily_checkin') continue;
    const ts = new Date(e.ts).getTime();
    if (ts < fourteenDaysAgoMs || ts >= todayStartMs) continue;
    const dayKey = new Date(e.ts).toISOString().slice(0, 10);
    const h = new Date(e.ts).getHours();
    const prev = firstCheckinHoursByDay.get(dayKey);
    if (prev == null || h < prev) firstCheckinHoursByDay.set(dayKey, h);
  }
  const checkinHours = Array.from(firstCheckinHoursByDay.values()).sort((a, b) => a - b);
  const medianCheckinHour =
    checkinHours.length >= 3
      ? checkinHours[Math.floor(checkinHours.length / 2)]!
      : null;

  // Today's first check-in (if any)
  const todayCheckins = events.filter(
    (e) => e.type === 'daily_checkin' && isToday(e.ts, todayStartMs),
  );
  const todayHasCheckin = todayCheckins.length > 0;

  // Photo scene counts
  const sceneDayKeys = new Set<string>();
  for (const s of scenes) {
    const ts = new Date(s.observed_at).getTime();
    if (ts < fourteenDaysAgoMs || ts >= todayStartMs) continue;
    sceneDayKeys.add(s.observed_at.slice(0, 10));
  }
  const typicalDailyPhotos = sceneDayKeys.size >= 7; // user is a regular photo-taker
  const todayHasScenes = scenes.some((s) => isToday(s.observed_at, todayStartMs));

  // ── Rule: late check-in (usually by 9am, today nothing by 11am) ──
  if (
    !todayHasCheckin &&
    medianCheckinHour != null &&
    medianCheckinHour <= 9 &&
    currentHour >= 11 &&
    currentHour < 18
  ) {
    out.push({
      id: 'late_checkin',
      text: `you usually get a check-in by ${medianCheckinHour}:00. nothing yet today — you were quiet this morning.`,
    });
  }

  // ── Rule: missed check-in (evening already, none logged) ─────────
  if (
    !todayHasCheckin &&
    currentHour >= 18 &&
    medianCheckinHour != null &&
    firstCheckinHoursByDay.size >= 5 // enough baseline to call this
  ) {
    out.push({
      id: 'missed_checkin',
      text: `the daily check-in didn't happen today. the owner has been busier than usual.`,
    });
  }

  // ── Rule: no photos today (regular photographer) ──────────────────
  if (typicalDailyPhotos && !todayHasScenes && currentHour >= 17) {
    out.push({
      id: 'no_photos_today',
      text: `the phone stayed in the pocket today. no photos. unusual.`,
    });
  }

  // ── Rule: mood shift (today differs from last-3-days modal) ──────
  if (todayHasCheckin) {
    const latestToday = todayCheckins.sort((a, b) =>
      b.ts.localeCompare(a.ts),
    )[0]!;
    const todayMood = (latestToday.payload as { mood?: string }).mood;
    const threeDayCutoff = now - 3 * DAY_MS;
    const recent3 = events
      .filter(
        (e) =>
          e.type === 'daily_checkin' &&
          !isToday(e.ts, todayStartMs) &&
          new Date(e.ts).getTime() >= threeDayCutoff,
      )
      .map((e) => (e.payload as { mood?: string }).mood);
    if (recent3.length >= 2) {
      const happyOrNormalCount = recent3.filter(
        (m) => m === 'happy' || m === 'normal',
      ).length;
      const offCount = recent3.filter((m) => m === 'off').length;
      if (todayMood === 'off' && happyOrNormalCount === recent3.length) {
        out.push({
          id: 'mood_shift',
          text: `the last few days you felt fine. today you feel off — something turned.`,
        });
      } else if (
        (todayMood === 'happy' || todayMood === 'normal') &&
        offCount === recent3.length &&
        recent3.length >= 2
      ) {
        out.push({
          id: 'mood_shift',
          text: `the last few days were off. today you feel steadier. the air shifted.`,
        });
      }
    }
  }

  return out.slice(0, 3);
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
  // We keep two views of the recent stream:
  //   1. allRecentInWindow — every event in the recency window, used
  //      internally (today-vivid, deltas, behavior-tag aggregation).
  //   2. recentEvents — salience-filtered, what the AI prompt sees.
  //      Routine events fade fast; emotionally-salient events persist.
  //      This is the "cat-like memory" rule — events below the
  //      persistence threshold drop out, which keeps the prompt
  //      uncluttered AND makes the cat sound like she remembers what
  //      matters, not like she has a 14-day perfect buffer.
  const allEvents = useHealthStore.getState().events;
  const allRecentInWindow = allEvents
    .filter((e) => e.cat_id === catId)
    .filter((e) => new Date(e.ts).getTime() >= cutoffMs)
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const recentEvents = allRecentInWindow.filter((e) => {
    // Always keep today's events unfiltered (today is vivid; the
    // prompt has a dedicated today-vivid block anyway).
    const ts = new Date(e.ts).getTime();
    if (ts >= new Date(now).setHours(0, 0, 0, 0)) return true;
    return eventPersistence(e, now) >= SALIENCE_KEEP_THRESHOLD;
  });

  // ── 4. Aggregated behaviour-observation tags ───────────────────────────
  // Use the UNFILTERED list — tag aggregation reflects patterns, and
  // pattern detection benefits from raw counts, not salience-filtered
  // ones. (A cat that's relaxed-relaxed-relaxed-relaxed is still
  // "relaxed-prone" even if those individual observations don't pass
  // the chat-prompt salience gate.)
  const behaviorTags: Record<string, number> = {};
  for (const e of allRecentInWindow) {
    if (e.type === 'behavior_observation') {
      const tags = (e.payload as { tags?: string[] }).tags ?? [];
      for (const tag of tags) {
        behaviorTags[tag] = (behaviorTags[tag] ?? 0) + 1;
      }
    }
  }

  // ── 5. Meow signals — populated from `meow_translation` events ─────────
  // Each /translate run writes a meow_translation health event; we surface
  // the last 3 in the recency window here so chat / diary / behaviour
  // readings can keep the cat's running voice consistent (e.g. don't
  // flip-flop between annoyed and comfort_seeking when the last 3 reads
  // were clearly annoyed).
  const recentMeowSignals: CatContext['recentMeowSignals'] = [];
  for (const e of allRecentInWindow) {
    if (e.type !== 'meow_translation') continue;
    const ageDays = daysAgoFrom(e.ts, now);
    const p = e.payload as {
      intent?: string;
      vocalization_type?: string;
      confidence?: 'high' | 'moderate' | 'low';
      translation?: string;
    };
    // Map intent to the existing two-class type the chat prompt
    // already understands ('distress' is the vet-flag cousin;
    // everything else is a generic 'translation' signal).
    const sigType: 'distress' | 'translation' =
      p.intent === 'distress' ? 'distress' : 'translation';
    // Confidence to numeric 0-1 — chat prompt expects floats.
    const confidence =
      p.confidence === 'high'
        ? 0.9
        : p.confidence === 'moderate'
          ? 0.6
          : 0.3;
    const label = p.translation
      ? p.translation
      : `${p.vocalization_type ?? 'meow'} / ${p.intent ?? 'unknown'}`;
    recentMeowSignals.push({
      type: sigType,
      label,
      confidence,
      daysAgo: ageDays,
    });
    if (recentMeowSignals.length >= 3) break;
  }

  // ── Today vivid + deltas ───────────────────────────────────────────
  // Chronological today + deviations from baseline. The cat has sharp
  // recall of TODAY (different time-grain from "the last 14 days").
  // Built from healthStore + the world store's scene captions (vision-
  // grounded "what the camera saw today"). All deterministic — no LLM.
  const allCatScenes = useWorldStore.getState().getRecentScenesForCat(catId, 30);
  const todayStartMs = new Date(now).setHours(0, 0, 0, 0);
  const todayVivid = buildTodayVivid(allRecentInWindow, allCatScenes, todayStartMs);
  const todayDeltas = buildTodayDeltas(
    allRecentInWindow,
    allCatScenes,
    todayStartMs,
    now,
  );

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
    todayVivid,
    todayDeltas,
    bodySelf: deriveBodySelf(
      profile,
      // BCS comes from the most-recent weight event when present; falls
      // through to null when no weight has been logged.
      weightHistory.latest?.bcs ?? null,
    ),
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

  // ── Body self-image — felt-sense, not clinical ─────────────────────
  // Derived from breed + age + weight + BCS. The tone directive tells
  // the model HOW to wear the body in voice — never quote kg / BCS,
  // always speak in felt-sense ("I am a heavy cat", "stairs are now a
  // conversation"). See deriveBodySelf for the rules.
  if (ctx.bodySelf) {
    lines.push('');
    lines.push('## Body self-image (use in voice, do not quote kg/BCS)');
    lines.push(ctx.bodySelf.toneDirective);
  }

  // ── Today (vivid) — sharp recall of today's actual events ──────────
  // The cat has perfect-ish recall for TODAY. Older days fade (handled
  // by the recency × salience filter). This block is the literal
  // sequence of things that happened to her today, time-stamped.
  // CRITICAL: this is the ONLY block where the cat may reference
  // specific times of day ("around 11", "after lunch"). Everywhere
  // else, time references blur to "earlier", "the other day", etc.
  if (ctx.todayVivid.length > 0) {
    lines.push('');
    lines.push('## Today (vivid in your memory)');
    for (const r of ctx.todayVivid) {
      lines.push(`- ${r.hhmm} — ${r.text}`);
    }
    lines.push(
      'The above ARE today. Older days are blurrier. Do NOT misattribute today\'s events to other days.',
    );
  }

  // ── What shifted today — deterministic deviations from baseline ────
  // 1-3 phrases the cat can lift VERBATIM. These are noticed deltas,
  // not invented ones: "you were quiet this morning", "no photos
  // today". The cat NOTICES the human — this is the second-best
  // engagement hook after the meow translator.
  if (ctx.todayDeltas.length > 0) {
    lines.push('');
    lines.push('## What shifted today (you noticed)');
    for (const d of ctx.todayDeltas) {
      lines.push(`- ${d.text}`);
    }
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
