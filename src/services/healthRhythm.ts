/**
 * Health Rhythm — 30-day pattern surface for the Today tab.
 *
 * Pure aggregator layer. Reads from healthStore + scanStore (no Zustand
 * subscription here — callers pass in arrays so this module is testable
 * + selector-friendly). Returns a single immutable snapshot the screen
 * renders against.
 *
 * What this surfaces:
 *   - Mood + appetite timelines (one slot per day, last N days)
 *   - Weight series (last 8 weight measurements within the window)
 *   - Daily activity intensity (events-per-day, capped count)
 *   - Drift cards: trend-detection on mood / appetite / weight + scan
 *     urgency mix + check-in streak
 *
 * No new ML, no AI calls. Just deterministic counting + diff-from-baseline
 * pattern detection. CatContext does adjacent work (it builds the prompt
 * context for AI features); this is its visible-to-user sibling.
 */
import type { HealthEvent, DailyCheckinPayload } from '../state/healthStore';
import type { UrgencyTier } from '../ai/triage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Default window for the screen — 30 days. */
export const DEFAULT_WINDOW_DAYS = 30;

/**
 * Mood slot for the per-day timeline. `null` = no check-in that day,
 * which the chart renders as a faint placeholder bar.
 */
export type MoodSlot = 'happy' | 'normal' | 'off' | null;
export type AppetiteSlot = 'full' | 'half' | 'none' | null;

/** One slot per day in the timeline, oldest-first. */
export type DaySlot = {
  /** YYYY-MM-DD local. Used as the React key + axis label. */
  dateKey: string;
  /** "Tue", "Wed" … local-week label, for sparse axis labels. */
  weekdayShort: string;
  mood: MoodSlot;
  appetite: AppetiteSlot;
  /** Total events that landed on this day (any type). Used for activity bars. */
  activityCount: number;
};

export type WeightPoint = {
  /** YYYY-MM-DD local. */
  dateKey: string;
  weightKg: number;
};

/**
 * Drift signal — surfaced as a card with priority. "concern" = needs
 * attention, "watch" = trending but not urgent yet, "good" = positive
 * news (streaks, recovery). Severity drives card colour + ordering.
 */
export type DriftSignal = {
  /** Stable id used as React key. */
  id: string;
  severity: 'concern' | 'watch' | 'good';
  /** Short headline, e.g. "4 'off' mood days in past 7". */
  headline: string;
  /** One-sentence supporting detail. */
  detail: string;
  /**
   * Categorical kind for analytics + future deep-link routing
   * (e.g. tapping 'weight' could route to /health/weight).
   */
  kind: 'mood' | 'appetite' | 'weight' | 'streak' | 'scans' | 'srr';
};

export type ScanUrgencyMix = Record<UrgencyTier, number>;

export type HealthRhythmSnapshot = {
  /** Resolved local-time window. Useful for the screen header copy. */
  windowDays: number;
  /** YYYY-MM-DD local for the start (oldest) day of the window. */
  startDate: string;
  /** YYYY-MM-DD local for today (right edge of the window). */
  endDate: string;

  /** Per-day timeline. Length = windowDays. Oldest-first. */
  days: DaySlot[];

  /** Distinct days with at least one daily_checkin event in window. */
  daysLogged: number;

  /** Current consecutive check-in streak (counted backwards from today). */
  currentStreakDays: number;

  /** Mood counts in the window. */
  moodCounts: { happy: number; normal: number; off: number };
  /** Appetite counts in the window. */
  appetiteCounts: { full: number; half: number; none: number };

  /** Weight series (oldest-first), capped at MAX_WEIGHT_POINTS. */
  weightSeries: WeightPoint[];
  /** Most-recent weight in window, kg. Null if no measurement. */
  latestWeightKg: number | null;
  /** First weight measurement in window. Null if absent. Used for delta. */
  firstWeightKg: number | null;

  /** Scan-urgency mix in window. */
  scanUrgencyMix: ScanUrgencyMix;
  /** Total scans in window. */
  scanCount: number;

  /**
   * Behaviour-observation tag frequencies in the window (e.g.
   * "alert": 3, "relaxed": 2). Sorted, top tags first.
   */
  topBehaviorTags: Array<{ tag: string; count: number }>;

  /** Drift cards. Sorted concern > watch > good. */
  drift: DriftSignal[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** YYYY-MM-DD local. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Step a Date back by one calendar day, mutating in-place. */
function stepBackOneDay(d: Date): void {
  d.setDate(d.getDate() - 1);
}

const MAX_WEIGHT_POINTS = 8;

// ---------------------------------------------------------------------------
// Build snapshot
// ---------------------------------------------------------------------------

/**
 * Build the 30-day rhythm snapshot for a cat. Pure: callers pass in
 * already-filtered events + scans (whatever the caller's filtering
 * conventions are). The snapshot is allocation-light (a few thousand
 * counters) — safe to recompute on every render of the screen.
 */
export function buildHealthRhythmSnapshot(opts: {
  catId: string;
  events: HealthEvent[];
  scans: Array<{
    cat_id: string;
    created_at: string;
    urgency: UrgencyTier;
  }>;
  windowDays?: number;
  /** Override "now" — useful for fixtures + future deterministic UI. */
  now?: Date;
}): HealthRhythmSnapshot {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const now = opts.now ?? new Date();
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  // Build day-slot template, oldest-first.
  const days: DaySlot[] = [];
  {
    const cursor = new Date(todayMidnight);
    cursor.setDate(cursor.getDate() - (windowDays - 1));
    for (let i = 0; i < windowDays; i++) {
      days.push({
        dateKey: localDateKey(cursor),
        weekdayShort: WEEKDAY_SHORT[cursor.getDay()] ?? '',
        mood: null,
        appetite: null,
        activityCount: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const dayIndexByKey = new Map<string, number>();
  days.forEach((d, i) => dayIndexByKey.set(d.dateKey, i));

  const startDate = days[0]?.dateKey ?? localDateKey(todayMidnight);
  const endDate = days[days.length - 1]?.dateKey ?? localDateKey(todayMidnight);
  const startMs = new Date(startDate + 'T00:00:00').getTime();

  // ── Filter events to this cat + window ─────────────────────────────────
  const catEvents = opts.events.filter(
    (e) => e.cat_id === opts.catId && new Date(e.ts).getTime() >= startMs,
  );

  // ── Mood + appetite slots: most-recent check-in per day wins ──────────
  // Sort newest-first so we can mark each day from its latest entry only.
  const checkinsNewestFirst = catEvents
    .filter((e) => e.type === 'daily_checkin')
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const moodCounts = { happy: 0, normal: 0, off: 0 };
  const appetiteCounts = { full: 0, half: 0, none: 0 };
  const seenDays = new Set<string>();
  for (const e of checkinsNewestFirst) {
    const dateKey = localDateKey(new Date(e.ts));
    const idx = dayIndexByKey.get(dateKey);
    if (idx == null) continue;
    const p = e.payload as DailyCheckinPayload;
    if (!seenDays.has(dateKey)) {
      // This is the most-recent entry for this day → it sets the slot.
      const slot = days[idx]!;
      slot.mood = (p.mood ?? null) as MoodSlot;
      slot.appetite = (p.appetite ?? null) as AppetiteSlot;
      seenDays.add(dateKey);
    }
    // Counts are PER-CHECKIN, not per-day, so multiple check-ins on the
    // same day all contribute. The chart still uses the most-recent slot.
    if (p.mood && p.mood in moodCounts) {
      moodCounts[p.mood]++;
    }
    if (p.appetite && p.appetite in appetiteCounts) {
      appetiteCounts[p.appetite]++;
    }
  }
  const daysLogged = seenDays.size;

  // ── Activity intensity: count any event per day ───────────────────────
  for (const e of catEvents) {
    const dateKey = localDateKey(new Date(e.ts));
    const idx = dayIndexByKey.get(dateKey);
    if (idx != null) {
      days[idx]!.activityCount++;
    }
  }

  // ── Streak (consecutive days with at least one check-in, going back) ──
  let currentStreakDays = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (seenDays.has(days[i]!.dateKey)) {
      currentStreakDays++;
    } else {
      break;
    }
  }

  // ── Weight series ──────────────────────────────────────────────────────
  const weightEvents = catEvents
    .filter((e) => e.type === 'weight')
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()); // oldest-first
  const weightSeries: WeightPoint[] = weightEvents.map((e) => {
    const p = e.payload as { weight_kg?: number };
    return {
      dateKey: localDateKey(new Date(e.ts)),
      weightKg: typeof p.weight_kg === 'number' ? p.weight_kg : 0,
    };
  });
  // Cap the series for the chart (we don't need 30 points for a sparkline).
  const trimmedWeightSeries = weightSeries.slice(-MAX_WEIGHT_POINTS);
  const firstWeightKg = weightSeries[0]?.weightKg ?? null;
  const latestWeightKg =
    weightSeries[weightSeries.length - 1]?.weightKg ?? null;

  // ── Behaviour-observation tags ─────────────────────────────────────────
  const tagCounts: Record<string, number> = {};
  for (const e of catEvents) {
    if (e.type === 'behavior_observation') {
      const tags = (e.payload as { tags?: string[] }).tags ?? [];
      for (const t of tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }
  const topBehaviorTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Scan urgency mix ───────────────────────────────────────────────────
  const scanUrgencyMix: ScanUrgencyMix = {
    routine: 0,
    monitor: 0,
    concern: 0,
    urgent: 0,
  };
  let scanCount = 0;
  for (const s of opts.scans) {
    if (s.cat_id !== opts.catId) continue;
    if (new Date(s.created_at).getTime() < startMs) continue;
    scanUrgencyMix[s.urgency]++;
    scanCount++;
  }

  // ── Drift detection ────────────────────────────────────────────────────
  const drift = detectDrift({
    moodCounts,
    appetiteCounts,
    daysLogged,
    windowDays,
    weightSeries,
    currentStreakDays,
    scanUrgencyMix,
    scanCount,
    catEvents,
  });

  return {
    windowDays,
    startDate,
    endDate,
    days,
    daysLogged,
    currentStreakDays,
    moodCounts,
    appetiteCounts,
    weightSeries: trimmedWeightSeries,
    latestWeightKg,
    firstWeightKg,
    scanUrgencyMix,
    scanCount,
    topBehaviorTags,
    drift,
  };
}

// ---------------------------------------------------------------------------
// Drift detection — deterministic rule set
// ---------------------------------------------------------------------------
//
// The rules below are intentionally simple + readable. Each rule
// produces 0 or 1 DriftSignal. Future v2 can replace this with a
// learned model trained on labelled drift events; for now, transparent
// rules beat "the AI told me so" both for trust + debuggability.
// Severity ordering: concern > watch > good. The screen sorts by this.

function detectDrift(opts: {
  moodCounts: { happy: number; normal: number; off: number };
  appetiteCounts: { full: number; half: number; none: number };
  daysLogged: number;
  windowDays: number;
  weightSeries: WeightPoint[];
  currentStreakDays: number;
  scanUrgencyMix: ScanUrgencyMix;
  scanCount: number;
  catEvents: HealthEvent[];
}): DriftSignal[] {
  const out: DriftSignal[] = [];

  // ── Mood: 3+ "off" days within the LAST 7 calendar days ────────────────
  // Recent-7 window is strictly more useful for surfacing drift than the
  // full 30-day count — a cat that had a bad week 3 weeks ago is fine now.
  const sevenDaysAgoMs = Date.now() - 7 * DAY_MS;
  let recentOffMood = 0;
  let recentNoneAppetite = 0;
  let recentHalfAppetite = 0;
  for (const e of opts.catEvents) {
    if (e.type !== 'daily_checkin') continue;
    if (new Date(e.ts).getTime() < sevenDaysAgoMs) continue;
    const p = e.payload as { mood?: string; appetite?: string };
    if (p.mood === 'off') recentOffMood++;
    if (p.appetite === 'none') recentNoneAppetite++;
    if (p.appetite === 'half') recentHalfAppetite++;
  }
  if (recentOffMood >= 3) {
    out.push({
      id: 'mood-off-7d',
      severity: 'concern',
      headline: `${recentOffMood} 'off' mood days in past 7`,
      detail: `When mood is off three or more times in a week, it's worth a closer look — try a Body Language read or an outcome check.`,
      kind: 'mood',
    });
  }

  // ── Appetite: any "none" in past 7 OR 3+ "half" ───────────────────────
  if (recentNoneAppetite >= 1) {
    out.push({
      id: 'appetite-none-7d',
      severity: 'concern',
      headline: `${recentNoneAppetite} skipped meal${recentNoneAppetite === 1 ? '' : 's'} in past 7 days`,
      detail: `Anorexia in cats can cascade into hepatic lipidosis within 48–72 hours. If skipping continues, run a scan.`,
      kind: 'appetite',
    });
  } else if (recentHalfAppetite >= 3) {
    out.push({
      id: 'appetite-half-7d',
      severity: 'watch',
      headline: `Appetite half on ${recentHalfAppetite} of past 7 days`,
      detail: `Reduced appetite over multiple days is worth monitoring. Re-check tomorrow.`,
      kind: 'appetite',
    });
  }

  // ── Weight: 5%+ change between first + last in window ────────────────
  if (opts.weightSeries.length >= 2) {
    const first = opts.weightSeries[0]!.weightKg;
    const last = opts.weightSeries[opts.weightSeries.length - 1]!.weightKg;
    if (first > 0) {
      const pct = ((last - first) / first) * 100;
      const absPct = Math.abs(pct);
      if (absPct >= 5) {
        const direction = pct < 0 ? 'down' : 'up';
        const severity: DriftSignal['severity'] =
          absPct >= 10 ? 'concern' : 'watch';
        out.push({
          id: 'weight-drift',
          severity,
          headline: `Weight ${direction} ${absPct.toFixed(1)}% in window`,
          detail:
            direction === 'down'
              ? `Unintentional weight loss in cats often reflects hyperthyroidism, CKD, or dental pain. Worth a vet conversation.`
              : `Steady weight gain may reflect age + activity changes; keep an eye on body condition score.`,
          kind: 'weight',
        });
      }
    }
  }

  // ── Streak: positive feedback at meaningful milestones ────────────────
  if (opts.currentStreakDays >= 30) {
    out.push({
      id: 'streak-good',
      severity: 'good',
      headline: `${opts.currentStreakDays}-day check-in streak`,
      detail: `Daily check-ins make every other signal sharper — this is the highest-leverage habit in the app.`,
      kind: 'streak',
    });
  } else if (opts.currentStreakDays >= 7) {
    out.push({
      id: 'streak-week',
      severity: 'good',
      headline: `${opts.currentStreakDays}-day streak — keep going`,
      detail: `One more week and you're at the 14-day mark.`,
      kind: 'streak',
    });
  }

  // ── Scan mix: any urgent or concern in window ─────────────────────────
  if (opts.scanUrgencyMix.urgent > 0) {
    out.push({
      id: 'scans-urgent',
      severity: 'concern',
      headline: `${opts.scanUrgencyMix.urgent} urgent scan${opts.scanUrgencyMix.urgent === 1 ? '' : 's'} this window`,
      detail: `Urgent triages mean the model recommended same-day vet attention. Did you visit?`,
      kind: 'scans',
    });
  } else if (opts.scanUrgencyMix.concern >= 2) {
    out.push({
      id: 'scans-concern',
      severity: 'watch',
      headline: `${opts.scanUrgencyMix.concern} concern-level scans this window`,
      detail: `Multiple concern-level triages worth surfacing as a pattern. Review in the symptom timeline.`,
      kind: 'scans',
    });
  }

  // ── Logging coverage: encourage check-ins when sparse ─────────────────
  // Don't fire when the user has logged most days — focus on actionable.
  const coverage = opts.daysLogged / Math.max(1, opts.windowDays);
  if (opts.windowDays >= 14 && coverage < 0.4 && opts.daysLogged < 10) {
    out.push({
      id: 'coverage-sparse',
      severity: 'watch',
      headline: `Only ${opts.daysLogged}/${opts.windowDays} days logged`,
      detail: `Daily check-ins make the rhythm view honest. Open the Today tab and tap the check-in card.`,
      kind: 'streak',
    });
  }

  // Sort: concern → watch → good, preserve insertion order within tier.
  const severityOrder: Record<DriftSignal['severity'], number> = {
    concern: 0,
    watch: 1,
    good: 2,
  };
  out.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return out;
}
