/**
 * Mood-weight modifiers — archetype baseline + user-feedback adaptation.
 *
 * Plugs into `pickDailyMood` / `resolveTodaysMood` in `dailyMood.ts` via
 * two `MoodWeightModifier` functions:
 *
 *   1. archetype modifier — static per-(archetype × mood) multiplier
 *      that gives each cat their personality-typical mood distribution.
 *      A Velcro-Cat boosts warm moods + suppresses megalomania; a
 *      Cool-Observer does the opposite.
 *
 *   2. user-feedback modifier — adaptive per-(cat × mood) multiplier
 *      learned from share-and-chat behaviour. If a user shares the
 *      daily card 4× more on COZY days than the baseline, COZY gets a
 *      heavier weight for that cat going forward.
 *
 * Final lottery weight in `pickDailyMood`:
 *   effective = base × archMod × feedbackMod^1.5
 *
 * Exponent 1.5 on the feedback term makes user preference DOMINANT over
 * archetype while keeping archetype as the cold-start baseline (cats
 * with no feedback history still get a personality-shaped distribution).
 *
 * Weight intuition:
 *   - archetype multiplier ranges roughly [0.3, 1.8] → ~6× spread
 *   - feedback multiplier (raw) ranges [0.3, 3.0] → 10× spread; with
 *     the ^1.5 exponent that becomes ~32× spread → user feedback wins.
 *
 * See `dailyMood.ts` for the picker that consumes these.
 */
import {
  DAILY_MOODS,
  type DailyMoodDef,
  type DailyMoodId,
  type MoodWeightModifier,
} from './dailyMood';
import type { PersonalityArchetype } from './personality';

// ---------------------------------------------------------------------------
// Archetype × Mood static modifier table
// ---------------------------------------------------------------------------
//
// Multiplier vs the neutral 1.0. Omitted moods default to 1.0. Each row
// captures the personality of that archetype:
//   - Affectionate-Lap / Velcro-Cat boost warm moods + suppress
//     dominance moods (megalomania, imperious).
//   - Hunter-Athlete / Goofball-Playful boost joy/play moods + suppress
//     cozy/contemplative moods.
//   - Cool-Observer / Curious-Introvert boost philosophical + suppress
//     warm gushing.
//   - Anxious/Skittish boost attuned + suppress high-energy moods.
//
// Bounds: keep multipliers in [0.3, 1.8] to leave headroom for the
// user-feedback layer which dominates final weight. Don't zero things
// out — every mood should remain possible, just rarer.

type ArchetypeModRow = Partial<Record<DailyMoodId, number>>;

const ARCHETYPE_MOOD_MODIFIERS: Record<PersonalityArchetype, ArchetypeModRow> = {
  // ──────────────────────────────────────────────────────────────────────
  // confident_sociable — flexible, all-round, mild positive across warm
  // and joy. No strong suppressions.
  confident_sociable: {
    affectionate: 1.3,
    chosen: 1.3,
    playful: 1.3,
    roasting: 1.2,
    attuned: 1.1,
  },

  // ──────────────────────────────────────────────────────────────────────
  // curious_introvert — Russian Blue energy. Quiet, observant, deeply
  // bonded but reserved. Boost wonder/contemplative; suppress theatrics.
  curious_introvert: {
    curious: 1.6,
    philosophical: 1.4,
    attuned: 1.4,
    cozy: 1.3,
    chosen: 1.2,
    theatrical: 0.5,
    megalomania: 0.4,
    playful: 0.7,
    roasting: 0.6,
  },

  // ──────────────────────────────────────────────────────────────────────
  // anxious_sensitive — easily overwhelmed, deeply rewarding once trust
  // builds. Boost sensitivity + cozy retreat; suppress high-arousal.
  anxious_sensitive: {
    attuned: 1.5,
    cozy: 1.3,
    indignant: 1.3, // dark-pool only, but shows up on "off" days
    affectionate: 1.1,
    megalomania: 0.3,
    playful: 0.5,
    theatrical: 0.5,
    roasting: 0.5,
    imperious: 0.6,
  },

  // ──────────────────────────────────────────────────────────────────────
  // hunter_athlete — Bengals, Abyssinians. Prey-drive runs the show.
  // Boost joy/play/investigate; suppress loafing.
  hunter_athlete: {
    playful: 1.7,
    mischievous: 1.5,
    curious: 1.3,
    theatrical: 1.1,
    cozy: 0.4,
    attuned: 0.6,
    philosophical: 0.6,
  },

  // ──────────────────────────────────────────────────────────────────────
  // affectionate_lap — classic Ragdoll / Birman. The purrer.
  // Heavy boost on warm moods; suppress sass and god-emperor.
  affectionate_lap: {
    affectionate: 1.8,
    cozy: 1.5,
    chosen: 1.4,
    attuned: 1.2,
    sarcastic: 0.4,
    megalomania: 0.4,
    roasting: 0.5,
    mischievous: 0.7,
  },

  // ──────────────────────────────────────────────────────────────────────
  // velcro_cat — Sphynx, Oriental, extreme attachment. The follower.
  // Boost chosen + closeness; suppress imperious distance.
  velcro_cat: {
    affectionate: 1.7,
    chosen: 1.6,
    cozy: 1.5,
    attuned: 1.3,
    megalomania: 0.3,
    imperious: 0.4,
    sarcastic: 0.5,
    philosophical: 0.6,
  },

  // ──────────────────────────────────────────────────────────────────────
  // skittish_sensitive — slow trust, deep bond once formed. Similar to
  // anxious_sensitive but a touch more dignified.
  skittish_sensitive: {
    attuned: 1.5,
    cozy: 1.3,
    indignant: 1.3,
    affectionate: 1.1,
    megalomania: 0.3,
    playful: 0.5,
    theatrical: 0.5,
    roasting: 0.5,
  },

  // ──────────────────────────────────────────────────────────────────────
  // cool_observer — British Shorthair. "Likes you very much; doesn't
  // want to be picked up." Boost contemplative + restrained; suppress
  // warm gushing.
  cool_observer: {
    philosophical: 1.6,
    imperious: 1.3,
    sarcastic: 1.2,
    attuned: 1.1,
    affectionate: 0.5,
    chosen: 0.6,
    playful: 0.6,
    theatrical: 0.7,
    cozy: 1.1, // they DO loaf
  },

  // ──────────────────────────────────────────────────────────────────────
  // goofball_playful — the class clown. High joy, low gravitas.
  goofball_playful: {
    playful: 1.9,
    mischievous: 1.6,
    theatrical: 1.4,
    curious: 1.3,
    affectionate: 1.1,
    philosophical: 0.3,
    imperious: 0.4,
    attuned: 0.6,
  },
};

/**
 * Build a `MoodWeightModifier` keyed to the given archetype. The
 * returned function returns the modifier (default 1.0) for each mood.
 *
 * Pass this to `pickDailyMood` / `resolveTodaysMood` so the lottery
 * weights become archetype-shaped.
 */
export function buildArchetypeMod(
  archetype: PersonalityArchetype | null | undefined,
): MoodWeightModifier {
  if (!archetype) return () => 1.0;
  const row = ARCHETYPE_MOOD_MODIFIERS[archetype] ?? {};
  return (mood: DailyMoodDef) => row[mood.id] ?? 1.0;
}

// ---------------------------------------------------------------------------
// User-feedback modifier
// ---------------------------------------------------------------------------
//
// Adaptive layer: per (catId × moodId) we track
//   - exposureCount    : days this mood was active
//   - shareCount       : times user shared a daily card / postcard while
//                        this mood was active
//   - chatSessionCount : chat sessions during this mood (lighter signal)
//
// Modifier formula:
//   personal_rate(M) = (shareCount_M + 0.5 × chatSessionCount_M) / exposureCount_M
//   baseline_rate    = mean(personal_rate over moods with exposureCount ≥ COLD_START_GATE)
//   userMod(M)       = clamp(personal_rate(M) / baseline_rate, 0.3, 3.0)
//
// Cold-start: until a mood has at least COLD_START_GATE exposures, its
// userMod is 1.0 (no learned signal yet). Without this gate one share
// on day 1 would pin the lottery toward that mood forever.

const COLD_START_GATE = 5;
const MIN_MOD = 0.3;
const MAX_MOD = 3.0;

/**
 * Cat-mood feedback snapshot. Persisted by `moodFeedbackStore`.
 */
export type CatMoodFeedback = {
  exposureCount: number;
  shareCount: number;
  chatSessionCount: number;
};

/** Per-cat map of mood → feedback counters. */
export type CatFeedbackTable = Partial<Record<DailyMoodId, CatMoodFeedback>>;

/**
 * Compute the per-mood modifier from a feedback table. Returns 1.0 for
 * any mood below the cold-start gate.
 *
 * Pure function — testable, no I/O. Pass the cat's feedback table from
 * the store; this function does the math.
 */
export function computeFeedbackMod(
  table: CatFeedbackTable | undefined,
): MoodWeightModifier {
  if (!table) return () => 1.0;

  // Build personal rates only for moods past the gate.
  const rates: Partial<Record<DailyMoodId, number>> = {};
  for (const moodId of Object.keys(DAILY_MOODS) as DailyMoodId[]) {
    const fb = table[moodId];
    if (!fb || fb.exposureCount < COLD_START_GATE) continue;
    const signal = fb.shareCount + 0.5 * fb.chatSessionCount;
    rates[moodId] = signal / fb.exposureCount;
  }

  const knownRates = Object.values(rates).filter((r): r is number => r != null);
  if (knownRates.length < 2) {
    // Not enough cross-mood data to compute a baseline. Stay neutral.
    return () => 1.0;
  }
  const baseline =
    knownRates.reduce((s, r) => s + r, 0) / knownRates.length;

  // Degenerate guard: if every personal rate is 0 (user never shares,
  // never chats), baseline is 0 → can't divide. Stay neutral.
  if (baseline <= 0) return () => 1.0;

  return (mood: DailyMoodDef) => {
    const r = rates[mood.id];
    if (r == null) return 1.0;
    const ratio = r / baseline;
    return Math.max(MIN_MOD, Math.min(MAX_MOD, ratio));
  };
}

/** Re-export for callers who want to introspect the table. */
export { COLD_START_GATE };

// ---------------------------------------------------------------------------
// Body-trend signal helper (water + weight)
// ---------------------------------------------------------------------------
//
// Shared by `buildLiveMoodContext` AND by the three generation paths
// (diary, chat, postcard) that build a `TodayContext` manually. Pre-
// 2026-05-14 round 15 these signals only flowed via
// `buildLiveMoodContext` — i.e. share attribution + notifications —
// but the actual cat-voice surfaces (diary/chat/postcard) bypassed it.
// Now every path that produces voice can pass `events + catId +
// targetDateKey` and get the two direction labels back.
//
// Pure function. No I/O. `targetDateKey` is the date being generated
// for; diary backfill passes `deep.date` (NOT today) so a May 5
// backfill uses May 5's own water baseline + weight window. Chat /
// postcard pass today.

type HealthEventLike = {
  cat_id: string;
  type: string;
  ts: string;
  payload: unknown;
};

/**
 * Compute waterDirection + weightTrendDirection for a target date from
 * the health-events stream. Pure function.
 *
 * Water:
 *   - Sum today's `water_intake` events on the target date.
 *   - Median baseline of the 7 days BEFORE the target date (≥3 days
 *     required, otherwise null).
 *   - `'low'` = <60% baseline; `'high'` = >140%; `'normal'` between.
 *
 * Weight:
 *   - 30-day window ending end-of-target-day.
 *   - Direction from first vs last `weight` event in the window.
 *   - ±100g stable band. <2 events in window → null.
 */
export function computeBodyTrendSignals(
  events: ReadonlyArray<HealthEventLike>,
  catId: string,
  targetDateKey: string,
): {
  waterDirection: TodayContext['waterDirection'];
  weightTrendDirection: TodayContext['weightTrendDirection'];
} {
  const out: {
    waterDirection: TodayContext['waterDirection'];
    weightTrendDirection: TodayContext['weightTrendDirection'];
  } = { waterDirection: null, weightTrendDirection: null };

  let targetMs: number;
  try {
    targetMs = new Date(`${targetDateKey}T00:00:00`).getTime();
  } catch {
    return out;
  }
  if (Number.isNaN(targetMs)) return out;

  const dayMs = 24 * 60 * 60 * 1000;
  const waterStartMs = targetMs - 7 * dayMs;

  // ── Water ──
  let targetWaterMl = 0;
  let targetWaterEventCount = 0;
  const priorBuckets = new Map<string, number>();
  for (const e of events) {
    if (e.cat_id !== catId) continue;
    if (e.type !== 'water_intake') continue;
    let ed: Date;
    try {
      ed = new Date(e.ts);
      if (Number.isNaN(ed.getTime())) continue;
    } catch {
      continue;
    }
    const k = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;
    const ml = (e.payload as { ml?: number })?.ml;
    const mlNum = typeof ml === 'number' ? ml : 0;
    if (k === targetDateKey) {
      targetWaterMl += mlNum;
      targetWaterEventCount += 1;
    } else if (ed.getTime() >= waterStartMs && ed.getTime() < targetMs) {
      priorBuckets.set(k, (priorBuckets.get(k) ?? 0) + mlNum);
    }
  }
  // Only call low/high/normal when the user actually logged ≥1 water
  // event for the target day. Zero events ≠ "drank nothing" — it
  // usually means "user hasn't logged yet." Pre-fix this collapsed to
  // `low` whenever a 7-day baseline existed but today had no logs,
  // which overstated a factual body signal in both diary prose and
  // the mood lottery (audit 2026-05-14 round 16 P2 factual-risk).
  if (targetWaterEventCount > 0 && priorBuckets.size >= 3) {
    const sorted = [...priorBuckets.values()].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const baseline =
      sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
    if (baseline > 0) {
      if (targetWaterMl < baseline * 0.6) out.waterDirection = 'low';
      else if (targetWaterMl > baseline * 1.4) out.waterDirection = 'high';
      else out.waterDirection = 'normal';
    }
  }

  // ── Weight ──
  const weightEndMs = targetMs + dayMs; // include events through end of target day
  const weightStartMs = weightEndMs - 30 * dayMs;
  const weightEvents = events
    .filter((e) => e.cat_id === catId && e.type === 'weight')
    .filter((e) => {
      try {
        const t = new Date(e.ts).getTime();
        if (Number.isNaN(t)) return false;
        return t >= weightStartMs && t < weightEndMs;
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.ts.localeCompare(b.ts));
  if (weightEvents.length >= 2) {
    const fromKg = (weightEvents[0]?.payload as { weight_kg?: number })?.weight_kg;
    const toKg = (weightEvents[weightEvents.length - 1]?.payload as { weight_kg?: number })?.weight_kg;
    if (typeof fromKg === 'number' && typeof toKg === 'number') {
      const delta = toKg - fromKg;
      const absDelta = Math.abs(delta);
      out.weightTrendDirection = absDelta < 0.1 ? 'stable' : delta > 0 ? 'up' : 'down';
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Live mood context builder
// ---------------------------------------------------------------------------
//
// Audit 2026-05-14: callers (chat, diary, postcard, daily-card share,
// notification settings, Today tab morning-mew autoinit) were each
// recomputing today's behavior tags + check-in independently. With the
// expanded TodayContext (weather, meow intents, pain, appetite, litter)
// that duplication would multiply. This single builder gathers ALL
// live mood signals for a cat from the stores.
//
// Async because it touches the weather snapshot (which may hit the
// network on cold-cache). Callers that don't want to wait can use the
// sync path by passing a pre-built TodayContext directly to
// buildTodayBehaviorMod — the weather signal just won't be wired.

/**
 * Build the full live mood context for a cat from the current store
 * state. Always returns a populated context — missing data just
 * leaves the corresponding field absent (no mood pull for that
 * signal). Failures swallowed — mood resolution must never block
 * generation.
 */
export async function buildLiveMoodContext(opts: {
  catId: string;
  ageMonths: number | null;
}): Promise<TodayContext> {
  const { catId, ageMonths } = opts;
  const ctx: TodayContext = {
    ageMonths,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useHealthStore } = require('../state/healthStore') as {
      useHealthStore: {
        getState: () => {
          events: Array<{
            cat_id: string;
            type: string;
            ts: string;
            payload: unknown;
          }>;
        };
      };
    };
    const events = useHealthStore.getState().events;
    const d = new Date();
    const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isToday = (iso: string): boolean => {
      try {
        const ed = new Date(iso);
        const k = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;
        return k === todayKey;
      } catch {
        return false;
      }
    };
    const todays = events.filter((e) => e.cat_id === catId && isToday(e.ts));

    // Behavior tags
    const tags: string[] = [];
    for (const e of todays) {
      if (e.type !== 'behavior_observation') continue;
      const p = e.payload as { tags?: string[] };
      if (Array.isArray(p?.tags)) tags.push(...p.tags);
    }
    if (tags.length > 0) ctx.todayTags = tags;

    // Check-in mood / appetite / litter
    for (const e of todays) {
      if (e.type !== 'daily_checkin') continue;
      const p = e.payload as { mood?: string; appetite?: string; litter?: string };
      if (p?.mood === 'happy' || p?.mood === 'normal' || p?.mood === 'off') {
        ctx.checkinMood = p.mood;
      }
      if (p?.appetite === 'partial' || p?.appetite === 'none') {
        ctx.hasAppetiteOff = true;
      }
      if (p?.litter === 'abnormal') {
        ctx.hasLitterAbnormal = true;
      }
      break; // most recent only — checkin should have one per day
    }

    // Meow intents — today's translations
    const meowIntents: string[] = [];
    for (const e of todays) {
      if (e.type !== 'meow_translation') continue;
      const p = e.payload as { intent?: string };
      if (typeof p?.intent === 'string') meowIntents.push(p.intent);
    }
    if (meowIntents.length > 0) ctx.meowIntents = meowIntents;

    // Pain — today's pain_score event with composite >= 4
    let painToday = false;
    for (const e of todays) {
      if (e.type !== 'pain_score') continue;
      const p = e.payload as { composite?: number };
      if (typeof p?.composite === 'number' && p.composite >= 4) {
        painToday = true;
        break;
      }
    }
    if (painToday) ctx.hasPainToday = true;

    // Water + weight body-trend signals (audit 2026-05-14 round 15).
    // Shared helper — see `computeBodyTrendSignals` above. Diary,
    // chat, and postcard call the same helper directly so all four
    // paths produce the same direction labels for the same data.
    const trends = computeBodyTrendSignals(events, catId, todayKey);
    if (trends.waterDirection != null) ctx.waterDirection = trends.waterDirection;
    if (trends.weightTrendDirection != null) ctx.weightTrendDirection = trends.weightTrendDirection;
  } catch {
    // health store unavailable — fall through with whatever we have
  }

  // Weather (async). Cached for 6 hours so most calls are free.
  try {
    const { getWeatherSnapshot } = await import('./weatherContext');
    const snap = await getWeatherSnapshot();
    if (snap) {
      if (typeof snap.weather_code === 'number') ctx.weatherCode = snap.weather_code;
      if (typeof snap.apparent_c === 'number') ctx.apparentTempC = snap.apparent_c;
    }
  } catch {
    // weather unavailable — skip the signal
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Same-day medical concern helper
// ---------------------------------------------------------------------------
//
// Shared across every place that calls `resolveTodaysMood` so they all
// route to the dark mood pool consistently when a serious scan landed
// today. Pre-2026-05-14 the chat/diary paths had this but share-
// attribution callsites passed `hasRecentMedicalConcern: false`,
// polluting the long-term mood-learning loop (the picker would resolve
// a light mood for share counting on a medically serious day, then
// record exposure under that mood).
//
// Reads `scanStore` directly via lazy-loaded `getState()` so callers
// don't need to subscribe + pass props through. Synchronous helper —
// returns a boolean, no I/O.

/**
 * Compute whether today has a triage scan flagged as `urgent` or
 * `concern` for this cat. Pass the boolean as `hasRecentMedicalConcern`
 * when calling `resolveTodaysMood` so share/exposure counters route
 * to the dark pool the same way generation paths already do.
 *
 * Failures return `false` (the safer default — don't accidentally
 * force dark mood on a store-read glitch).
 */
export function hasMedicalConcernToday(catId: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useScanStore } = require('../state/scanStore') as {
      useScanStore: { getState: () => { scans: Array<{ cat_id: string; created_at: string; urgency: string }> } };
    };
    const d = new Date();
    const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const scans = useScanStore.getState().scans;
    return scans.some(
      (s) => {
        if (s.cat_id !== catId) return false;
        if (s.urgency !== 'urgent' && s.urgency !== 'concern') return false;
        try {
          const sd = new Date(s.created_at);
          const sk = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
          return sk === todayKey;
        } catch {
          return false;
        }
      },
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Today-behavior modifier — the within-day responsive layer
// ---------------------------------------------------------------------------
//
// Added 2026-05-13 alongside the user-feedback layer. While archMod
// captures the cat's stable personality and feedbackMod captures the
// user's revealed preferences over weeks, todayMod responds to TODAY's
// actual signals:
//
//   - Behavior observation tags from today's Read Cat session(s)
//   - Today's daily check-in mood
//   - Cat age (life-stage bias — kittens lean playful, seniors lean
//     cozy/philosophical)
//
// Range is kept narrow (~[0.5, 1.7]) so it's a SOFT pull, not dominant.
// Archetype gives the cat its personality; today's mod bends it for
// today specifically. Feedback (^1.5 exponent) still wins long-term.
//
// IMPORTANT: this layer makes the picker non-deterministic within a
// day. If a 9am Read Cat flags "playful" and a 3pm Read Cat flags
// "withdrawn", the morning chat leans `playful` and the afternoon
// chat leans toward attuned/cozy. By design — cats DO change through
// the day, and reflecting that in the voice is more honest than
// freezing one mood at midnight. The mood-warning banner ("even Lily
// won't tell you which one") now LITERALLY describes the behaviour.

/**
 * Today's signal payload — the LIVE MOOD CONTEXT. All fields are
 * optional; supply what you have. Pure data, no I/O.
 *
 * Architecture (2026-05-14 expansion per audit): mood = stable daily
 * base × archetype × **live overlay** × user feedback. This struct is
 * the live overlay's input. The cat woke up imperious; after a
 * thunderstorm + a distress meow + an "off" check-in, the live
 * overlay pulls today toward attuned. The daily base seeded by the
 * lottery still holds the cat's personality; this layer reflects
 * what's HAPPENING right now.
 */
export type TodayContext = {
  /**
   * Behavior observation tags from today's Read Cat session(s). Pulled
   * from `behavior_observation` events on today's date. Tags are
   * normalised lowercase ("playful", "fearful", "sleepy", ...).
   */
  todayTags?: string[];
  /** Today's daily check-in mood. */
  checkinMood?: 'happy' | 'normal' | 'off' | null;
  /**
   * Cat age in months. Drives life-stage mood bias:
   *   - < 18 mo (kitten / young) → boosts playful/mischievous/curious,
   *     suppresses cozy/philosophical
   *   - > 132 mo (~11+ yr, senior) → boosts cozy/philosophical/attuned,
   *     suppresses playful/mischievous
   *   - middle adult years (18–132 mo) → no age pull
   */
  ageMonths?: number | null;
  /**
   * Open-Meteo WMO weather code for today, when location permission
   * granted and snapshot fetched. Affects mood:
   *   - 0–3 clear / partly cloudy → no pull
   *   - 45–48 fog → philosophical / attuned
   *   - 51–67 rain → cozy / attuned
   *   - 71–77, 85–86 snow → curious / cozy
   *   - 80–82 showers → cozy / grumpy (depends on temp)
   *   - 95–99 thunderstorm → attuned / indignant (cats hate storms)
   * Null/undefined when no weather data — no pull.
   */
  weatherCode?: number | null;
  /**
   * Apparent temperature (C). Hot days >30°C nudge grumpy / theatrical;
   * cold <5°C nudges cozy. Null when no weather data.
   */
  apparentTempC?: number | null;
  /**
   * Today's meow translator intents. Each entry is a Meow Translator
   * `intent` enum value ('distress', 'comfort_seeking', 'playful',
   * etc.). The cat's OWN voice shifts the mood — a distress meow
   * pulls toward attuned/indignant; affection-seeking meows pull
   * toward chosen/affectionate. Empty array = no pull.
   */
  meowIntents?: string[];
  /**
   * Today had a pain_score event with composite >= 4. Pulls hard
   * toward dark / attuned regardless of check-in (the FGS scale is
   * objective — overrides cheerful check-in if the human ran it).
   */
  hasPainToday?: boolean;
  /**
   * Today's check-in flagged appetite as `partial` or `none`. Soft
   * pull toward attuned / dark cluster. Cat may be off-food for a
   * reason — voice quiets.
   */
  hasAppetiteOff?: boolean;
  /**
   * Today's litter-box log had abnormal entries. Soft pull toward
   * attuned / indignant. Cats DO notice when something's off in the
   * routine; the voice does too.
   */
  hasLitterAbnormal?: boolean;
  /**
   * Today's water intake direction vs the cat's own 7-day baseline
   * (audit 2026-05-14 round 14). 'low' / 'high' nudge toward attuned
   * — drinking off-baseline is something a cat would notice in its
   * own body. Normal water = no pull. Null when not enough baseline
   * data to compute.
   */
  waterDirection?: 'low' | 'high' | 'normal' | null;
  /**
   * 30-day weight trend direction (audit 2026-05-14 round 14).
   * 'up' / 'down' nudge toward attuned + cozy — a body that's
   * meaningfully changed registers in the cat's felt-sense. 'stable'
   * and null are neutral. The diary's "embodied not numerical" rule
   * applies upstream; here we just use the direction to bias mood.
   */
  weightTrendDirection?: 'up' | 'down' | 'stable' | null;
};

/**
 * Map behavior-observation tags to the moods they affinity-boost.
 * Each matching tag bumps the affinity-boosted moods by 1.2× before
 * clamping. Multiple matching tags compound (cap is the clamp range).
 *
 * The taxonomy here mirrors the `TAG_DELTAS` table in personality.ts
 * so the same body-language tag that builds personality long-term
 * also nudges today's mood short-term. Two horizons of the same
 * signal — week-by-week personality drift + within-day mood response.
 */
const TAG_MOOD_AFFINITY: Record<string, DailyMoodId[]> = {
  // ── joy / play family ────────────────────────────────────────────
  playful: ['playful', 'mischievous'],
  hunting: ['playful', 'mischievous', 'curious'],
  aroused: ['playful', 'mischievous'],
  focused: ['curious', 'mischievous'],
  // ── curious / investigating ──────────────────────────────────────
  curious: ['curious', 'playful'],
  investigating: ['curious'],
  alert: ['curious'],
  tracking: ['curious', 'mischievous'],
  monitoring: ['curious'],
  // ── affectionate / bonded ────────────────────────────────────────
  affectionate: ['affectionate', 'chosen', 'cozy'],
  soliciting: ['affectionate', 'chosen', 'attuned'],
  greeting: ['chosen', 'affectionate'],
  sociable: ['chosen', 'affectionate', 'playful'],
  hungry: ['affectionate', 'chosen'], // soliciting cousin
  // ── confident / dominant-positive ────────────────────────────────
  confident: ['imperious', 'chosen', 'philosophical'],
  // ── calm / cozy / contemplative ──────────────────────────────────
  relaxed: ['cozy', 'philosophical', 'attuned'],
  content: ['cozy', 'affectionate'],
  sleepy: ['cozy'],
  'winding-down': ['cozy', 'attuned'],
  // ── anxious / withdrawn ──────────────────────────────────────────
  fearful: ['attuned', 'indignant'],
  cautious: ['attuned', 'curious'],
  withdrawn: ['attuned', 'indignant'],
  // ── annoyed / dominant-negative ──────────────────────────────────
  annoyed: ['grumpy', 'sarcastic'],
  irritated: ['grumpy', 'sarcastic'],
  defensive: ['indignant', 'grumpy'],
  overstimulated: ['grumpy', 'theatrical'],
  bored: ['grumpy', 'philosophical'],
};

const TAG_BOOST = 1.2;
const CHECKIN_BOOST_HAPPY = 1.15;
const CHECKIN_BOOST_OFF = 1.2;
const CHECKIN_SUPPRESS_OFF = 0.8;
const AGE_BOOST = 1.3;
const AGE_SUPPRESS = 0.7;
const TODAY_MOD_MIN = 0.5;
const TODAY_MOD_MAX = 1.7;

// ---------------------------------------------------------------------------
// Live mood signal multipliers (audit 2026-05-14 architectural expansion)
// ---------------------------------------------------------------------------
//
// Maps the new signals (weather, meow intent, pain/appetite/litter) to
// per-mood multiplier contributions. Each contribution is bounded so
// no single signal dominates; the cumulative product gets clamped at
// the end to keep todayMod a SOFT pull (range [0.5, 1.7]).

/** WMO weather code → moods it nudges. */
const WEATHER_MOOD_AFFINITY: Array<{
  match: (code: number) => boolean;
  moods: DailyMoodId[];
  /** Multiplier per match. Larger = stronger pull. */
  boost: number;
}> = [
  // Fog 45–48: muffled, contemplative
  { match: (c) => c === 45 || c === 48, moods: ['philosophical', 'attuned', 'cozy'], boost: 1.15 },
  // Drizzle / rain 51–67: cozy stay-in energy
  { match: (c) => c >= 51 && c <= 67, moods: ['cozy', 'attuned', 'philosophical'], boost: 1.2 },
  // Rain showers 80–82
  { match: (c) => c >= 80 && c <= 82, moods: ['cozy', 'grumpy'], boost: 1.15 },
  // Snow 71–77, 85–86: curious + cozy
  {
    match: (c) => (c >= 71 && c <= 77) || c === 85 || c === 86,
    moods: ['curious', 'cozy'],
    boost: 1.2,
  },
  // Thunderstorm 95–99: cats hate storms — attuned + indignant
  { match: (c) => c >= 95 && c <= 99, moods: ['attuned', 'indignant'], boost: 1.3 },
];

/** Meow translator intent → moods it nudges. */
const MEOW_INTENT_AFFINITY: Record<string, DailyMoodId[]> = {
  distress: ['attuned', 'indignant'],
  warning: ['indignant', 'imperious'],
  annoyed: ['grumpy', 'sarcastic'],
  playful: ['playful', 'mischievous'],
  curious: ['curious'],
  greeting: ['chosen', 'affectionate'],
  comfort_seeking: ['affectionate', 'chosen', 'cozy'],
  self_soothing: ['cozy', 'attuned'],
  demand_food: ['imperious', 'grumpy'],
  demand_attention: ['theatrical', 'imperious'],
};

const WEATHER_BOOST_DEFAULT = 1.15;
const MEOW_BOOST = 1.18;
const PAIN_BOOST = 1.4; // hardest pull — pain overrides cheerfulness
const APPETITE_OFF_BOOST = 1.18;
const LITTER_ABNORMAL_BOOST = 1.15;
const WATER_OFF_BOOST = 1.15;
const WEIGHT_TREND_BOOST = 1.18;
const HOT_DAY_THRESHOLD_C = 30;
const COLD_DAY_THRESHOLD_C = 5;

/**
 * Build a `MoodWeightModifier` from today's context. Pure function.
 * The returned function evaluates the per-mood multiplier on demand
 * inside the lottery.
 *
 * Plug into `pickDailyMood` / `resolveTodaysMood` as `todayMod` (the
 * new parameter added 2026-05-13). The 2026-05-14 expansion adds
 * five live signals: weather, meow intents, pain, appetite, litter.
 * Architecture goal: "she woke up imperious, but after the
 * thunderstorm and the weird meow, she's quieter now" — the daily
 * base is stable, the live overlay shifts as today unfolds.
 */
export function buildTodayBehaviorMod(ctx: TodayContext): MoodWeightModifier {
  const tags = (ctx.todayTags ?? [])
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 0);
  const checkin = ctx.checkinMood ?? null;
  const ageMonths = ctx.ageMonths ?? null;
  const weatherCode = ctx.weatherCode ?? null;
  const apparentTempC = ctx.apparentTempC ?? null;
  const meowIntents = (ctx.meowIntents ?? [])
    .map((i) => i.toLowerCase().trim())
    .filter((i) => i.length > 0);
  const hasPain = !!ctx.hasPainToday;
  const hasAppetiteOff = !!ctx.hasAppetiteOff;
  const hasLitterAbnormal = !!ctx.hasLitterAbnormal;
  const waterDirection = ctx.waterDirection ?? null;
  const weightTrendDirection = ctx.weightTrendDirection ?? null;

  // Pre-compute per-mood multiplier contribution from tags + meow
  // intents so each call to the modifier is O(1) instead of O(tags).
  const tagMult = new Map<DailyMoodId, number>();
  for (const tag of tags) {
    const matched = TAG_MOOD_AFFINITY[tag];
    if (!matched) continue;
    for (const moodId of matched) {
      tagMult.set(moodId, (tagMult.get(moodId) ?? 1.0) * TAG_BOOST);
    }
  }
  const meowMult = new Map<DailyMoodId, number>();
  for (const intent of meowIntents) {
    const matched = MEOW_INTENT_AFFINITY[intent];
    if (!matched) continue;
    for (const moodId of matched) {
      meowMult.set(moodId, (meowMult.get(moodId) ?? 1.0) * MEOW_BOOST);
    }
  }
  // Weather mult — one per code, not per (code × match), so the same
  // code doesn't double up.
  const weatherMult = new Map<DailyMoodId, number>();
  if (weatherCode != null) {
    for (const w of WEATHER_MOOD_AFFINITY) {
      if (!w.match(weatherCode)) continue;
      for (const moodId of w.moods) {
        weatherMult.set(moodId, (weatherMult.get(moodId) ?? 1.0) * w.boost);
      }
    }
  }
  // Temperature extremes — orthogonal to weather code (a 32°C clear
  // day still pulls grumpy / theatrical; a -5°C snowfall pulls cozy
  // hard).
  if (apparentTempC != null) {
    if (apparentTempC >= HOT_DAY_THRESHOLD_C) {
      for (const m of ['grumpy', 'theatrical', 'sarcastic'] as DailyMoodId[]) {
        weatherMult.set(m, (weatherMult.get(m) ?? 1.0) * WEATHER_BOOST_DEFAULT);
      }
    } else if (apparentTempC <= COLD_DAY_THRESHOLD_C) {
      for (const m of ['cozy', 'attuned'] as DailyMoodId[]) {
        weatherMult.set(m, (weatherMult.get(m) ?? 1.0) * WEATHER_BOOST_DEFAULT);
      }
    }
  }

  return (mood: DailyMoodDef) => {
    let mult = 1.0;
    mult *= tagMult.get(mood.id) ?? 1.0;
    mult *= meowMult.get(mood.id) ?? 1.0;
    mult *= weatherMult.get(mood.id) ?? 1.0;

    // Check-in soft pull
    if (checkin === 'happy') {
      if (mood.cluster === 'warm' || mood.cluster === 'joy') {
        mult *= CHECKIN_BOOST_HAPPY;
      }
    } else if (checkin === 'off') {
      if (mood.cluster === 'sass' || mood.cluster === 'dark') {
        mult *= CHECKIN_BOOST_OFF;
      }
      if (mood.cluster === 'warm' || mood.cluster === 'joy') {
        mult *= CHECKIN_SUPPRESS_OFF;
      }
    }

    // Pain — overrides cheerfulness. Hardest pull (1.4× toward dark
    // cluster / attuned, suppress warm/joy).
    if (hasPain) {
      if (mood.id === 'attuned' || mood.cluster === 'dark') {
        mult *= PAIN_BOOST;
      }
      if (mood.cluster === 'warm' || mood.cluster === 'joy') {
        mult *= 0.7;
      }
    }

    // Appetite off — soft attuned pull (cat may be quiet for a reason)
    if (hasAppetiteOff) {
      if (mood.id === 'attuned' || mood.id === 'cozy' || mood.cluster === 'dark') {
        mult *= APPETITE_OFF_BOOST;
      }
      if (mood.cluster === 'joy') {
        mult *= 0.85;
      }
    }

    // Litter abnormal — soft attuned/indignant pull
    if (hasLitterAbnormal) {
      if (mood.id === 'attuned' || mood.id === 'indignant') {
        mult *= LITTER_ABNORMAL_BOOST;
      }
    }

    // Water off-baseline — soft attuned pull (audit 2026-05-14 round
    // 14). Low water = quietly off; high water = also off but the
    // direction matters less for the cat's voice register. Either
    // direction nudges attuned. Normal water = silent.
    if (waterDirection === 'low' || waterDirection === 'high') {
      if (mood.id === 'attuned' || mood.id === 'cozy') {
        mult *= WATER_OFF_BOOST;
      }
    }

    // Weight trend — meaningful direction shift over 30d nudges
    // attuned + cozy (the cat NOTICES a body that has changed).
    // 'stable' / null = no pull. Audit 2026-05-14 round 14.
    if (weightTrendDirection === 'up' || weightTrendDirection === 'down') {
      if (mood.id === 'attuned' || mood.id === 'cozy') {
        mult *= WEIGHT_TREND_BOOST;
      }
    }

    // Age life-stage pull
    if (ageMonths != null) {
      if (ageMonths < 18) {
        // Kitten / young adult — boost play / curiosity / chaos.
        if (mood.id === 'playful' || mood.id === 'mischievous' || mood.id === 'curious') {
          mult *= AGE_BOOST;
        }
        if (mood.id === 'cozy' || mood.id === 'philosophical') {
          mult *= AGE_SUPPRESS;
        }
      } else if (ageMonths > 132) {
        // Senior (11+ yr) — boost loaf / contemplation / attunement.
        if (mood.id === 'cozy' || mood.id === 'philosophical' || mood.id === 'attuned') {
          mult *= AGE_BOOST;
        }
        if (mood.id === 'playful' || mood.id === 'mischievous') {
          mult *= AGE_SUPPRESS;
        }
      }
    }

    // Clamp so this stays a SOFT pull. The big-swing layer is
    // feedbackMod (^1.5 exponent, 32× spread); todayMod nudges,
    // doesn't dominate.
    return Math.max(TODAY_MOD_MIN, Math.min(TODAY_MOD_MAX, mult));
  };
}
