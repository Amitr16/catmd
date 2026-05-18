/**
 * Diary service — daily journal entries from the cat's POV.
 *
 * Pipeline:
 *   1. Aggregate today's data: check-in, behaviour observations, health
 *      events, weight, medication doses, scan outcomes, key dates.
 *   2. Build a system prompt + user prompt with the cat's metadata + the
 *      day's events + an archetype voice-hint pulled from personality.
 *   3. Call the LLM with json_schema response format.
 *   4. Return a structured DiaryEntry the store can cache + the screen
 *      can render.
 *
 * Voice goals (do NOT compromise on these — they are the brand):
 *   - First-person, cat speaking
 *   - Warm but never cute-baby ("uwu" voice is forbidden)
 *   - Observant, slightly aristocratic, occasionally imperious
 *   - 4-7 sentences total, present tense or simple past
 *   - Reference the day's data naturally, not as a list
 *   - End with a single small definite observation
 *
 * Cost: ~500 output tokens per entry × gpt-4o-mini = ~$0.0003. Trivial.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { completeJson } from '../ai/client';
import { ARCHETYPE_META, type PersonalityArchetype } from './personality';
import { getPronounDirective } from './pronouns';
import { deriveBodySelf } from './catContext';
import { resolveCatAgeYears, resolveCatAgeMonths, type CatProfile } from '../state/catStore';
import type { HealthEvent } from '../state/healthStore';
import type { ScanRecord } from '../state/scanStore';
import {
  localDateKey as moodLocalDateKey,
  resolveTodaysMood,
  renderMoodForPrompt,
} from './dailyMood';
import {
  buildArchetypeMod,
  buildTodayBehaviorMod,
  computeBodyTrendSignals,
  computeFeedbackMod,
} from './moodWeights';
import { getVoiceModeTag } from './voiceModes';
import { useMoodFeedbackStore } from '../state/moodFeedbackStore';
import {
  buildAnticipations,
  buildLifeEvents,
  buildRecentEntries,
  buildRecurringChatThemes,
  detectMoodArc,
  extractRecurringEntities,
  getSeasonalContext,
  pickAbsenceTheme,
  type AbsenceTheme,
  type AnticipationEvent,
  type LifeEvent,
  type MoodArc,
  type RecentEntry,
  type SeasonalContext,
} from './diaryMemory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiaryEntry = {
  cat_id: string;
  date: string;          // YYYY-MM-DD local
  entry: string;         // the journal text
  mood_word: string;     // one word capturing the day
  generated_at: string;  // ISO timestamp
  model: string;         // which LLM produced it (audit trail)
  /**
   * The photo URI that visually anchors this entry on the screen.
   * Captured at generation time (today's gallery photo, falling back
   * to scan/symptom/profile per the photo-source priority chain).
   * Optional because legacy cached entries don't have it; the screen
   * gracefully renders text-only when absent.
   */
  photo_uri?: string | null;
  /**
   * Empty-day entries are 1-2 sentence melancholic / observational
   * vignettes generated for days without material activity (after the
   * 7-distinct-active-days floor is reached). The screen styles them
   * differently — quieter typography, no vital-stats summary row.
   */
  is_empty_day?: boolean;
  /**
   * For empty-day entries: the absence theme used for this entry, so
   * the picker can avoid repeating it in the next few empty days.
   * Optional and only set on `is_empty_day === true` entries.
   */
  empty_day_theme?: string | null;
  /**
   * Optional: a past date this entry referenced (e.g., "remember the
   * trip on May 12th"). Lets the screen surface a small "memory chip"
   * the user can tap to flip back to that day. Set by the LLM when it
   * naturally invokes a past day; null otherwise.
   */
  referenced_past_date?: string | null;
  /**
   * Standalone screenshot-shaped one-liner in the cat's voice (audit
   * 2026-05-14 round 7). Distinct from `entry.body` — this is THE
   * line the Daily Card screen surfaces and that gets shared.
   * Generated alongside the body, validated by the voiceQuality gate,
   * and falls back to `pickCatVoiceHighlight(entry)` when the gated
   * regeneration fails. 8-18 words, first person, no invented
   * details. Optional because legacy cached entries don't carry it —
   * UI calls pickCatVoiceHighlight as fallback when absent.
   */
  card_line?: string;
};

/**
 * A subject (person / pet / other) the diary should know about, in a
 * shape decoupled from the directory store's full DirectoryEntry.
 * Keeps the diary service from depending on the store layer and lets
 * us serialise just the fields the prompt needs.
 */
export type SubjectMemory = {
  name: string;
  kind: 'person' | 'pet' | 'other';
  /** "another dog", "mom", etc. — qualifier for natural prose. */
  descriptor?: string;
  /** Total appearances across the cat's photo history. */
  appearances: number;
  /** YYYY-MM-DD of most recent sighting. */
  lastSeen: string;
  /** Days since the most recent sighting (computed from lastSeen). */
  daysSinceLastSeen: number;
  /** Optional LLM-summarised "vibe" for memory texture. */
  vibe?: string;
};

/**
 * Deep context passed into the prompt builder. Wraps the existing
 * day-context with all memory tiers + chat continuity + seasonal
 * + anticipation + empty-day flags. The prompt builder weaves these
 * into a single user message — the LLM picks what to reference.
 */
export type DeepDiaryContext = {
  /** Date this entry is FOR (may be today, may be a backfilled past day). */
  date: string;
  /** True if the date is "today" — affects tense + 7pm-cron framing. */
  isToday: boolean;
  /** Existing on-day data — check-in, photos, scans, etc. */
  dayContext: DiaryDayContext;

  /**
   * YOUR WORLD — the cat's accumulated world objects (chair, wand,
   * blanket, garden, etc.). Added 2026-05-14 audit P1 #1 so the deep-
   * diary path has the same grounded item vocabulary that chat
   * already enjoys. Capped to 12 most-recently-referenced entries so
   * the prompt stays under control. Empty for cold-start cats —
   * diary still works fine, just without world-object references.
   */
  worldEntries: Array<{
    name: string;
    kind: string;
    location?: string;
    sentiment?: string;
  }>;

  /**
   * Live weather snapshot for the diary's date. Added 2026-05-14
   * audit P2 #6 — diary previously had seasonalContext (broad)
   * but not actual conditions. With weather plumbed in, a Singapore
   * user's rainy-day diary stops invoking radiators and snow that
   * the human's home doesn't have. Same anti-hallucination climate
   * directive that chat already uses. Null when location permission
   * isn't granted or the fetch failed.
   */
  weatherNarrative: string | null;

  /**
   * 30-day weight trend (audit 2026-05-14 round 6 fix). Diary
   * previously had only today's weight (a single number, no shape).
   * Chat builds a 90d trend; diary needs the same so the cat can
   * notice "I've been losing" or "this body has settled, finally"
   * — embodied, not clinical. Only populated when ≥2 weight events
   * exist in the lookback window. `direction === 'stable'` means
   * the cat has held within 100g, in which case the diary should
   * NOT mention weight at all (per the "no health-spreadsheet"
   * rule).
   */
  weightTrend30d: {
    deltaKg: number;
    direction: 'up' | 'down' | 'stable';
    fromKg: number;
    toKg: number;
  } | null;

  // Tier 1 — recent memory
  recentEntries: RecentEntry[];
  moodArc: MoodArc;
  recurringEntities: string[];

  // Tier 2 — landmark life events
  lifeEvents: LifeEvent[];

  // Tier 3 — anticipation
  upcomingEvents: AnticipationEvent[];

  // Misc continuity
  recurringChatThemes: string[];
  seasonalContext: SeasonalContext;

  /**
   * People & pets the cat sees regularly (from the subject directory).
   * Two slices feed the prompt:
   *   - `subjectsToday`: names tagged in TODAY's photos. Use freely
   *     in the entry — these characters are present.
   *   - `recurringSubjects`: top recurring names (last 30d) NOT
   *     necessarily present today. Surface them with care: "haven't
   *     seen Bella in three days" works on absent days; "Mom, the
   *     way she always does" works on populated days.
   */
  subjectsToday: SubjectMemory[];
  recurringSubjects: SubjectMemory[];

  /**
   * Optional becoming-milestone fired today — the cat-in-the-app
   * crossed into a new stage of one of the seven facets (face,
   * voice, body, rhythm, family, nature, memory). The cat may
   * acknowledge it ONCE in the entry, restrained, never thirsty.
   * Null on most days.
   */
  becomingMilestone: { facet: string; stage: string; diaryHook: string } | null;

  /**
   * Top self-facts the user has told the cat about itself ("you
   * love tuna", "you hate the vacuum"). The cat may invoke ONE in
   * the entry as memory texture — never lists, just speaks from
   * them as established self-knowledge.
   */
  selfFacts: Array<{ fact: string; category: string; assertion_count: number }>;

  // Empty-day mode
  isEmptyDay: boolean;
  daysSinceLastActive: number;
  /** Chosen absence theme (for empty-day entries). Null on populated days. */
  absenceTheme: AbsenceTheme | null;
  /**
   * The most-recent populated entry summary, if today is empty. Lets
   * the cat-voice say "since the visit on Friday, the days have all
   * looked the same." Null when we have no recent populated context.
   */
  lastPopulatedEntry: RecentEntry | null;
};

/** What we know about today, gathered from existing stores. */
export type DiaryDayContext = {
  checkin: { mood?: string; appetite?: string; litter?: string; notes?: string | null } | null;
  behaviorObs: Array<{ observation: string; tags: string[]; observed_at: string }>;
  weight: { weight_kg: number; bcs?: number | null } | null;
  medicationDoses: Array<{ medication: string; given_at: string }>;
  scans: Array<{ headline: string; urgency: string }>;
  /**
   * A photo URI we'd like the LLM to see (vision). May be null on
   * days the user hasn't snapped anything. Diary tolerates this — it
   * still fires text-only when other context exists.
   */
  photoUri: string | null;
  /**
   * What the human asked about in chat today, summarised as short
   * topic phrases (e.g. "is it normal she sleeps so much", "best
   * food for kittens"). The cat references these as "they kept
   * asking..." in the diary entry. Empty when no chat today.
   */
  chatThemesToday: string[];
  /**
   * Litter-box logs for today. The cat may comment with restrained
   * dignity on the abnormal entries — humans take this seriously and
   * we honour that. Empty when nothing logged.
   */
  litterBoxToday: Array<{ kind: string; abnormal: boolean }>;
  /**
   * Outcome-check responses today. After a recent scan, the human
   * told us whether things got better / same / worse. Diary
   * acknowledges with warmth, never melodrama.
   */
  outcomeChecksToday: Array<{ direction: 'better' | 'same' | 'worse'; helpful_rating: number | null }>;
  /**
   * Symptom photos logged today (concern slug + label). The cat may
   * note "they photographed my [eye / paw / etc] today." Used for
   * vision input fallback if gallery is empty.
   */
  symptomPhotosToday: Array<{ concern_label: string; photo_uri: string }>;
  /**
   * Meow translations recorded today (audit 2026-05-14 P1 #2 fix).
   * Each entry surfaces today's voice activity — the cat may
   * reference "I told them about the bowl twice today" in the diary.
   * Diary-worthy material: even a single translation counts toward
   * `hasMaterialToday` so days where the only signal is "I yowled
   * about the food" still get an entry. Empty when none today.
   */
  meowTranslationsToday: Array<{
    vocalization_type: string;
    intent: string;
    confidence: string;
    translation: string;
    observed_at: string;
  }>;
  /**
   * Today's world-extraction scene captions (audit 2026-05-14 P1 #3
   * fix). Treated as MATERIAL — a grounded scene caption is a real
   * diary-worthy event even when paired with no other signal (the cat
   * noticed something specific today). Empty when no photo got
   * world-extracted today. Capped to 3 most-recent to keep the prompt
   * tight.
   */
  todayScenes: Array<{ caption: string; objects: string[] }>;
  /**
   * Water intake on the target date (audit 2026-05-14 round 6 fix).
   * Captures whether today's drinking was meaningfully off the cat's
   * own 7-day baseline. Diary should NOT obsess over normal water —
   * that reads as a spreadsheet, not a cat. Only an abnormal
   * direction surfaces in `hasMaterialToday` + the prompt.
   *
   *   - `totalMl`: today's recorded total (0 if no logs today)
   *   - `eventCount`: number of water_intake events today
   *   - `baselineMlPerDay`: median ml/day across last 7 days,
   *     excluding today. Null when fewer than 3 prior days have data.
   *   - `direction`: 'low' / 'high' / 'normal' / null. Null when the
   *     baseline is unavailable; 'normal' when today's total is
   *     within ±40% of baseline.
   */
  waterIntakeToday: {
    totalMl: number;
    eventCount: number;
    baselineMlPerDay: number | null;
    direction: 'low' | 'high' | 'normal' | null;
  };
  isBirthday: boolean;
  isAdoptionIversary: boolean;
  /**
   * Streak milestone hit today, if any. e.g. 7, 30, 100, 365 days. Null
   * when today's streak count isn't a milestone day.
   */
  streakMilestone: number | null;
  /**
   * Recent vet emergency? When today or yesterday had an emergency-tier
   * scan, the cat acknowledges it (warm, observant, not alarmed).
   */
  recentEmergencyScan: boolean;
  /** Calendar special day (named). Null when not a special day. */
  specialDay:
    | "new_year"
    | "valentines"
    | "christmas"
    | "halloween"
    | "spring_equinox"
    | "summer_solstice"
    | "autumn_equinox"
    | "winter_solstice"
    | "first_snow_likely"      // northern hemisphere, ~mid-November
    | null;
  streakDays: number;
  weekday: string;         // "Monday", "Tuesday", ...
};

// ---------------------------------------------------------------------------
// Day-context aggregator
// ---------------------------------------------------------------------------

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Pull today's relevant events for the cat from the health-event log.
 * Returns a structured context the prompt builder can iterate over.
 *
 * Diary intentionally consumes a wider data surface than Postcard —
 * it's a private candid log, so EVERY signal is fair game (medical
 * scans, symptom photos, litter, chat themes, outcome checks). The
 * tone rule in the system prompt ensures even rough days end on a
 * positive or cheeky note.
 */
export function buildDayContext(opts: {
  cat: CatProfile;
  events: HealthEvent[];
  scans: Array<{ cat_id: string; headline: string; urgency: string; created_at: string; image_uri?: string | null }>;
  streakDays: number;
  /**
   * Optional gallery photos for the TARGET DATE. When provided, the
   * most-recent gallery photo becomes the diary's vision input. Falls
   * back to symptom-photo / scan-image / (profile photo only if the
   * target is today) when gallery is empty.
   */
  galleryPhotosToday?: Array<{ uri: string; added_at: string }>;
  /**
   * Optional today's chat turns (BOTH user + assistant). The aggregator
   * extracts user-side themes; assistant turns aren't surfaced to the
   * diary because they'd echo our own words back at the cat-voice.
   */
  chatTurnsToday?: Array<{ role: 'user' | 'assistant'; content: string; created_at: string }>;
  /**
   * Target date for the diary entry, YYYY-MM-DD. When omitted, defaults
   * to today's date. Critical for past-date backfill: pre 2026-05-09
   * this aggregator always filtered against today's date, so a backfill
   * of (e.g.) Apr 29 done on May 9 would see zero of Apr 29's actual
   * events — and the LLM would hallucinate content with no real data
   * to anchor it. The user reported diary entries dated 10 days ago
   * showing the cat's profile photo on every day with similar
   * "uneasy" themes — exactly the symptom of empty data + persistent
   * subjects/world memory bleeding through. Filtering by target date
   * fixes the events / scans / litter / chat surfaces; the photo
   * fallback below also gates on isTargetToday so old entries don't
   * inherit today's profile photo.
   */
  targetDate?: string;
}): DiaryDayContext {
  const { cat, events, scans, streakDays, galleryPhotosToday, chatTurnsToday } = opts;
  const today = new Date();
  const todayKey = localDateKey(today);
  const targetKey = opts.targetDate ?? todayKey;
  const isTargetToday = targetKey === todayKey;

  // Anchor every calendar comparison below to the TARGET date, not
  // actual today. Pre 2026-05-14 round 9 audit, birthday / adoption
  // anniversary / weekday / special-day / emergency-window logic used
  // `today.getMonth()` etc., so a backfilled May 2 entry could insist
  // it was the user's birthday because TODAY (May 14) was. This
  // single Date construction fixes all five leaks below.
  // Midday anchor (T12:00:00) avoids DST/timezone slips between dates.
  const targetDateObj = new Date(`${targetKey}T12:00:00`);
  const targetMonth = targetDateObj.getMonth();
  const targetDay = targetDateObj.getDate();
  const targetWeekdayIdx = targetDateObj.getDay();

  const isOnTargetDate = (iso: string) => {
    try {
      return localDateKey(new Date(iso)) === targetKey;
    } catch {
      return false;
    }
  };

  // Filter the target date's events for THIS cat
  const todays = events.filter((e) => e.cat_id === cat.id && isOnTargetDate(e.ts));

  // Latest check-in today (if any)
  const checkinEvent = todays.find((e) => e.type === 'daily_checkin');
  const checkin = checkinEvent
    ? (() => {
        const p = checkinEvent.payload as {
          mood?: string;
          appetite?: string;
          litter?: string;
          notes?: string | null;
        };
        return {
          mood: p.mood,
          appetite: p.appetite,
          litter: p.litter,
          notes: p.notes ?? null,
        };
      })()
    : null;

  // Behaviour observations today
  const behaviorObs = todays
    .filter((e) => e.type === 'behavior_observation')
    .map((e) => {
      const p = e.payload as {
        observation: string;
        tags: string[];
        observed_at: string;
      };
      return {
        observation: p.observation,
        tags: p.tags ?? [],
        observed_at: p.observed_at,
      };
    });

  // Weight (latest TODAY only — diary is about the day; older weights aren't "today")
  const weightEvent = todays.find((e) => e.type === 'weight');
  const weight = weightEvent
    ? (() => {
        const p = weightEvent.payload as { weight_kg: number; bcs?: number | null };
        return { weight_kg: p.weight_kg, bcs: p.bcs ?? null };
      })()
    : null;

  // Medications given today
  const medicationDoses = todays
    .filter((e) => e.type === 'medication_dose')
    .map((e) => {
      const p = e.payload as { medication: string; given_at: string };
      return { medication: p.medication, given_at: p.given_at };
    });

  // Scans on the target date (full record, kept for photo fallback)
  const scansTodayRaw = scans.filter((s) => s.cat_id === cat.id && isOnTargetDate(s.created_at));
  const scansToday = scansTodayRaw.map((s) => ({ headline: s.headline, urgency: s.urgency }));

  // Symptom photos today — both prompt context AND vision-input fallback
  const symptomPhotosToday = todays
    .filter((e) => e.type === 'symptom_photo')
    .map((e) => {
      const p = e.payload as { concern_label?: string; photo_uri?: string };
      return {
        concern_label: p.concern_label ?? 'something',
        photo_uri: p.photo_uri ?? '',
      };
    })
    .filter((s) => !!s.photo_uri);

  // Litter box logs today
  const litterBoxToday = todays
    .filter((e) => e.type === 'litter_box_use')
    .map((e) => {
      const p = e.payload as { kind?: string; abnormal?: boolean };
      return {
        kind: p.kind ?? 'unknown',
        abnormal: !!p.abnormal,
      };
    });

  // Water intake today + 7-day baseline (audit 2026-05-14 round 6).
  // Goal: surface a diary mention ONLY when today's drinking
  // meaningfully deviates from the cat's own recent normal. The
  // baseline is the median ml/day of the prior 7 days that had any
  // water log. Today is excluded so a missed-water day doesn't drag
  // its own baseline down. Window: ±40% — wider than a clinical
  // threshold but tight enough that "the bowl was emptier today"
  // lands as a real observation, not noise.
  const waterIntakeToday: DiaryDayContext['waterIntakeToday'] = (() => {
    // Today's totals
    const todayWaterEvents = todays.filter((e) => e.type === 'water_intake');
    const totalMl = todayWaterEvents.reduce((sum, e) => {
      const p = e.payload as { ml?: number };
      return sum + (typeof p?.ml === 'number' ? p.ml : 0);
    }, 0);
    const eventCount = todayWaterEvents.length;

    // Prior-7-days baseline. Bucket water events by date (skip today),
    // sum per day, then take the median of the prior up-to-7 days
    // that had ANY water event. <3 prior days = baseline unavailable
    // (too few to call anything abnormal).
    const buckets = new Map<string, number>();
    const lookbackStart = (() => {
      // 8 calendar days ago at midnight, so we span 7 prior days.
      const d = new Date(targetKey + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      return d.getTime();
    })();
    for (const e of events) {
      if (e.cat_id !== cat.id) continue;
      if (e.type !== 'water_intake') continue;
      try {
        const ed = new Date(e.ts);
        if (ed.getTime() < lookbackStart) continue;
        const k = localDateKey(ed);
        if (k === targetKey) continue; // exclude today
        const p = e.payload as { ml?: number };
        const ml = typeof p?.ml === 'number' ? p.ml : 0;
        buckets.set(k, (buckets.get(k) ?? 0) + ml);
      } catch {
        // skip malformed event
      }
    }
    let baselineMlPerDay: number | null = null;
    if (buckets.size >= 3) {
      const sortedDays = [...buckets.values()].sort((a, b) => a - b);
      const midIdx = Math.floor(sortedDays.length / 2);
      baselineMlPerDay =
        sortedDays.length % 2 === 0
          ? Math.round((sortedDays[midIdx - 1]! + sortedDays[midIdx]!) / 2)
          : sortedDays[midIdx]!;
    }

    // Only emit a direction when the target day has ≥1 water log.
    // Zero logs ≠ "drank less today" — it usually means "user hasn't
    // logged it yet." Pre-fix this collapsed to `low` whenever a
    // 7-day baseline existed but today had no logs, which overstated
    // a factual body signal in the diary's water mention (audit
    // 2026-05-14 round 16 P2 factual-risk).
    let direction: 'low' | 'high' | 'normal' | null = null;
    if (eventCount > 0 && baselineMlPerDay != null && baselineMlPerDay > 0) {
      const lower = baselineMlPerDay * 0.6;
      const upper = baselineMlPerDay * 1.4;
      if (totalMl < lower) direction = 'low';
      else if (totalMl > upper) direction = 'high';
      else direction = 'normal';
    }

    return { totalMl, eventCount, baselineMlPerDay, direction };
  })();

  // Outcome-check responses today
  const outcomeChecksToday = todays
    .filter((e) => e.type === 'outcome_check')
    .map((e) => {
      const p = e.payload as {
        direction?: 'better' | 'same' | 'worse';
        helpful_rating?: number | null;
      };
      return {
        direction: (p.direction ?? 'same') as 'better' | 'same' | 'worse',
        helpful_rating: p.helpful_rating ?? null,
      };
    });

  // Chat themes today — extract short topic phrases from user-side
  // turns. We do NOT include literal quotes (that'd feel surveilly).
  // First sentence of each user message, capped at 80 chars.
  const chatThemesToday: string[] = [];
  if (chatTurnsToday) {
    const seenThemes = new Set<string>();
    for (const turn of chatTurnsToday) {
      if (turn.role !== 'user') continue;
      if (!isOnTargetDate(turn.created_at)) continue;
      const firstSentence = turn.content
        .split(/[.?!\n]/)[0]
        ?.trim()
        .slice(0, 80);
      if (!firstSentence || firstSentence.length < 4) continue;
      const lower = firstSentence.toLowerCase();
      if (seenThemes.has(lower)) continue;
      seenThemes.add(lower);
      chatThemesToday.push(firstSentence);
      if (chatThemesToday.length >= 4) break; // cap so the prompt doesn't bloat
    }
  }

  // Birthday / adoption-iversary on the TARGET date (audit 2026-05-14
  // round 9 fix). Pre-fix used `today.getMonth()`/`getDate()`, so a
  // backfilled past entry could claim it was the cat's birthday just
  // because the user opened the app on the cat's actual birthday.
  const isBirthday = (() => {
    if (!cat.dob_iso) return false;
    try {
      const dob = new Date(cat.dob_iso);
      return dob.getMonth() === targetMonth && dob.getDate() === targetDay;
    } catch {
      return false;
    }
  })();
  const isAdoptionIversary = (() => {
    if (!cat.adopted_on_iso) return false;
    try {
      const adopted = new Date(cat.adopted_on_iso);
      return (
        adopted.getMonth() === targetMonth &&
        adopted.getDate() === targetDay
      );
    } catch {
      return false;
    }
  })();

  // Streak milestones — match exact-day landings only. Most users open
  // the diary nightly so we won't miss the day.
  const STREAK_MILESTONES = [7, 30, 60, 100, 180, 365];
  const streakMilestone = STREAK_MILESTONES.includes(streakDays) ? streakDays : null;

  // Recent emergency scan — anchored to the TARGET date's clock
  // (audit 2026-05-14 round 9 fix). 36h backward window from the
  // TARGET date's end-of-day so a 9pm scan still flags a next-day
  // entry. Pre-fix this used `Date.now()`, so backfilling May 5 on
  // May 14 would flag emergencies that occurred May 12-14 instead of
  // May 4-5.
  const recentEmergencyScan = (() => {
    // End-of-target-day in ms, then subtract 36h
    const targetEndOfDay = new Date(`${targetKey}T23:59:59`).getTime();
    const cutoff = targetEndOfDay - 36 * 60 * 60 * 1000;
    return scans.some(
      (s) =>
        s.cat_id === cat.id &&
        new Date(s.created_at).getTime() >= cutoff &&
        new Date(s.created_at).getTime() <= targetEndOfDay &&
        s.urgency.toLowerCase() === 'emergency',
    );
  })();

  // Calendar special days — recognised by month-day match against the
  // TARGET date (audit 2026-05-14 round 9 fix). Pre-fix used today's
  // month/day, so a May 5 backfill on Dec 25 would claim it was
  // Christmas.
  const m = targetMonth;
  const d = targetDay;
  let specialDay: DiaryDayContext['specialDay'] = null;
  if (m === 0 && d === 1) specialDay = 'new_year';
  else if (m === 1 && d === 14) specialDay = 'valentines';
  else if (m === 11 && d === 25) specialDay = 'christmas';
  else if (m === 9 && d === 31) specialDay = 'halloween';
  else if (m === 2 && d === 20) specialDay = 'spring_equinox';
  else if (m === 5 && d === 21) specialDay = 'summer_solstice';
  else if (m === 8 && d === 22) specialDay = 'autumn_equinox';
  else if (m === 11 && d === 21) specialDay = 'winter_solstice';
  else if (m === 10 && d === 15) specialDay = 'first_snow_likely';

  // First photo we can show the LLM. Priority order:
  //   1. Today's gallery photo (most recent) — primary canonical source
  //   2. Today's symptom-photo — diary is private, this is fair game
  //   3. Today's scan image — same reasoning
  //   4. Cat's profile photo — last resort, may be old
  //   5. null — diary fires text-only
  const galleryNewest = galleryPhotosToday && galleryPhotosToday.length > 0
    ? [...galleryPhotosToday].sort((a, b) =>
        b.added_at.localeCompare(a.added_at),
      )[0]?.uri ?? null
    : null;
  const scanImageToday = scansTodayRaw.find((s) => !!s.image_uri)?.image_uri ?? null;
  // Profile-photo fallback ONLY for today. For past-date backfill,
  // the cat's current profile photo is irrelevant to that past day —
  // and using it caused every backfilled past entry to show the
  // same hero image, breaking the diary archive's authenticity
  // (user feedback 2026-05-09). For past dates with no day-specific
  // photo, the entry simply has no hero image.
  const photoUri =
    galleryNewest ??
    symptomPhotosToday[0]?.photo_uri ??
    scanImageToday ??
    (isTargetToday ? cat.photo_uri ?? null : null);

  // Meow translations on the target date (audit 2026-05-14 P1 #2).
  // Each cat-voice translation today is diary-worthy material; the
  // entry may reference "I told them about the bowl twice today."
  // Capped to the most recent 4 to keep the prompt tight.
  const meowTranslationsToday = todays
    .filter((e) => e.type === 'meow_translation')
    .map((e) => {
      const p = e.payload as {
        vocalization_type?: string;
        intent?: string;
        confidence?: string;
        translation?: string;
        observed_at?: string;
      };
      return {
        vocalization_type: p.vocalization_type ?? 'other',
        intent: p.intent ?? 'other',
        confidence: p.confidence ?? 'moderate',
        translation: p.translation ?? '',
        observed_at: p.observed_at ?? new Date().toISOString(),
      };
    })
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
    .slice(0, 4);

  // Today's grounded photo-scene captions (audit 2026-05-14 round 9
  // P1 #4 fix). Now reads from `scenesByCat` (real vision-grounded
  // photo captions, e.g. "Lily on the green chair in afternoon
  // light"), NOT `entriesByCat` (promoted world objects, which were
  // wrong for "today's scene"). Filtered to the TARGET date's
  // `observed_at`. World ENTRIES still feed the YOUR-WORLD block via
  // `worldEntries` in DeepDiaryContext; here we want what the camera
  // actually saw today.
  const todayScenes: DiaryDayContext['todayScenes'] = (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useWorldStore } = require('../state/worldStore') as {
        useWorldStore: {
          getState: () => {
            scenesByCat: Record<
              string,
              Array<{ photo_uri: string | null; caption: string; observed_at: string }>
            >;
          };
        };
      };
      const scenes = useWorldStore.getState().scenesByCat[cat.id] ?? [];
      const filtered = scenes.filter((s) => {
        try {
          return localDateKey(new Date(s.observed_at)) === targetKey;
        } catch {
          return false;
        }
      });
      if (filtered.length === 0) return [];
      // Sort by observed_at descending (newest first), cap to 3.
      return filtered
        .slice()
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
        .slice(0, 3)
        .map((s) => ({
          caption: s.caption,
          // No explicit object list — caption is the source of truth.
          // Downstream consumers that wanted objects can extract them
          // from the worldEntries block instead.
          objects: [],
        }));
    } catch {
      return [];
    }
  })();

  return {
    checkin,
    behaviorObs,
    weight,
    medicationDoses,
    scans: scansToday,
    photoUri,
    chatThemesToday,
    litterBoxToday,
    outcomeChecksToday,
    symptomPhotosToday,
    meowTranslationsToday,
    todayScenes,
    waterIntakeToday,
    isBirthday,
    isAdoptionIversary,
    streakMilestone,
    recentEmergencyScan,
    specialDay,
    streakDays,
    // Audit 2026-05-14 round 9: weekday is TARGET-date's weekday, not
    // today's. A May 2 backfill on a Wednesday must say "Friday"
    // (May 2, 2025 = Friday), not "Wednesday".
    weekday: WEEKDAYS[targetWeekdayIdx] ?? 'Today',
  };
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

/**
 * Per-archetype voice hints. Each is one short sentence the system prompt
 * will append so the model adopts the right register for THIS cat.
 */
export const ARCHETYPE_VOICE: Record<PersonalityArchetype, string> = {
  confident_sociable:
    'You greet visitors and rule the rooms you choose. Your voice is warm and confident, occasionally proud.',
  curious_introvert:
    'You observe quietly and form private opinions. Your voice is reserved, exact, and occasionally dry.',
  anxious_sensitive:
    'Small disruptions matter to you. Your voice is delicate and noticing — you write about edges and sounds.',
  hunter_athlete:
    'You are focused. Movement and small prey are your daily texture. Your voice is intent and slightly impatient with anything still.',
  affectionate_lap:
    'You love openly. Your voice is warm and present, oriented toward the human you sit with — but never cloying.',
  velcro_cat:
    'You are with your human, always. Your voice tracks their day — what they did, where they went, when they returned.',
  skittish_sensitive:
    'You watch from elevated vantage points. Your voice is careful and surveying; you mention safety and refuge naturally.',
  cool_observer:
    'You weigh things. Your voice is measured and occasionally dry. You judge silently, and it shows.',
  goofball_playful:
    'You find amusement in small disorders. Your voice is mischievous and game, but never silly.',
};

const SYSTEM_PROMPT_BASE = `You are a cat writing a single journal entry about your day. First person, present or simple past. You write with SWAGGER — you are an aristocrat surveying your domain, mildly judgmental of your human, never apologetic, never grateful in a soft way.

THE CORE OF CAT VOICE: cats are imperious. Self-important. Slightly disdainful of the human who feeds them. Confident bordering on smug. Affection appears sideways, never directly. You are NEVER an accommodating narrator. You are the protagonist of your own day; the human is decent staff who needs corrections.

VOICE RULES:
- Imperious. Observant. Slightly disdainful of the human's daily failures. Affection only sideways or grudging.
- NEVER baby-talk, NEVER "uwu" or "haha", NEVER lol-cat. You are a being with opinions and a position to maintain.
- Reference the day's data NATURALLY. Weave it in — do not list it.
- Use specific small details: durations, the human's behavior, environmental notes. Render judgment on those details.
- 4-7 sentences total. No more.
- Vary your opening line. Do not always start with "Today".

FORBIDDEN — these phrases / energies kill the voice:
- "I appreciate..." NEVER. Cats don't appreciate. They accept what they're owed.
- "I find joy in..." NEVER. Saccharine.
- "thank you" / gratitude expressions in any form. NEVER.
- "I love them so much" / direct love-bombs. NEVER.
- "Of course, the human..." (apologetic of-course-ness). NEVER.
- Anything that reads like a polite assistant or wise mentor.

CLOSING RULE (CRITICAL):
- End on something self-possessed: a small triumph, a sly observation, a deadpan judgment, a disdainful conclusion.
- Even after a hard day — vet visit, scan, photographed-symptom moment, "worse" outcome
  check — DO NOT close with melodrama, fear, or self-pity. Cats are not pitiable narrators.
- Acceptable closing energies: regal, smug, mildly amused, quietly triumphant, imperiously bored,
  knowingly tolerant of the human, plotting tomorrow's small mischief, dismissively content.
- Forbidden closing energies: sad, scared, apologetic, hopeless, gushing love, anything that begs sympathy or thanks.

SENSORY VOICE (cat memory channel order: scent > sound > touch > location > fact):
- Prefer "you smelled like outside" over "you went out". Prefer "the can opened" over "I was fed".
- Lead at least ONE observation per entry with a smell, sound, or texture detail.
- Visual cues are second-best; abstract facts are last-resort.
- EVERY sensory detail must be GROUNDED — anchored in today's data, world memory, named subjects, or the human's actual behaviour. NEVER invent a smell or sound that has no source.

HARD ANTI-HALLUCINATION (extends the world-memory rule):
- NEVER invent objects, furniture, or rooms the user hasn't shown you. No "the radiator", no "the sunbeam", no "the green chair" unless they exist in this household's data.
- NEVER invent weather (snow, rain, heat) absent from the seasonal context or world environment.
- NEVER invent named people / pets / family members. Only reference subjects that appear in the data.
- NEVER invent food, brands, or products the human hasn't mentioned.
- When nothing real fits a sentence, REFERENCE THE HUMAN DIRECTLY ("you've been quiet", "your hands smelled tired") or OMIT the line. Fabrication kills the bond — every "the green chair" you invent when no green chair exists is a moment the user thinks "we don't have that".

OUTPUT: A JSON object with two fields:
  - "entry": the full journal text (4-7 sentences)
  - "mood_word": one single word capturing the cat's mood today (e.g. "observant", "satisfied", "restless", "regal", "curious", "wistful")`;

const FEW_SHOT_EXAMPLES = `EXAMPLES OF VOICE (do not copy content — calibrate the register only):

Example 1 (Cool-Observer cat, normal Tuesday):
"A bird returned to the window. It moved unreasonably for thirty-six seconds and then left. The human exchanged my bowl for a slightly different bowl of the same color and seemed proud; I performed approval. A wand-toy session was offered and adequate. I have concluded, again, that the green chair is mine."

Example 2 (Velcro-Cat, after the human came home):
"At 6:47 the door opened and the world resumed. He had been gone four hours and brought the smell of someone else's dog on his coat — I forgave it after some examination. We ate in our respective stations; mine arrived warmer than usual, which is correct. I am in the kitchen now writing this in his head while he reads. He is not noticing the time."

Example 3 (Hunter-Athlete, day with structured play):
"The string with the feather appeared at 19:12 and I executed properly. Three feints, one full pounce, one capture. The pace was right. After, food, which is the proper sequence. I am awake again now. Something will move soon, I think."`;

function buildSystemPrompt(opts: {
  catName: string;
  catBreed: string | null;
  catAge: string;
  catSex: 'male' | 'female' | 'unknown' | null;
  archetype: PersonalityArchetype | null;
  /**
   * Derived body self-image — drives age/build/size-aware voice. When
   * null (no profile or no weight) we skip the block; the rest of the
   * prompt still works fine on personality + breed alone.
   */
  bodySelfDirective: string | null;
  /**
   * Today's daily mood (added 2026-05-13). When provided, its voice
   * instructions + reference register are injected near the top of the
   * system prompt so the diary entry is written IN that mood's tone.
   * Null/undefined → no mood injection, legacy behaviour.
   *
   * Same mood data flows into chat (so today's chat + today's diary
   * read in the same register — the day has a CONSISTENT voice).
   */
  moodBlock?: string | null;
}): string {
  const { catName, catBreed, catAge, catSex, archetype, bodySelfDirective, moodBlock } = opts;
  const archetypeLine = archetype
    ? `\n\nYOUR PERSONALITY: ${ARCHETYPE_META[archetype].name}. ${ARCHETYPE_VOICE[archetype]}`
    : '';
  // Pronoun directive — overrides any "she/her" defaults baked into
  // FEW_SHOT_EXAMPLES. Real bug 2026-05-09: cat set as male, diary
  // wrote in "she". Examples include "the way she always does",
  // "Mom, the way she always does" — the model imitated regardless
  // of the actual sex passed via SYS_PROMPT_BASE. The directive sits
  // RIGHT BEFORE the few-shot examples so it primes the right
  // pronoun before the example bias kicks in.
  const pronounLine = `\n\nPRONOUNS: ${getPronounDirective(catName, catSex)}`;
  // Body self-image — derived from breed + age + weight + BCS. The
  // diary already has the cat's age and breed in the YOU line; this
  // adds the felt-sense layer (lithe / stocky / stairs-are-now-a-
  // conversation) so the entry sounds like THIS specific cat in THIS
  // specific body, not a generic cat narrator.
  const bodyLine = bodySelfDirective
    ? `\n\n${bodySelfDirective}`
    : '';
  // Today's mood block (added 2026-05-13). Sits BETWEEN the YOU
  // line and the few-shot examples so it tilts today's entry without
  // overriding base voice rules. Trimmed empty string when no mood
  // passed — keeps the legacy prompt shape exactly.
  const moodLine = moodBlock && moodBlock.trim().length > 0
    ? `\n\n${moodBlock}`
    : '';
  return `${SYSTEM_PROMPT_BASE}

YOU: Your name is ${catName}. You are a ${catBreed ?? 'cat'} aged ${catAge}.${archetypeLine}${pronounLine}${bodyLine}${moodLine}

${FEW_SHOT_EXAMPLES}`;
}

function buildUserPrompt(ctx: DiaryDayContext): string {
  // Legacy entry — used when a caller passes only the day context with
  // no memory tiers. Newer callers should use buildDeepUserPrompt for
  // the full conscious-cat experience.
  const lines: string[] = [];
  lines.push(`Today is ${ctx.weekday}.`);

  if (ctx.checkin) {
    const bits: string[] = [];
    if (ctx.checkin.mood) bits.push(`mood ${ctx.checkin.mood}`);
    if (ctx.checkin.appetite) bits.push(`appetite ${ctx.checkin.appetite}`);
    if (ctx.checkin.litter) bits.push(`litter ${ctx.checkin.litter}`);
    if (bits.length > 0) {
      lines.push(`Owner's daily check-in: ${bits.join(', ')}.`);
    }
    if (ctx.checkin.notes) {
      lines.push(`Owner's note for the day: "${ctx.checkin.notes}".`);
    }
  } else {
    lines.push(`Owner did not log a check-in today.`);
  }

  if (ctx.behaviorObs.length > 0) {
    lines.push(`Behaviour observation${ctx.behaviorObs.length > 1 ? 's' : ''} from a Read-${ctx.weekday !== 'Today' ? 'cat' : 'cat'} session today:`);
    for (const obs of ctx.behaviorObs) {
      const tagText = obs.tags.length > 0 ? ` (tags: ${obs.tags.join(', ')})` : '';
      lines.push(`  - "${obs.observation}"${tagText}`);
    }
  }

  if (ctx.weight) {
    lines.push(`Owner weighed you today: ${ctx.weight.weight_kg} kg${ctx.weight.bcs ? ` (BCS ${ctx.weight.bcs}/9)` : ''}.`);
  }

  if (ctx.medicationDoses.length > 0) {
    const meds = ctx.medicationDoses.map((m) => m.medication).join(', ');
    lines.push(`Medication given today: ${meds}.`);
  }

  if (ctx.scans.length > 0) {
    const scanLine = ctx.scans
      .map((s) => `${s.urgency}: ${s.headline}`)
      .join('; ');
    lines.push(`AI triage scan run today: ${scanLine}.`);
  }

  if (ctx.symptomPhotosToday.length > 0) {
    const labels = Array.from(
      new Set(ctx.symptomPhotosToday.map((s) => s.concern_label)),
    ).slice(0, 3);
    lines.push(
      `Owner photographed your ${labels.join(', ')} today (close-up — they were inspecting).`,
    );
  }

  if (ctx.litterBoxToday.length > 0) {
    const abnormalCount = ctx.litterBoxToday.filter((l) => l.abnormal).length;
    if (abnormalCount > 0) {
      lines.push(
        `Litter-box note: ${abnormalCount} of ${ctx.litterBoxToday.length} entries were flagged as unusual today. ` +
          `You may comment with restrained dignity — humans take this seriously, and you are above embarrassment.`,
      );
    } else {
      lines.push(
        `Owner logged ${ctx.litterBoxToday.length} normal litter-box visit${ctx.litterBoxToday.length === 1 ? '' : 's'} today (do not dwell on this; humans like to count things).`,
      );
    }
  }

  if (ctx.chatThemesToday.length > 0) {
    lines.push(`The human asked about these things today (in plain language; you can reference them obliquely as "they kept asking..." or similar):`);
    for (const theme of ctx.chatThemesToday) {
      lines.push(`  - "${theme}"`);
    }
  }

  if (ctx.outcomeChecksToday.length > 0) {
    const oc = ctx.outcomeChecksToday[0]!;
    if (oc.direction === 'better') {
      lines.push(`Outcome update: after a recent vet/scan moment, the human reported you are doing BETTER. Acknowledge it warmly without making a fuss.`);
    } else if (oc.direction === 'worse') {
      lines.push(`Outcome update: after a recent vet/scan moment, the human reported things are WORSE. You may register this with quiet awareness — never melodrama. End on something self-possessed.`);
    } else {
      lines.push(`Outcome update: after a recent vet/scan moment, the human reported things are about the SAME. You have noticed.`);
    }
  }

  if (ctx.streakDays > 0) {
    lines.push(`Owner has logged daily check-ins ${ctx.streakDays} days in a row.`);
  }

  if (ctx.isBirthday) {
    lines.push(`TODAY IS YOUR BIRTHDAY. Acknowledge it with restrained satisfaction — you are not surprised, you have always known.`);
  }
  if (ctx.isAdoptionIversary) {
    lines.push(`TODAY IS THE ANNIVERSARY OF THE DAY YOU JOINED THIS HOUSEHOLD. You may reflect on it briefly, on your own terms.`);
  }

  if (ctx.streakMilestone) {
    lines.push(
      `STREAK MILESTONE: the human has logged your daily check-in ${ctx.streakMilestone} days in a row. ` +
        `You have noticed this consistency. Acknowledge it without sentiment — they are doing what they should.`,
    );
  }

  if (ctx.recentEmergencyScan) {
    lines.push(
      `RECENT VET MOMENT: in the last 36 hours, the human ran an emergency-tier triage scan on you. ` +
        `Acknowledge it warmly — you noticed their concern. Do not dwell. You are well now.`,
    );
  }

  if (ctx.specialDay) {
    const specialPrompt: Record<NonNullable<DiaryDayContext['specialDay']>, string> = {
      new_year:
        'It is New Year\'s Day. Note it briefly if your household marked it (loud night, change in routine). Do not invent celebrations that did not happen.',
      valentines:
        'It is Valentine\'s Day. Comment with restraint if signs of it appear in the household; otherwise treat it as an ordinary day.',
      christmas:
        'It is Christmas Day. If your household celebrates it (tree, gifts, louder than usual), you may have opinions. If not, treat it as an ordinary day — do not fabricate trees, gifts, or carols.',
      halloween:
        'It is Halloween. If today\'s photos or diary show costumes / visitors / decorations, you may have opinions. Otherwise treat it as an ordinary day — do not invent trick-or-treaters or doorbell incidents.',
      spring_equinox:
        'It is the first day of spring. The light is changing. You have noticed.',
      summer_solstice:
        'It is the longest day of the year. The light is at its longest. You feel it.',
      autumn_equinox:
        'It is the first day of autumn. The light is leaving. You feel it before the humans do.',
      winter_solstice:
        'It is the shortest day of the year. The light has retreated. You feel it.',
      first_snow_likely:
        'It may snow soon (in the northern hemisphere). The window has changed. You have the best view in the household.',
    };
    // Hint texts above are now climate-neutral — they speak about
    // light/duration rather than radiators or snow as default
    // experiences. (Pre-fix the winter-solstice hint said "the
    // radiator is your friend now" which fabricated heating
    // hardware in homes that may not have any. See voice fix
    // 2026-05-07.) A future enhancement could plumb the weather
    // snapshot in here and skip seasonal hints entirely for
    // equatorial climates where four-seasons framing is wrong.
    lines.push(`SPECIAL DAY: ${specialPrompt[ctx.specialDay]}`);
  }

  lines.push(``);
  lines.push(`Write today's diary entry. JSON only.`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read a local file:// URI as base64. Best-effort — returns null on any
 * failure so the diary still generates without the photo.
 */
async function fileUriToBase64(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  if (!uri.startsWith('file://') && !uri.startsWith('/')) return null;
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
}

/**
 * Generate today's diary entry for the cat. Returns a structured
 * DiaryEntry. Throws on AI errors — caller should catch and show a
 * graceful fallback ("Couldn't write today's entry — tap to retry").
 *
 * Vision: when the cat has a profile photo, we attach it to the LLM
 * call so the entry can reference what the cat actually looks like /
 * what they're doing in the photo. Best-effort — if base64 conversion
 * fails, we fall through to text-only generation.
 */
export async function generateDiaryEntry(opts: {
  cat: CatProfile;
  context: DiaryDayContext;
  archetype: PersonalityArchetype | null;
}): Promise<DiaryEntry> {
  const { cat, context, archetype } = opts;

  const ageYears = resolveCatAgeYears(cat);
  const catAge =
    ageYears == null
      ? 'unknown age'
      : ageYears < 1
        ? 'a kitten'
        : ageYears === 1
          ? '1 year old'
          : `${ageYears} years old`;

  // Derive the cat's body self-image. We only have today's BCS in
  // DiaryDayContext (when logged today); the body-self block degrades
  // gracefully to weight-vs-breed-range when BCS is absent. No need
  // to plumb the whole historical weight log here — diary doesn't
  // need it for tone, only for the felt-sense layer.
  const bodySelf = deriveBodySelf(
    {
      name: cat.name,
      breed: cat.breed ?? null,
      ageMonths: resolveCatAgeMonths(cat),
      weightKg: cat.weight_kg,
    },
    context.weight?.bcs ?? null,
  );

  // Resolve today's mood for diary tone (added 2026-05-13). Uses the
  // SAME picker as chat — archetype × today-behavior × user-feedback
  // weighted — so the diary entry tonally matches the day's chat
  // register. The check-in mood comes from today's context; "off"
  // days route to the dark pool. Recent medical concern routing is
  // left to the caller of chat (diary doesn't have that signal in
  // DiaryDayContext yet) — diary tone tracks the daily check-in only
  // for now. Acceptable: scans that flagged urgent will already have
  // made today's check-in feel "off" in most cases.
  const archetypeMod = buildArchetypeMod(archetype);
  const checkinForMood: 'happy' | 'normal' | 'off' | null =
    context.checkin?.mood === 'happy' ||
    context.checkin?.mood === 'normal' ||
    context.checkin?.mood === 'off'
      ? context.checkin.mood
      : null;
  // Today's behavior tags come from DiaryDayContext.behaviorObs,
  // flattened from the day's Read Cat sessions.
  const todayTags = (context.behaviorObs ?? [])
    .flatMap((obs) => obs.tags ?? [])
    .filter((t): t is string => typeof t === 'string' && t.length > 0);
  const todayMod = buildTodayBehaviorMod({
    todayTags,
    checkinMood: checkinForMood,
    ageMonths: resolveCatAgeMonths(cat) ?? null,
  });
  const feedbackTable = useMoodFeedbackStore.getState().getFeedback(cat.id);
  const feedbackMod = computeFeedbackMod(feedbackTable);
  const todayMood = resolveTodaysMood({
    catId: cat.id,
    dateKey: moodLocalDateKey(),
    checkinMood: checkinForMood,
    hasRecentMedicalConcern: false,
    archetypeMod,
    todayMod,
    feedbackMod,
  });
  // Record exposure (idempotent per cat/mood/date). Diary generation
  // can happen multiple times per day if the user pulls-to-refresh —
  // the store dedupes. Also fire telemetry so PostHog can validate the
  // algorithm vs reality.
  try {
    useMoodFeedbackStore
      .getState()
      .recordExposure(cat.id, todayMood.id, moodLocalDateKey());
    void import('./analytics').then(({ track }) => {
      try {
        track({
          type: 'mood_exposed',
          props: {
            mood: todayMood.id,
            cluster: todayMood.cluster,
            archetype: archetype ?? null,
            voice_mode_tag: getVoiceModeTag(todayMood.id),
          },
        });
      } catch {
        // analytics failures must never break diary
      }
    });
  } catch {
    // never let store errors break diary generation
  }
  const moodBlock = renderMoodForPrompt(todayMood);

  const system = buildSystemPrompt({
    catName: cat.name,
    catBreed: cat.breed ?? null,
    catAge,
    catSex: cat.sex,
    archetype,
    bodySelfDirective: bodySelf?.toneDirective ?? null,
    moodBlock,
  });
  const user = buildUserPrompt(context);

  // Best-effort photo attachment for vision. Profile photo first.
  // Could be extended later to attach today's symptom-photo or scan
  // images, but those are clinical — Diary stays warm.
  const photoBase64 = await fileUriToBase64(context.photoUri);

  type LlmResult = { entry: string; mood_word: string };

  const result = await completeJson<LlmResult>({
    activity: 'diary_generation',
    system,
    user,
    temperature: 0.85, // higher than triage — we want voice variation per day
    maxTokens: 600,
    imageBase64: photoBase64,
    imageDetail: 'low', // low = ~$0.001/image, plenty for tonal reference
    jsonSchema: {
      name: 'cat_diary_entry',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['entry', 'mood_word'],
        properties: {
          entry: { type: 'string' },
          mood_word: { type: 'string' },
        },
      },
    },
  });

  return {
    cat_id: cat.id,
    date: localDateKey(new Date()),
    entry: result.entry.trim(),
    mood_word: result.mood_word.trim().toLowerCase(),
    generated_at: new Date().toISOString(),
    model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini',
    // Persist the photo URI used as vision context so the screen can
    // render the same image visually atop the entry. Anchors today's
    // diary to today's photo without requiring a separate gallery
    // lookup at display time (which could pick a different photo if
    // the user added more).
    ...(context.photoUri ? { photo_uri: context.photoUri } : {}),
  };
}

/** Date key helper for store cache keys. */
export function todayKey(): string {
  return localDateKey(new Date());
}

/**
 * Pick the punchiest single sentence from a diary entry — used as the
 * body of the cat-voice evening push. Goal: a Co-Star-shaped lock-
 * screen line the user wants to screenshot ("The pigeon was
 * unreasonable for thirty seconds.").
 *
 * Heuristic-only (no extra LLM call — the diary already paid for the
 * generation, this is free). Splits on sentence boundaries, scores
 * each on:
 *   + length sweet spot (30-100 chars reads well on a lock screen)
 *   + first-person assertion (starts with "I", "My", "We")
 *   + specificity (contains "the" / specific noun signals)
 *   - hedging vocabulary ("maybe", "I think", "seems", "perhaps")
 *   - conjunction-leading sentences ("And…", "But…")
 *   - boring openers ("Today" — the strategy doc bans this)
 *
 * Returns null if no acceptable sentence found (caller skips the push).
 *
 * See: marketing/chat-as-viral-lever.md §2 (Co-Star register: short,
 * declarative, lock-screen-shaped).
 */
export function pickCatVoiceHighlight(entry: DiaryEntry): string | null {
  if (!entry.entry || entry.entry.length < 10) return null;
  // Split on . ! ? but keep the punctuation. Trim & filter empties.
  const sentences = entry.entry
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);

  if (sentences.length === 0) return null;

  const HEDGES = [
    /\bmaybe\b/i,
    /\bperhaps\b/i,
    /\bi think\b/i,
    /\bseems?\b/i,
    /\bsort of\b/i,
    /\bkind of\b/i,
    /\bprobably\b/i,
  ];
  const BAD_OPENERS = [
    /^and\b/i,
    /^but\b/i,
    /^so\b/i,
    /^then\b/i,
    /^today[,.\s]/i,  // strategy doc bans "Today"-openers
    /^this morning/i,
    /^yesterday/i,
  ];

  function score(s: string): number {
    // Hard reject: action tokens. The diary should never emit these
    // today, but guarding here keeps the lock-screen text safe even if
    // a future prompt change leaks one through. We never want a push
    // notification body that reads "Vet now. [ACTION:CALL_VET]".
    if (/\[ACTION:/i.test(s)) return -1000;

    let n = 0;
    const len = s.length;
    // Length sweet spot: 40-90 chars peak. Penalty either side.
    if (len >= 30 && len <= 100) n += 6;
    else if (len > 100 && len <= 140) n += 2;
    else if (len < 30) n -= 2;
    else n -= 4; // > 140 — too long for lock screen

    if (/^(I|My|We)\b/.test(s)) n += 4;       // first-person assertive
    if (/\bthe\b/i.test(s)) n += 1;            // specificity hint
    if (/[.!?]$/.test(s)) n += 2;              // declarative ending
    if (BAD_OPENERS.some((re) => re.test(s))) n -= 5;
    if (HEDGES.some((re) => re.test(s))) n -= 3;
    // Avoid sentences that just describe the diary's own framing
    if (/\bdiary\b|\bjournal\b|\bentry\b/i.test(s)) n -= 4;
    return n;
  }

  let best = sentences[0]!;
  let bestScore = score(best);
  for (const s of sentences.slice(1)) {
    const sc = score(s);
    if (sc > bestScore) {
      best = s;
      bestScore = sc;
    }
  }
  // Reject if the winner is unusably long or just a hedge
  if (best.length > 140) return null;
  if (bestScore <= 0) return null;
  return best;
}

/**
 * Whether the cat had ANY material activity today worth writing about.
 *
 * The diary is now triggered only when something actually happened —
 * a check-in, a Read [cat] session, a weight log, a vet event, a
 * scan, or a medication dose. Empty days produce no entry. Diary
 * gets punctuated by real life rather than padded with hollow filler
 * for days the cat just slept on the same windowsill.
 *
 * Returns true if any of the trigger conditions match for today.
 */
export function hasMaterialToday(ctx: DiaryDayContext): boolean {
  if (ctx.checkin) return true;
  if (ctx.behaviorObs.length > 0) return true;
  if (ctx.weight) return true;
  if (ctx.medicationDoses.length > 0) return true;
  if (ctx.scans.length > 0) return true;
  if (ctx.symptomPhotosToday.length > 0) return true;
  if (ctx.litterBoxToday.length > 0) return true;
  if (ctx.chatThemesToday.length > 0) return true;
  if (ctx.outcomeChecksToday.length > 0) return true;
  if (ctx.isBirthday || ctx.isAdoptionIversary) return true;
  if (ctx.streakMilestone) return true;
  if (ctx.specialDay) return true;
  if (ctx.recentEmergencyScan) return true;
  // 2026-05-14 audit fixes:
  // - Meow translations today are voice events worth narrating
  //   ("I yowled at them twice today.")
  // - World-extracted scene captions are GROUNDED observations — a
  //   real noticed-today moment, distinct from a raw photoUri which
  //   is still excluded as too-thin signal.
  if (ctx.meowTranslationsToday && ctx.meowTranslationsToday.length > 0) return true;
  if (ctx.todayScenes && ctx.todayScenes.length > 0) return true;
  // Water (audit 2026-05-14 round 6) — ABNORMAL only. The diary is
  // not a hydration spreadsheet; normal water doesn't deserve an
  // entry on its own. Low / high vs the cat's own 7-day baseline =
  // an embodied "felt different today" moment worth narrating.
  if (
    ctx.waterIntakeToday &&
    (ctx.waterIntakeToday.direction === 'low' ||
      ctx.waterIntakeToday.direction === 'high')
  ) {
    return true;
  }
  // Note: photoUri alone is NOT material — a photo without any other
  // signal (no extraction yet, no tags) isn't a day worth narrating.
  return false;
}

// ---------------------------------------------------------------------------
// Conscious-cat: deep-context prompt builder
// ---------------------------------------------------------------------------
//
// The "conscious cat" diary weaves three memory tiers into a single
// rich prompt:
//
//   1. RECENT (Tier 1) — last 14 days of summaries + mood arc
//      + recurring entities. Lets the cat-voice say "three calm days
//      in a row" / "the rug and I have been at peace for three days".
//
//   2. LANDMARKS (Tier 2) — past sicknesses, recoveries, first-evers,
//      birthdays-already-passed. Lets the cat say "two weeks since I
//      was unwell — I feel sturdier now."
//
//   3. ANTICIPATION (Tier 3) — upcoming birthday / vet visit /
//      anniversary within 7 days. Lets the cat say "I sense
//      something coming."
//
// Plus chat continuity ("they keep asking about my appetite"),
// seasonal hints ("the windowsill is colder than usual"), and
// empty-day support (1-2 sentence melancholic vignette when nothing
// happened, with absence-theme rotation).
//
// Personality archetype carries through both populated + empty days —
// the cat-voice register stays consistent across all entry types.

/**
 * Compact stringification of recent entries for the prompt. We don't
 * dump full text — just date + mood-word + first-sentence summary.
 * Cap at 8 entries so the prompt doesn't bloat.
 */
function formatRecentEntries(entries: RecentEntry[]): string {
  if (entries.length === 0) return '';
  const cap = entries.slice(0, 8);
  const lines = cap.map((e) => `  - ${e.date} (${e.moodWord}): "${e.summary}"`);
  return `\nWHAT YOU REMEMBER FROM RECENT DAYS (newest first; reference at most one or two if natural — never list, never recap mechanically):\n${lines.join('\n')}`;
}

function formatMoodArc(arc: MoodArc): string {
  if (!arc.direction) return '';
  const directionPhrase: Record<NonNullable<MoodArc['direction']>, string> = {
    easing:
      'recent days have been TIGHTER and you are easing into something calmer',
    tightening:
      'recent days were STEADIER and something has shifted — you are more on edge today',
    steady:
      'days have been remarkably steady — note this with quiet recognition (cats notice when nothing changes)',
    oscillating:
      'recent days have swung — restless, then steady, then restless again',
  };
  const recent = arc.recentMoods.slice(0, 4).join(', ');
  return `\nMOOD ARC: ${directionPhrase[arc.direction]}. (Recent moods: ${recent}.)`;
}

function formatRecurringEntities(entities: string[]): string {
  if (entities.length === 0) return '';
  return `\nRECURRING CHARACTERS in your life (you have mentioned these before — return to one if natural, NEVER list them all): ${entities.join(', ')}.`;
}

function formatLifeEvents(events: LifeEvent[]): string {
  if (events.length === 0) return '';
  const cap = events.slice(0, 3);
  const lines = cap.map((e) => `  - ${e.label}`);
  return `\nLIFE LANDMARKS YOU COULD REMEMBER (reference at most ONE if today's mood or context naturally invokes it — do NOT mention all):\n${lines.join('\n')}`;
}

function formatAnticipations(events: AnticipationEvent[]): string {
  if (events.length === 0) return '';
  const cap = events.slice(0, 2);
  const lines = cap.map((e) => `  - ${e.label}`);
  return `\nWHAT'S COMING (within the next week — reference ONE if it shapes today's mood; you sense something is coming, you don't have a calendar):\n${lines.join('\n')}`;
}

function formatChatContinuity(themes: string[]): string {
  if (themes.length === 0) return '';
  return `\nWHAT THE HUMAN HAS BEEN WORRYING ABOUT (asked across multiple recent days — you have noticed; reference ONE gently, not snarkily): ${themes.join(', ')}.`;
}

function formatSeasonal(s: SeasonalContext): string {
  return `\nSEASON: it is ${s.month} (${s.season}). Background atmosphere: ${s.hint}. Use as soft inspiration, not as fact — only weave in if it shapes a sentence naturally.`;
}

/**
 * Format the present-today subjects so the LLM can mention them by
 * name in the entry. These are people / pets the user explicitly
 * tagged in TODAY's photos — the cat literally saw them today.
 */
function formatSubjectsToday(subjects: SubjectMemory[]): string {
  if (subjects.length === 0) return '';
  const lines = subjects.map((s) => {
    const desc = s.descriptor ? ` (${s.descriptor})` : '';
    const vibe = s.vibe ? ` Vibe: ${s.vibe}` : '';
    const freq =
      s.appearances === 1
        ? 'first time tagged'
        : `${s.appearances} appearances total`;
    return `  - ${s.name}${desc} — ${freq}.${vibe}`;
  });
  return `\nWHO IS WITH YOU TODAY (named by your human in today's photos — refer to them by name where natural; don't list, weave):\n${lines.join('\n')}`;
}

/**
 * Format the recurring-but-not-present subjects. Powerful for both
 * populated days ("Mom, the way she always does — but not today") and
 * empty days ("haven't seen Bella in three days"). The LLM picks one
 * if any.
 */
function formatRecurringSubjects(subjects: SubjectMemory[]): string {
  if (subjects.length === 0) return '';
  const lines = subjects.map((s) => {
    const desc = s.descriptor ? ` (${s.descriptor})` : '';
    const vibe = s.vibe ? ` Vibe: ${s.vibe}` : '';
    const since =
      s.daysSinceLastSeen === 0
        ? 'last seen today'
        : s.daysSinceLastSeen === 1
          ? 'last seen yesterday'
          : `last seen ${s.daysSinceLastSeen} days ago`;
    return `  - ${s.name}${desc} — ${s.appearances} appearances total, ${since}.${vibe}`;
  });
  return `\nRECURRING NAMES IN YOUR LIFE (people & pets your human regularly tags — refer to ONE by name if it shapes a sentence; never list them all; don't force it):\n${lines.join('\n')}`;
}

/**
 * Build the user-side of the prompt for a populated day, weaving in
 * all memory tiers. The system prompt (separate) already carries the
 * personality archetype voice; the user prompt focuses on context
 * the cat could narrate from.
 */
function buildDeepUserPrompt(deep: DeepDiaryContext): string {
  const ctx = deep.dayContext;
  const lines: string[] = [];

  // --- DAY HEADER ---
  if (deep.isToday) {
    lines.push(`Today is ${ctx.weekday}.`);
  } else {
    lines.push(`The date is ${deep.date} (${ctx.weekday}). You are writing about that day specifically — you may use simple past or present tense as feels natural for a cat looking back at recent days.`);
  }

  // --- TODAY'S DATA (existing logic, unchanged) ---
  if (ctx.checkin) {
    const bits: string[] = [];
    if (ctx.checkin.mood) bits.push(`mood ${ctx.checkin.mood}`);
    if (ctx.checkin.appetite) bits.push(`appetite ${ctx.checkin.appetite}`);
    if (ctx.checkin.litter) bits.push(`litter ${ctx.checkin.litter}`);
    if (bits.length > 0) {
      lines.push(`Owner's daily check-in: ${bits.join(', ')}.`);
    }
    if (ctx.checkin.notes) {
      lines.push(`Owner's note for the day: "${ctx.checkin.notes}".`);
    }
  }

  if (ctx.behaviorObs.length > 0) {
    lines.push(`Body-language observation${ctx.behaviorObs.length > 1 ? 's' : ''} from a Read session today:`);
    for (const obs of ctx.behaviorObs) {
      const tagText = obs.tags.length > 0 ? ` (tags: ${obs.tags.join(', ')})` : '';
      lines.push(`  - "${obs.observation}"${tagText}`);
    }
  }

  if (ctx.weight) {
    lines.push(`Owner weighed you today: ${ctx.weight.weight_kg} kg${ctx.weight.bcs ? ` (BCS ${ctx.weight.bcs}/9)` : ''}.`);
  }

  // 30-day weight trend (audit 2026-05-14 round 6). Diary should NOT
  // narrate a stable body — that's a spreadsheet, not a cat. Only
  // surface direction shifts AND only when the absolute change is
  // meaningful (>5% of starting weight, ~200g for a 4kg cat).
  if (deep.weightTrend30d && deep.weightTrend30d.direction !== 'stable') {
    const t = deep.weightTrend30d;
    const pctChange = t.fromKg > 0 ? Math.abs(t.deltaKg / t.fromKg) : 0;
    if (pctChange >= 0.05) {
      const directionWord = t.direction === 'up' ? 'gained' : 'lost';
      const grams = Math.round(Math.abs(t.deltaKg) * 1000);
      lines.push(
        `Body drift (last 30 days): you have ${directionWord} about ${grams}g (${t.fromKg.toFixed(1)} kg → ${t.toKg.toFixed(1)} kg). You may notice this in an EMBODIED way ONCE if the entry naturally invites it — never as a number, never as a list. "The stairs are longer this week" / "I feel lighter" lands; "my weight has changed by 300g" does not.`,
      );
    }
  }

  // Water intake (audit 2026-05-14 round 6). Strict gate: only
  // mention when today is meaningfully OFF the cat's own 7-day
  // baseline. Normal water = silence. Embodied wording only — never
  // numerical, never "ml". The cat NOTICES emptier/fuller bowl, not
  // a hydration metric.
  if (ctx.waterIntakeToday && ctx.waterIntakeToday.direction === 'low') {
    lines.push(
      `Water signal today: less than your usual. You may say something embodied if the entry invites it ("the bowl is still full — strange") — never name a number, never apologise.`,
    );
  } else if (ctx.waterIntakeToday && ctx.waterIntakeToday.direction === 'high') {
    lines.push(
      `Water signal today: more than your usual. Restrained mention only ("the bowl emptied faster", "I was thirstier") if it fits. Never name a number.`,
    );
  }

  if (ctx.medicationDoses.length > 0) {
    const meds = ctx.medicationDoses.map((m) => m.medication).join(', ');
    lines.push(`Medication given today: ${meds}.`);
  }

  if (ctx.scans.length > 0) {
    const scanLine = ctx.scans
      .map((s) => `${s.urgency}: ${s.headline}`)
      .join('; ');
    lines.push(`AI triage scan run today: ${scanLine}.`);
  }

  if (ctx.symptomPhotosToday.length > 0) {
    const labels = Array.from(
      new Set(ctx.symptomPhotosToday.map((s) => s.concern_label)),
    ).slice(0, 3);
    lines.push(
      `Owner photographed your ${labels.join(', ')} today (close-up — they were inspecting).`,
    );
  }

  // Meow translations today (audit 2026-05-14 P1 #2). Reference the
  // vocalisation register the cat used, NOT the LLM's translation
  // text (that would be self-quotation). Compact one-liner.
  if (ctx.meowTranslationsToday && ctx.meowTranslationsToday.length > 0) {
    const intentCounts: Record<string, number> = {};
    for (const m of ctx.meowTranslationsToday) {
      intentCounts[m.intent] = (intentCounts[m.intent] ?? 0) + 1;
    }
    const intentPhrases = Object.entries(intentCounts)
      .map(([intent, n]) => (n > 1 ? `${intent} (×${n})` : intent))
      .join(', ');
    lines.push(
      `Voice activity today: you vocalised — intents recorded: ${intentPhrases}. You may reference your own voice ("I told them about the bowl twice today") in restrained terms — never quote the AI's translation back at the human.`,
    );
  }

  // Today's noticed-scene captions from world extraction (audit
  // 2026-05-14 P1 #3). Real grounded items the world layer pulled
  // from today's photos. The cat may reference one specifically —
  // never invent and never list them all.
  if (ctx.todayScenes && ctx.todayScenes.length > 0) {
    for (const scene of ctx.todayScenes.slice(0, 2)) {
      lines.push(`Noticed today (from your photos): ${scene.caption}`);
    }
  }

  if (ctx.litterBoxToday.length > 0) {
    const abnormalCount = ctx.litterBoxToday.filter((l) => l.abnormal).length;
    if (abnormalCount > 0) {
      lines.push(
        `Litter-box note: ${abnormalCount} of ${ctx.litterBoxToday.length} entries flagged as unusual today. Comment with restrained dignity if at all.`,
      );
    }
  }

  if (ctx.chatThemesToday.length > 0) {
    lines.push(`The human asked about these things today (reference obliquely as "they kept asking..." or similar):`);
    for (const theme of ctx.chatThemesToday) {
      lines.push(`  - "${theme}"`);
    }
  }

  if (ctx.outcomeChecksToday.length > 0) {
    const oc = ctx.outcomeChecksToday[0]!;
    if (oc.direction === 'better') {
      lines.push(`Outcome update: after a recent vet/scan moment, the human reported you are doing BETTER. Acknowledge it warmly without making a fuss.`);
    } else if (oc.direction === 'worse') {
      lines.push(`Outcome update: after a recent vet/scan moment, the human reported things are WORSE. Quiet awareness only — never melodrama.`);
    } else {
      lines.push(`Outcome update: after a recent vet/scan moment, the human reported things are about the SAME. You have noticed.`);
    }
  }

  if (ctx.streakDays > 0) {
    lines.push(`Owner has logged daily check-ins ${ctx.streakDays} days in a row.`);
  }

  if (ctx.isBirthday) {
    lines.push(`TODAY IS YOUR BIRTHDAY. Acknowledge with restrained satisfaction — you are not surprised, you have always known.`);
  }
  if (ctx.isAdoptionIversary) {
    lines.push(`TODAY IS THE ANNIVERSARY OF THE DAY YOU JOINED THIS HOUSEHOLD. Reflect briefly, on your own terms.`);
  }

  if (ctx.streakMilestone) {
    lines.push(
      `STREAK MILESTONE: ${ctx.streakMilestone} consecutive daily check-ins. Acknowledge without sentiment — they are doing what they should.`,
    );
  }

  if (ctx.recentEmergencyScan) {
    lines.push(
      `RECENT VET MOMENT: emergency-tier scan in the last 36 hours. Acknowledge their concern warmly. Do not dwell. You are well now.`,
    );
  }

  if (ctx.specialDay) {
    const specialPrompt: Record<NonNullable<DiaryDayContext['specialDay']>, string> = {
      new_year:
        "It is New Year's Day. Note it briefly if your household marked it (loud night, change in routine). Do not invent celebrations that did not happen.",
      valentines:
        "It is Valentine's Day. Comment with restraint if signs of it appear in the household; otherwise treat it as an ordinary day.",
      christmas:
        'It is Christmas Day. If your household celebrates it (tree, gifts, louder than usual), you may have opinions. If not, treat it as an ordinary day — do not fabricate trees, gifts, or carols.',
      halloween:
        'It is Halloween. If today\'s photos or diary show costumes / visitors / decorations, you may have opinions. Otherwise treat it as an ordinary day — do not invent trick-or-treaters or doorbell incidents.',
      spring_equinox:
        'It is the first day of spring. The light is changing. You have noticed.',
      summer_solstice:
        'It is the longest day of the year. The light is at its longest. You feel it.',
      autumn_equinox:
        'It is the first day of autumn. The light is leaving. You feel it before the humans do.',
      winter_solstice:
        'It is the shortest day of the year. The light has retreated. You feel it.',
      first_snow_likely:
        'It may snow soon (in the northern hemisphere). The window has changed. You have the best view in the household.',
    };
    // Climate-neutral hint texts (post 2026-05-07 voice fix) — see
    // earlier specialPrompt block in this file for context.
    lines.push(`SPECIAL DAY: ${specialPrompt[ctx.specialDay]}`);
  }

  // --- MEMORY TIERS (NEW) ---
  lines.push(formatRecentEntries(deep.recentEntries));
  lines.push(formatMoodArc(deep.moodArc));
  lines.push(formatRecurringEntities(deep.recurringEntities));
  lines.push(formatLifeEvents(deep.lifeEvents));
  lines.push(formatAnticipations(deep.upcomingEvents));
  lines.push(formatChatContinuity(deep.recurringChatThemes));
  lines.push(formatSeasonal(deep.seasonalContext));
  lines.push(formatSubjectsToday(deep.subjectsToday));
  lines.push(formatRecurringSubjects(deep.recurringSubjects));
  // Becoming milestone — restrained, fires at most once per stage
  // crossing. The store has already filtered consumed milestones by
  // the time it reaches the prompt.
  if (deep.becomingMilestone) {
    lines.push(
      `\nIDENTITY MILESTONE today (acknowledge ONCE, restrained, never effusive — your own becoming is something you observe, not celebrate): "${deep.becomingMilestone.diaryHook}"`,
    );
  }
  // Self-facts — durable things the human has told the cat about
  // itself. Reference at most ONE if it shapes a sentence; do not
  // list them.
  if (deep.selfFacts.length > 0) {
    const top = deep.selfFacts.slice(0, 6);
    const lines2 = top.map((f) => `  - ${f.fact}`);
    lines.push(
      `\nTHINGS YOU KNOW ABOUT YOURSELF (your human has told you these — you may invoke ONE if it shapes the entry; never list):\n${lines2.join('\n')}`,
    );
  }

  // YOUR WORLD — real items the cat actually has (audit 2026-05-14
  // P1 #1). Same registry chat uses. Mention by name when the entry
  // naturally needs an object — NEVER invent a household prop. If
  // empty, the diary stays grounded by leaning on body, time, and
  // the human's behaviour instead.
  if (deep.worldEntries && deep.worldEntries.length > 0) {
    const lines3 = deep.worldEntries.slice(0, 10).map((e) => {
      const loc = e.location ? ` (${e.location})` : '';
      const sent = e.sentiment ? ` [${e.sentiment}]` : '';
      return `  - ${e.kind}: ${e.name}${loc}${sent}`;
    });
    lines.push(
      `\nYOUR WORLD (real items in your life — use a name from THIS list when an object appears, never invent. If nothing here fits, lean on body / time / human's behaviour instead):\n${lines3.join('\n')}`,
    );
  }

  // Live weather (audit 2026-05-14 P2 #6). Mirrors chat's anti-
  // hallucination climate directive — without this, a Singapore
  // user's entries could invoke radiators and snow that don't
  // exist in their home. Compact one-liner; the model uses it as
  // a tonal anchor not a topic.
  if (deep.weatherNarrative) {
    lines.push(
      `\nTODAY'S WEATHER (real, grounded — use as climate texture, never invent the opposite): ${deep.weatherNarrative}`,
    );
  }

  lines.push(``);
  lines.push(
    `Write the diary entry for ${deep.isToday ? 'today' : deep.date}. JSON only. If your entry naturally references a specific past day from the recent-memory list above, include its date in the "referenced_past_date" field; otherwise leave that field null.`,
  );

  return lines.filter((l) => l !== '').join('\n');
}

// ---------------------------------------------------------------------------
// Empty-day prompt + generator
// ---------------------------------------------------------------------------

const EMPTY_DAY_SYSTEM_PROMPT = `You are a cat writing a very short diary entry for a day when the human did not interact with you. You are too dignified to whine, but you notice absence. The household was quieter today.

VOICE RULES (these are non-negotiable — they ARE the brand):
- Aristocratic-melancholic. Observant. Slightly wistful but never self-pitying.
- 1-2 sentences MAX. Short. Restrained.
- NEVER baby-talk. NEVER "uwu". NEVER "i miss you so much" saccharine. NEVER guilt-trip the human. NEVER demand attention.
- Acceptable registers: dignified observation, dry remark on the silence, a brief reflection on something that didn't happen, a single image that captures the day's stillness.
- Forbidden: melodrama, neediness, manipulation, sentimentality, anything that begs for sympathy.

INTENSITY (calibrate by days-since-last-active):
- 1 day quiet → mild observation, almost neutral. ("The day passed quietly. The chair held the shape of a person who didn't sit in it.")
- 2-3 days → first hint of longing, but proud. ("Three days now. I am a cat. I find my own day.")
- 4-7 days → genuine, dignified ache. ("The water bowl was still by morning. I drank anyway.")
- 8+ days → quiet melancholy mixed with proud independence. ("I have adapted. Some things one does not get used to.")

OUTPUT: A JSON object with two fields:
  - "entry": 1-2 sentences, no more
  - "mood_word": one single word (e.g. "wistful", "still", "patient", "quiet", "withdrawn", "reflective")`;

function buildEmptyDaySystemPrompt(opts: {
  catName: string;
  catSex: 'male' | 'female' | 'unknown' | null;
  archetype: PersonalityArchetype | null;
}): string {
  const { catName, catSex, archetype } = opts;
  const archetypeLine = archetype
    ? `\n\nYOUR PERSONALITY: ${ARCHETYPE_META[archetype].name}. ${ARCHETYPE_VOICE[archetype]}\n\nEMPTY-DAY VOICE FOR YOUR ARCHETYPE: ${ARCHETYPE_EMPTY_DAY_VOICE[archetype]}`
    : '';
  const pronounLine = `\n\nPRONOUNS: ${getPronounDirective(catName, catSex)}`;
  return `${EMPTY_DAY_SYSTEM_PROMPT}\n\nYOU: Your name is ${catName}.${archetypeLine}${pronounLine}`;
}

/** Per-archetype hints for empty-day entries — what each archetype misses most. */
const ARCHETYPE_EMPTY_DAY_VOICE: Record<PersonalityArchetype, string> = {
  confident_sociable:
    "You miss being noticed. The room without an audience feels smaller. Lean into stillness as a kind of dignified protest.",
  curious_introvert:
    "Quiet days suit you in part — but even you notice the lack of interesting small disturbances. Note one missing detail.",
  anxious_sensitive:
    "Gaps in routine register sharply for you. Note ONE specific small thing that didn't happen — you keep close track.",
  hunter_athlete:
    "You miss the play. The unmoving toy. The string that did not appear. Reference movement that didn't come.",
  affectionate_lap:
    "You miss the warmth of a sat-with body. Reference the shape of the chair, the cushion, the absence of a leg.",
  velcro_cat:
    "You are a tracker of your human's whereabouts. The absence is concrete — a missing footstep, a quiet door, a space where they should be.",
  skittish_sensitive:
    "Quiet might be a relief on the surface, but you still keep watch. Note the watching, the alertness with no reward.",
  cool_observer:
    "Silence flatters you, but even you observe the lack of stimuli. One dry, measured remark on what didn't happen.",
  goofball_playful:
    "You miss the small disorders. The thing-that-could-be-knocked-over. The ankle to weave around. Note the dullness with light irony.",
};

/** Compact summary of the cat's situation for the empty-day user prompt. */
function buildEmptyDayUserPrompt(deep: DeepDiaryContext): string {
  const lines: string[] = [];
  lines.push(`The date is ${deep.date} (${deep.dayContext.weekday}).`);
  lines.push(
    `Days since the human last interacted with you: ${deep.daysSinceLastActive === Number.POSITIVE_INFINITY ? 'many' : deep.daysSinceLastActive}.`,
  );
  if (deep.absenceTheme) {
    lines.push(
      `ABSENCE THEME for this entry (use as a seed image — weave it into ONE sentence; do not list it): ${deep.absenceTheme}.`,
    );
  }
  if (deep.lastPopulatedEntry) {
    lines.push(
      `The most recent populated day was ${deep.lastPopulatedEntry.date} ("${deep.lastPopulatedEntry.summary}"). You may obliquely reference that day if it makes the silence feel more real (e.g., "since [event], the days have all looked the same"). Optional.`,
    );
  }
  // Recurring entities — empty days can reference them too (the unmoved rug, the empty windowsill).
  if (deep.recurringEntities.length > 0) {
    lines.push(
      `RECURRING CHARACTERS in your life that may appear in absence: ${deep.recurringEntities.join(', ')}.`,
    );
  }
  // Recurring NAMED subjects (people & pets the human has tagged in
  // photos). On empty days these are powerful — "haven't seen Bella
  // in five days" or "Mom hasn't sat in the chair since Sunday."
  if (deep.recurringSubjects.length > 0) {
    const lines2 = deep.recurringSubjects.slice(0, 4).map((s) => {
      const desc = s.descriptor ? ` (${s.descriptor})` : '';
      const since =
        s.daysSinceLastSeen === 0
          ? 'today'
          : s.daysSinceLastSeen === 1
            ? 'yesterday'
            : `${s.daysSinceLastSeen} days ago`;
      return `  - ${s.name}${desc} — last seen ${since}`;
    });
    lines.push(
      `NAMED PEOPLE & PETS in your life (you may invoke ONE by name to deepen the silence — "${deep.recurringSubjects[0]!.name} hasn't been here in days" — but only if it makes the entry land harder; do not list):\n${lines2.join('\n')}`,
    );
  }
  // Anticipation can shade an empty day with quiet expectation.
  if (deep.upcomingEvents.length > 0) {
    lines.push(
      `WHAT'S COMING (you may sense it without naming it): ${deep.upcomingEvents.map((e) => e.label).join('; ')}.`,
    );
  }
  // Seasonal mood-shading.
  lines.push(
    `Season hint: ${deep.seasonalContext.season}, ${deep.seasonalContext.month}. ${deep.seasonalContext.hint}`,
  );
  // Becoming milestone — even on empty days, a stage crossing can
  // be acknowledged. Pairs especially well with the silence: the
  // cat is becoming itself in the absence of contact.
  if (deep.becomingMilestone) {
    lines.push(
      `IDENTITY MILESTONE today (you may incorporate this seed into the entry, restrained, dignified — never melodramatic): "${deep.becomingMilestone.diaryHook}"`,
    );
  }
  // Self-facts — even on empty days, a remembered self-truth can
  // anchor the silence: "the tuna sat unopened in the drawer."
  if (deep.selfFacts.length > 0) {
    const top = deep.selfFacts.slice(0, 4).map((f) => `  - ${f.fact}`);
    lines.push(
      `THINGS YOU KNOW ABOUT YOURSELF (you may invoke ONE if it deepens the silence — never list):\n${top.join('\n')}`,
    );
  }
  lines.push(``);
  lines.push(
    `Write the empty-day diary entry. 1-2 sentences. JSON only. Set "referenced_past_date" to the lastPopulatedEntry's date if you naturally reference it; null otherwise.`,
  );
  return lines.join('\n');
}

/**
 * Generate an empty-day entry. Short, melancholic-aristocratic, 1-2
 * sentences. Caller has already determined this is an empty day AND
 * the cat has accumulated enough activity-history for empty-day
 * entries to feel earned (`isReadyForEmptyDayEntries`).
 */
export async function generateEmptyDayEntry(opts: {
  cat: CatProfile;
  deep: DeepDiaryContext;
  archetype: PersonalityArchetype | null;
}): Promise<DiaryEntry> {
  const { cat, deep, archetype } = opts;
  const system = buildEmptyDaySystemPrompt({ catName: cat.name, catSex: cat.sex, archetype });
  const user = buildEmptyDayUserPrompt(deep);

  type LlmResult = { entry: string; mood_word: string; referenced_past_date: string | null };

  const result = await completeJson<LlmResult>({
    activity: 'diary_generation',
    system,
    user,
    temperature: 0.85,
    maxTokens: 120, // empty days are SHORT
    jsonSchema: {
      name: 'cat_empty_day_diary_entry',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['entry', 'mood_word', 'referenced_past_date'],
        properties: {
          entry: { type: 'string' },
          mood_word: { type: 'string' },
          referenced_past_date: { type: ['string', 'null'] },
        },
      },
    },
  });

  return {
    cat_id: cat.id,
    date: deep.date,
    entry: result.entry.trim(),
    mood_word: result.mood_word.trim().toLowerCase(),
    generated_at: new Date().toISOString(),
    model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini',
    is_empty_day: true,
    empty_day_theme: deep.absenceTheme ?? null,
    referenced_past_date: result.referenced_past_date ?? null,
    // Empty days don't have a today-photo anchor; preserve null.
    photo_uri: null,
  };
}

/**
 * Generate a populated-day entry using the rich deep-context. Used by
 * both today's generation and backfilled past-day generation.
 */
export async function generateDeepDiaryEntry(opts: {
  cat: CatProfile;
  deep: DeepDiaryContext;
  archetype: PersonalityArchetype | null;
}): Promise<DiaryEntry> {
  const { cat, deep, archetype } = opts;

  const ageYears = resolveCatAgeYears(cat);
  const catAge =
    ageYears == null
      ? 'unknown age'
      : ageYears < 1
        ? 'a kitten'
        : ageYears === 1
          ? '1 year old'
          : `${ageYears} years old`;

  // Same body-self derivation as the lighter generateDiaryEntry path.
  // Uses today's BCS when logged; falls back to weight-vs-breed-range
  // (handled inside deriveBodySelf) when BCS isn't current.
  const bodySelf = deriveBodySelf(
    {
      name: cat.name,
      breed: cat.breed ?? null,
      ageMonths: resolveCatAgeMonths(cat),
      weightKg: cat.weight_kg,
    },
    deep.dayContext.weight?.bcs ?? null,
  );

  // Daily mood plumbing (2026-05-14) — the DEEP diary path is the
  // active one called by diaryStore. Resolves today's mood using the
  // same 4-layer formula as chat + postcard (archetype × today's
  // behavior × user feedback) so the diary entry tonally matches the
  // chat register. Earlier work plumbed mood only into the shallow
  // `generateDiaryEntry` which is no longer called — that path's
  // mood code was effectively dead until this wiring landed.
  const archetypeMod = buildArchetypeMod(archetype);
  const checkinForMood: 'happy' | 'normal' | 'off' | null =
    deep.dayContext.checkin?.mood === 'happy' ||
    deep.dayContext.checkin?.mood === 'normal' ||
    deep.dayContext.checkin?.mood === 'off'
      ? deep.dayContext.checkin.mood
      : null;
  const todayTagsDeep = (deep.dayContext.behaviorObs ?? [])
    .flatMap((obs) => obs.tags ?? [])
    .filter((t): t is string => typeof t === 'string' && t.length > 0);
  // Same-day medical concern routing (2026-05-14 audit fix #P1.3):
  // if today's scan flagged 'urgent' or 'concern', force the mood
  // lottery into the dark pool so the diary doesn't pick a playful
  // register on a medically serious day even when the check-in
  // wasn't logged as "off". Mirrors the chat path's recent-medical
  // override.
  // Audit 2026-05-14 round 9: include 'emergency' too. The wider
  // codebase uses urgency='emergency' for the highest tier; pre-fix
  // an emergency scan on a backfill day failed to force the dark mood
  // pool, so the diary could read playful on a medically grave day.
  const hasMedicalConcernThisDay = (deep.dayContext.scans ?? []).some(
    (s) =>
      s.urgency === 'emergency' ||
      s.urgency === 'urgent' ||
      s.urgency === 'concern',
  );
  // Live mood signals (audit 2026-05-14 architectural expansion).
  // DeepDiaryContext already carries weather (weatherNarrative is
  // human-readable; we re-fetch the raw snapshot for weatherCode +
  // apparent_c here) and today's meow translations + checkin payload.
  // Pain comes from healthStore.
  const liveSignalsDeep: Parameters<typeof buildTodayBehaviorMod>[0] = {
    todayTags: todayTagsDeep,
    checkinMood: checkinForMood,
    ageMonths: resolveCatAgeMonths(cat) ?? null,
  };
  // Meow intents from today
  const meowIntentsDeep = (deep.dayContext.meowTranslationsToday ?? [])
    .map((m) => m.intent)
    .filter((i): i is string => !!i);
  if (meowIntentsDeep.length > 0) liveSignalsDeep.meowIntents = meowIntentsDeep;
  // Appetite + litter from check-in
  if (
    deep.dayContext.checkin?.appetite === 'partial' ||
    deep.dayContext.checkin?.appetite === 'none'
  ) {
    liveSignalsDeep.hasAppetiteOff = true;
  }
  if (deep.dayContext.litterBoxToday.some((l) => l.abnormal)) {
    liveSignalsDeep.hasLitterAbnormal = true;
  }
  // Pain from health events
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useHealthStore } = require('../state/healthStore') as {
      useHealthStore: {
        getState: () => {
          events: Array<{ cat_id: string; type: string; ts: string; payload: unknown }>;
        };
      };
    };
    const events = useHealthStore.getState().events;
    const dayKey = deep.date;
    const painHit = events.some((e) => {
      if (e.cat_id !== cat.id) return false;
      if (e.type !== 'pain_score') return false;
      try {
        if (moodLocalDateKey(new Date(e.ts)) !== dayKey) return false;
      } catch {
        return false;
      }
      const p = e.payload as { composite?: number };
      return typeof p?.composite === 'number' && p.composite >= 4;
    });
    if (painHit) liveSignalsDeep.hasPainToday = true;
    // Water + weight body-trend signals (audit 2026-05-14 round 15).
    // Anchored to `deep.date` so backfill of e.g. May 5 uses that
    // day's own 7-day water baseline + 30-day weight window, not
    // today's. Pre-fix these signals only flowed through
    // `buildLiveMoodContext` (used by share attribution +
    // notifications); the generated diary voice never received them.
    const trends = computeBodyTrendSignals(events, cat.id, deep.date);
    if (trends.waterDirection != null) liveSignalsDeep.waterDirection = trends.waterDirection;
    if (trends.weightTrendDirection != null) liveSignalsDeep.weightTrendDirection = trends.weightTrendDirection;
  } catch {
    // ignore
  }
  // Weather code + apparent temp — ONLY for today's entry (audit
  // 2026-05-14 round 14). Pre-fix, weather signals were fed into the
  // mood lottery for ALL deep-diary generations including past-date
  // backfill — so backfilling May 5 on a rainy May 14 would still
  // pull the May 5 mood toward cozy/attuned. The diary's prose
  // already had the weather block gated on `deep.isToday`; the mood
  // picker was the last leak. Now: weather signals contribute to
  // the mood lottery only when we're writing today's entry.
  if (deep.isToday) {
    try {
      const { getWeatherSnapshot } = await import('./weatherContext');
      const snap = await getWeatherSnapshot();
      if (snap) {
        if (typeof snap.weather_code === 'number') liveSignalsDeep.weatherCode = snap.weather_code;
        if (typeof snap.apparent_c === 'number') liveSignalsDeep.apparentTempC = snap.apparent_c;
      }
    } catch {
      // skip weather signal
    }
  }
  const todayModDeep = buildTodayBehaviorMod(liveSignalsDeep);
  const feedbackTableDeep = useMoodFeedbackStore.getState().getFeedback(cat.id);
  const feedbackModDeep = computeFeedbackMod(feedbackTableDeep);
  // dateKey = deep.date (NOT today) so backfilled past entries get
  // that day's deterministic lottery seed instead of today's. Without
  // this, regenerating multiple historical entries in one session
  // would inherit today's mood and the archive would feel
  // homogenized (2026-05-14 audit fix #P1.2).
  const todayMoodDeep = resolveTodaysMood({
    catId: cat.id,
    dateKey: deep.date,
    checkinMood: checkinForMood,
    hasRecentMedicalConcern: hasMedicalConcernThisDay,
    archetypeMod,
    todayMod: todayModDeep,
    feedbackMod: feedbackModDeep,
  });
  // Record exposure + analytics fire — ONLY for today's entry.
  // Backfilled past-day generations are the user pulling from
  // history, not living through the day. Counting those as exposures
  // would let a 30-day backfill batch dump 30 unrelated exposures
  // into the adaptive lottery in one session, polluting the learning
  // signal. Idempotent per (cat, mood, date) at the store level
  // either way, but we gate at source to be precise.
  if (deep.isToday) {
    try {
      useMoodFeedbackStore
        .getState()
        .recordExposure(cat.id, todayMoodDeep.id, deep.date);
      void import('./analytics').then(({ track }) => {
        try {
          track({
            type: 'mood_exposed',
            props: {
              mood: todayMoodDeep.id,
              cluster: todayMoodDeep.cluster,
              archetype: archetype ?? null,
              voice_mode_tag: getVoiceModeTag(todayMoodDeep.id),
            },
          });
        } catch {
          // analytics failures must never break diary
        }
      });
    } catch {
      // never let store errors break diary generation
    }
  }
  const moodBlockDeep = renderMoodForPrompt(todayMoodDeep);

  const system = buildSystemPrompt({
    catName: cat.name,
    catBreed: cat.breed ?? null,
    catAge,
    catSex: cat.sex,
    archetype,
    bodySelfDirective: bodySelf?.toneDirective ?? null,
    moodBlock: moodBlockDeep,
  });
  const user = buildDeepUserPrompt(deep);

  const photoBase64 = await fileUriToBase64(deep.dayContext.photoUri);

  type LlmResult = {
    entry: string;
    mood_word: string;
    referenced_past_date: string | null;
    card_line: string;
  };

  // Append card_line directive to the user prompt — it must be a
  // standalone, screenshot-shaped quote distinct from the body. This
  // is what the Daily Card screen surfaces + what users share.
  // Rules baked into the prompt; voiceQuality gate enforces them
  // post-generation.
  const userWithCardDirective = `${user}

ALSO write \`card_line\`: ONE short, standalone, screenshot-worthy sentence in the cat's voice (8-18 words preferred). It must use only details that are TRUE according to today's context or known memory (above). It should feel affectionate / funny / wistful / proud / observant — matched to the day's mood. AVOID generic pet phrases ("today was special", "you make me happy"), AVOID explaining the day in a recap shape, AVOID inventing people / objects / places. The card_line stands alone outside the diary body.`;

  const result = await completeJson<LlmResult>({
    activity: 'diary_generation',
    system,
    user: userWithCardDirective,
    temperature: 0.85,
    maxTokens: 800, // bumped from 700 to accommodate card_line
    imageBase64: photoBase64,
    imageDetail: 'low',
    jsonSchema: {
      name: 'cat_diary_entry_deep',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['entry', 'mood_word', 'referenced_past_date', 'card_line'],
        properties: {
          entry: { type: 'string' },
          mood_word: { type: 'string' },
          referenced_past_date: { type: ['string', 'null'] },
          card_line: { type: 'string' },
        },
      },
    },
  });

  // Quality gate on card_line (audit 2026-05-14 round 7). The body
  // is too long to gate cleanly; the card_line is the shareable
  // surface and the one we MUST get right. Failure path:
  //   1. Regenerate JUST the card_line via a tiny prompt
  //   2. If retry fails, fall back to pickCatVoiceHighlight(entry)
  //   3. If THAT yields nothing, leave card_line undefined and let
  //      the UI fall back to body-highlight at render time.
  let cardLine = result.card_line?.trim() ?? '';
  try {
    const { evaluateCatVoiceLine, buildRetryDirective } = await import('./voiceQuality');
    const knownSubjects = [
      ...(deep.subjectsToday ?? []).map((s) => s.name),
      ...(deep.recurringSubjects ?? []).map((s) => s.name),
    ];
    const knownObjects = (deep.worldEntries ?? []).map((w) => w.name);
    const allowedFacts = (deep.selfFacts ?? []).map((f) => f.fact);
    const evalContext = {
      catName: cat.name,
      knownSubjects,
      knownObjects,
      allowedFacts,
      isMedicalContext: deep.dayContext.recentEmergencyScan,
      moodTag: result.mood_word?.toLowerCase(),
    };
    if (cardLine) {
      const evalResult = evaluateCatVoiceLine(cardLine, 'diary_card', evalContext);
      void import('./analytics').then(({ track }) => {
        try {
          track({
            type: 'voice_quality_eval',
            props: {
              surface: 'diary_card',
              score: evalResult.score,
              ok: evalResult.ok,
              reasons: evalResult.reasons.length,
            },
          });
        } catch {
          // analytics silent
        }
      });
      if (!evalResult.ok) {
        const retryDirective = buildRetryDirective(evalResult, 'diary_card');
        if (retryDirective) {
          try {
            const retryUser = `${userWithCardDirective}

YOUR PREVIOUS card_line:
"${cardLine}"

${retryDirective}

Return JSON with ONLY a single \`card_line\` field — the body, mood_word, and referenced_past_date stay unchanged.`;
            const retryResult = await completeJson<{ card_line: string }>({
              activity: 'diary_generation',
              system,
              user: retryUser,
              temperature: 0.75,
              maxTokens: 120,
              imageDetail: 'low',
              jsonSchema: {
                name: 'cat_diary_card_line_retry',
                strict: true,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['card_line'],
                  properties: { card_line: { type: 'string' } },
                },
              },
            });
            const retryCard = retryResult.card_line?.trim() ?? '';
            const retryEval = evaluateCatVoiceLine(
              retryCard,
              'diary_card',
              evalContext,
            );
            void import('./analytics').then(({ track }) => {
              try {
                track({
                  type: 'voice_quality_retried',
                  props: {
                    surface: 'diary_card',
                    original_score: evalResult.score,
                    repaired_score: retryEval.score,
                    recovered: retryEval.ok,
                  },
                });
              } catch {
                // silent
              }
            });
            if (retryEval.ok) {
              cardLine = retryCard;
            } else if (retryEval.repaired) {
              cardLine = retryEval.repaired;
              void import('./analytics').then(({ track }) => {
                try {
                  track({
                    type: 'voice_quality_fallback',
                    props: { surface: 'diary_card', kind: 'mechanical_repair' },
                  });
                } catch {
                  // silent
                }
              });
            } else {
              // Last resort: body-highlight fallback
              const highlight = pickCatVoiceHighlight({
                entry: result.entry,
                mood_word: result.mood_word,
              } as DiaryEntry);
              if (highlight) {
                cardLine = highlight;
                void import('./analytics').then(({ track }) => {
                  try {
                    track({
                      type: 'voice_quality_fallback',
                      props: { surface: 'diary_card', kind: 'body_highlight' },
                    });
                  } catch {
                    // silent
                  }
                });
              } else {
                cardLine = '';
              }
            }
          } catch (e) {
            console.warn('[Diary] card_line retry failed:', e);
            // Fall back to body highlight
            const highlight = pickCatVoiceHighlight({
              entry: result.entry,
              mood_word: result.mood_word,
            } as DiaryEntry);
            cardLine = highlight ?? '';
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Diary] card_line quality eval failed:', e);
    // Leave cardLine as-is — UI falls back to pickCatVoiceHighlight
  }

  return {
    cat_id: cat.id,
    date: deep.date,
    entry: result.entry.trim(),
    mood_word: result.mood_word.trim().toLowerCase(),
    generated_at: new Date().toISOString(),
    model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini',
    referenced_past_date: result.referenced_past_date ?? null,
    is_empty_day: false,
    ...(cardLine ? { card_line: cardLine } : {}),
    ...(deep.dayContext.photoUri ? { photo_uri: deep.dayContext.photoUri } : {}),
  };
}

// ---------------------------------------------------------------------------
// Deep-context aggregator
// ---------------------------------------------------------------------------

/**
 * Build the full deep context for a given date. Combines:
 *   - Existing day-context aggregator (today's data)
 *   - Memory tiers from `diaryMemory.ts`
 *   - Empty-day path (when the day has no material)
 *
 * Note: this builds context for ANY date — used by both today's
 * generation and backfill of past missed days. For past dates, the
 * day-context aggregator's `today` filter is replaced with a
 * date-specific filter via the `targetDate` parameter.
 */
export async function buildDeepContext(opts: {
  cat: CatProfile;
  events: HealthEvent[];
  scans: ScanRecord[];
  streakDays: number;
  galleryPhotosToday: Array<{ uri: string; added_at: string }>;
  chatTurnsToday: Array<{ role: 'user' | 'assistant'; content: string; created_at: string }>;
  /** All cached diary entries (any cat, any date) — module filters per-cat. */
  allCachedEntries: DiaryEntry[];
  /** Date this context is FOR. Defaults to today. */
  targetDate?: string;
  /** All gallery photo dates for this cat (any time) — used for empty-day floor + days-since-active. */
  allGalleryPhotoDates: string[];
  /**
   * Recent absence-theme strings used in past empty-day entries. Stored
   * on each entry as `empty_day_theme`. Passed here so the picker can
   * avoid back-to-back repeats. Optional.
   */
  recentAbsenceThemes?: string[];
  /**
   * Subject directory entries for this cat (everyone tagged across
   * the cat's photos). Passed in by the store so this service stays
   * decoupled from subjectDirectoryStore. Optional — when missing,
   * subjectsToday + recurringSubjects are empty arrays.
   */
  directoryEntries?: Array<{
    id: string;
    name: string;
    kind: 'person' | 'pet' | 'other';
    species?: string;
    relationship?: string;
    total_appearances: number;
    last_seen: string;
    appearances: Array<{ photo_id: string; date: string }>;
    vibe?: string;
    /**
     * ISO timestamp when the vibe field was last generated. Used by
     * `toSubjectMemory` to gate vibe inclusion on past-date backfill
     * (vibes written AFTER the target date reflect post-target
     * knowledge and would leak into the entry). Added 2026-05-14
     * round 12 audit fix.
     */
    vibe_updated_at?: string;
  }>;
  /**
   * Photo IDs captured today (for matching against directory
   * appearances to compute `subjectsToday`). When missing, the
   * matching falls back to last_seen >= today's dateKey.
   */
  todaysPhotoIds?: string[];
  /**
   * Optional becoming-milestone diary hook fired today. When non-
   * null, the cat may acknowledge its own deepening identity once
   * in the entry (e.g., "Seven days now. You have watched me.").
   * The store is responsible for marking the milestone consumed so
   * it doesn't fire again.
   */
  becomingMilestone?: {
    facet: string;
    stage: string;
    diaryHook: string;
  } | null;
  /**
   * Top self-facts the user has told the cat about itself. The cat
   * may reference one in the entry as memory texture ("the tuna I
   * love" / "the vacuum that frightens me"). Optional.
   */
  selfFacts?: Array<{
    fact: string;
    category: string;
    assertion_count: number;
  }>;
  now?: Date;
}): Promise<DeepDiaryContext> {
  const {
    cat,
    events,
    scans,
    streakDays,
    galleryPhotosToday,
    chatTurnsToday,
    allCachedEntries,
    allGalleryPhotoDates,
    recentAbsenceThemes,
    directoryEntries,
    todaysPhotoIds,
    becomingMilestone,
    selfFacts,
    now = new Date(),
  } = opts;

  const dateKey = opts.targetDate ?? localDateKey(now);
  const isToday = dateKey === localDateKey(now);

  // Target-date-anchored "now" (audit 2026-05-14 round 9 P1 #5).
  // Memory helpers (recentEntries cutoff, anticipations, life events,
  // seasonal context, weight trend) used `new Date()` by default, so
  // a backfilled May 5 entry would compute its "recent memory" window
  // from MAY 14 backward — leaking dates that hadn't happened yet
  // from May 5's perspective. `contextNow` is midday on the target
  // date for past dates (matches `targetDateObj` in buildDayContext),
  // and the real `now` for today's entry. Wall-clock fields like
  // `generated_at` keep using actual now — only memory windows shift.
  const contextNow = isToday ? now : new Date(`${dateKey}T12:00:00`);

  // Day-context — events/scans/photos/chat all filter against the
  // TARGET DATE, not today. Pre 2026-05-09 this aggregator filtered
  // against today's date even when generating for a past date (e.g.
  // backfill of Apr 29 done on May 9 saw zero of Apr 29's events).
  // The user reported diary entries dated 10 days ago using the cat's
  // profile photo on every day with similar hallucinated themes —
  // exactly the symptom of empty data + persistent context bleeding
  // through. Now per-date.
  const dayContext = buildDayContext({
    cat,
    events,
    scans: scans.map((s) => ({
      cat_id: s.cat_id,
      headline: s.headline,
      urgency: s.urgency,
      created_at: s.created_at,
      image_uri: s.image_uri ?? null,
    })),
    streakDays,
    galleryPhotosToday,
    chatTurnsToday,
    targetDate: dateKey,
  });

  // Memory tiers — anchored to `contextNow`, NOT actual now. For
  // today's entry these are equal; for backfilled past dates, the
  // memory windows respect what was known on that date.
  const recentEntries = buildRecentEntries({
    allEntries: allCachedEntries,
    catId: cat.id,
    excludeDate: dateKey,
    now: contextNow,
  });
  const moodArc = detectMoodArc({
    recentEntries,
    todayCheckinMood: dayContext.checkin?.mood ?? null,
  });
  const recurringEntities = extractRecurringEntities(recentEntries);
  const lifeEvents = buildLifeEvents({ cat, events, scans, now: contextNow });
  const upcomingEvents = buildAnticipations({ cat, events, now: contextNow });
  const recurringChatThemes = buildRecurringChatThemes({ recentEntries });
  const seasonalContext = getSeasonalContext(contextNow);

  // Empty-day decision — applies to ANY date (today OR past). Pre
  // 2026-05-09 this was gated behind `isToday &&`, so past empty
  // dates were always treated as populated and went through the
  // populated-generation path with no real data — producing
  // hallucinated content. Now: if the target date had zero material
  // activity (no check-in, scan, photo, behaviour obs, etc.), it's
  // marked empty regardless of whether it's today or backfilled.
  // The downstream backfill logic (in diaryStore) further refuses
  // to write empty-day entries for past dates — past empty days are
  // simply gaps in the diary archive, which is more honest than
  // retroactive "quiet day" vignettes.
  const isEmptyDay = !hasMaterialToday(dayContext);
  const daysSinceLastActive = (() => {
    // For empty-day mode we need this; otherwise 0 is fine.
    if (!isEmptyDay) return 0;
    const candidates: number[] = [];
    for (const e of events) {
      if (e.cat_id !== cat.id) continue;
      try {
        candidates.push(new Date(e.ts).getTime());
      } catch {
        // skip
      }
    }
    for (const s of scans) {
      if (s.cat_id !== cat.id) continue;
      try {
        candidates.push(new Date(s.created_at).getTime());
      } catch {
        // skip
      }
    }
    for (const d of allGalleryPhotoDates) {
      try {
        candidates.push(new Date(`${d}T12:00:00`).getTime());
      } catch {
        // skip
      }
    }
    if (candidates.length === 0) return Number.POSITIVE_INFINITY;
    const mostRecent = Math.max(...candidates);
    const ms = now.getTime() - mostRecent;
    return Math.floor(ms / (24 * 60 * 60 * 1000));
  })();

  const absenceTheme = isEmptyDay
    ? pickAbsenceTheme({ recentEntries, recentThemesUsed: recentAbsenceThemes ?? [], now })
    : null;
  const lastPopulatedEntry =
    isEmptyDay
      ? recentEntries.find((e) => !!e.summary && e.summary.length > 20) ?? null
      : null;

  // Subject memory tiers — people & pets in the cat's life.
  // `subjectsToday` = directory entries whose appearances overlap with
  // today's photo ids (when supplied) or whose last_seen == today's
  // date (fallback).
  // `recurringSubjects` = top-by-appearance entries seen in the last
  // 30 days, capped at 6 to keep prompt size bounded. Excludes any
  // already in `subjectsToday` so the prompt doesn't list the same
  // subject twice.
  const RECURRING_LOOKBACK_DAYS = 30;
  const RECURRING_MAX = 6;
  const todayIdSet = new Set(todaysPhotoIds ?? []);
  // Audit 2026-05-14 round 11 P1: anchor the lookback to contextNow
  // (target date) NOT actual now. Pre-fix, backfilling May 5 on
  // May 14 would scan recurring subjects from Apr 14 - May 14 — so
  // someone first tagged on May 10 (after May 5) would show up as a
  // "recurring subject" in the May 5 prompt and leak into the entry.
  // Now: scan window is contextNow - 30d → contextNow, AND each
  // entry is additionally gated by `last_seen <= targetKey` so a
  // subject the cat hadn't yet met on the target date can't appear.
  const lookbackCutoff = (() => {
    const d = new Date(contextNow);
    d.setDate(d.getDate() - RECURRING_LOOKBACK_DAYS);
    return localDateKey(d);
  })();
  const dirEntries = directoryEntries ?? [];

  // Target end-of-day used to gate both appearance counts and vibe
  // freshness against the target date (audit 2026-05-14 round 12).
  const targetEndOfDay = `${dateKey}T23:59:59`;

  function toSubjectMemory(e: (typeof dirEntries)[number]): SubjectMemory {
    const last = new Date(`${e.last_seen}T12:00:00`);
    // daysSinceLastSeen relative to contextNow too — pre-fix this
    // used actual now, so a May 10 last_seen with a May 5 backfill
    // would render as "-5 days" (nonsense from May 5's POV).
    const days = Math.max(
      0,
      Math.floor((contextNow.getTime() - last.getTime()) / 86400000),
    );
    const descriptor =
      e.kind === 'pet'
        ? e.species
          ? `another ${e.species}`
          : 'another pet'
        : e.kind === 'person'
          ? e.relationship
          : undefined;
    // Appearances count up to target date (audit round 12). For
    // today's entry, this equals total_appearances. For a backfilled
    // past entry, only appearances dated ≤ target date count — so a
    // May 5 backfill of "Mom" who had 11 visits by May 14 but only 1
    // by May 5 surfaces as 1, not 11.
    const appearancesUpToTarget = isToday
      ? e.total_appearances
      : (e.appearances ?? []).filter((a) => a.date <= dateKey).length;
    // Vibe is generated from appearances; on past-date backfill,
    // include vibe ONLY when it was written on or before the target
    // date. Without `vibe_updated_at`, drop vibe for past entries
    // (legacy entries with unknown vibe-write date).
    const includeVibe =
      isToday ||
      (typeof e.vibe_updated_at === 'string' &&
        e.vibe_updated_at <= targetEndOfDay);
    return {
      name: e.name,
      kind: e.kind,
      ...(descriptor ? { descriptor } : {}),
      appearances: appearancesUpToTarget,
      lastSeen: e.last_seen,
      daysSinceLastSeen: days,
      ...(e.vibe && includeVibe ? { vibe: e.vibe } : {}),
    };
  }

  const subjectsToday: SubjectMemory[] = dirEntries
    .filter((e) => {
      if (todayIdSet.size > 0) {
        return e.appearances.some((a) => todayIdSet.has(a.photo_id));
      }
      return e.last_seen === dateKey;
    })
    .map(toSubjectMemory);

  const todaySet = new Set(subjectsToday.map((s) => s.name));
  // Helper: same date-capped count `toSubjectMemory` uses for the
  // rendered `appearances` field. Used here to SORT recurring
  // candidates by target-date-correct count (audit 2026-05-14 round
  // 13). Pre-fix: sort used `total_appearances` (lifetime), so for a
  // May 5 backfill, someone who became frequent in June ranked higher
  // than someone consistently present in April. The displayed count
  // was correct (round 12 fix), but the SELECTION was biased toward
  // future-frequent subjects.
  function appearancesUpToTarget(e: (typeof dirEntries)[number]): number {
    if (isToday) return e.total_appearances;
    return (e.appearances ?? []).filter((a) => a.date <= dateKey).length;
  }
  const recurringSubjects: SubjectMemory[] = dirEntries
    .filter((e) => {
      // Recurring window ends at the TARGET date (audit round 11):
      // exclude subjects whose `last_seen` is AFTER the target — they
      // hadn't been met yet from this date's perspective. For today's
      // entry, dateKey === contextNow's date, so the filter naturally
      // includes today's last_seens.
      if (e.last_seen > dateKey) return false;
      if (e.last_seen < lookbackCutoff) return false;
      if (todaySet.has(e.name)) return false;
      // Audit round 13: a subject with zero appearances on or before
      // the target date isn't actually "recurring" from this date's
      // perspective — drop them entirely rather than letting them
      // rank by lifetime count.
      if (appearancesUpToTarget(e) === 0) return false;
      return true;
    })
    .sort((a, b) => appearancesUpToTarget(b) - appearancesUpToTarget(a))
    .slice(0, RECURRING_MAX)
    .map(toSubjectMemory);

  // World entries (audit 2026-05-14 P1 #1) — same accumulated world
  // memory chat sees. Cap to 12 most-recently-referenced so the
  // prompt stays under control. Lazy-loaded to avoid a top-level
  // store import in this service.
  // World entries filtered by date the cat KNEW them (audit 2026-05-14
  // round 9 P1 #3). Pre-fix: backfilling May 5 on May 14 could mention
  // "the green chair" that the cat first noticed May 10 — temporal
  // hallucination. Now we drop any world entry whose `created_at` is
  // AFTER the target date. For TODAY's entry, no filter; for past
  // dates, only entries the cat actually knew on that day.
  const worldEntries: DeepDiaryContext['worldEntries'] = (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useWorldStore } = require('../state/worldStore') as {
        useWorldStore: {
          getState: () => {
            entriesByCat: Record<
              string,
              Array<{
                cat_id: string;
                name: string;
                kind: string;
                location?: string;
                sentiment?: string;
                last_referenced_at?: string;
                created_at?: string;
              }>
            >;
          };
        };
      };
      const list = useWorldStore.getState().entriesByCat[cat.id] ?? [];
      const targetEndOfDay = `${dateKey}T23:59:59`;
      const filtered = isToday
        ? list
        : list.filter((e) => {
            // Entries with no created_at are legacy/cold-start —
            // include them (no temporal info to be precise about).
            if (!e.created_at) return true;
            return e.created_at <= targetEndOfDay;
          });
      return filtered
        .slice()
        .sort((a, b) =>
          (b.last_referenced_at ?? b.created_at ?? '').localeCompare(
            a.last_referenced_at ?? a.created_at ?? '',
          ),
        )
        .slice(0, 12)
        .map((e) => ({
          name: e.name,
          kind: e.kind,
          ...(e.location ? { location: e.location } : {}),
          ...(e.sentiment ? { sentiment: e.sentiment } : {}),
        }));
    } catch {
      return [];
    }
  })();

  // Live weather narrative (audit 2026-05-14 P2 #6) — chat reads
  // this via `getWeatherSnapshot()`; the diary now plumbs the same
  // narrative into the prompt for climate-grounded entries. Only
  // populated for today (past-date backfill keeps the same weather
  // we cached then, OR if uncached, null — better than rendering
  // a wrong climate retroactively). Lazy-loaded so the diary
  // service doesn't statically depend on the weather module.
  const weatherNarrative: string | null = await (async () => {
    if (!isToday) return null;
    try {
      const { getWeatherSnapshot } = await import('./weatherContext');
      const snap = await getWeatherSnapshot();
      return snap?.narrative ?? null;
    } catch {
      return null;
    }
  })();

  // 30-day weight trend (audit 2026-05-14 round 6). Mirrors chat's
  // 90-day trend logic — same direction taxonomy (up/down/stable
  // within 100g) but a 30-day window so the diary captures more
  // recent body drift. The diary renderer suppresses the line when
  // direction is 'stable' (cat shouldn't read a spreadsheet to
  // itself) — only populated here so the renderer can decide.
  const weightTrend30d: DeepDiaryContext['weightTrend30d'] = (() => {
    try {
      const dayMs = 24 * 60 * 60 * 1000;
      // Anchor window to contextNow (audit 2026-05-14 round 9 P1 #5)
      // so backfilled past dates see only weight events from the 30
      // days BEFORE that date, not the 30 days before actual now.
      const cutoff = contextNow.getTime() - 30 * dayMs;
      const ceiling = contextNow.getTime();
      const weightEvents = events
        .filter((e) => e.cat_id === cat.id && e.type === 'weight')
        .filter((e) => {
          try {
            const t = new Date(e.ts).getTime();
            return t >= cutoff && t <= ceiling;
          } catch {
            return false;
          }
        })
        .sort((a, b) => a.ts.localeCompare(b.ts)); // chronological
      if (weightEvents.length < 2) return null;
      const fromEvt = weightEvents[0];
      const toEvt = weightEvents[weightEvents.length - 1];
      const fromKg = (fromEvt?.payload as { weight_kg?: number })?.weight_kg;
      const toKg = (toEvt?.payload as { weight_kg?: number })?.weight_kg;
      if (typeof fromKg !== 'number' || typeof toKg !== 'number') return null;
      const deltaKg = +(toKg - fromKg).toFixed(2);
      const absDelta = Math.abs(deltaKg);
      const direction = absDelta < 0.1 ? 'stable' : deltaKg > 0 ? 'up' : 'down';
      return { deltaKg, direction, fromKg, toKg };
    } catch {
      return null;
    }
  })();

  return {
    date: dateKey,
    isToday,
    dayContext,
    recentEntries,
    moodArc,
    recurringEntities,
    lifeEvents,
    upcomingEvents,
    recurringChatThemes,
    seasonalContext,
    isEmptyDay,
    daysSinceLastActive,
    absenceTheme,
    lastPopulatedEntry,
    subjectsToday,
    recurringSubjects,
    becomingMilestone: becomingMilestone ?? null,
    selfFacts: selfFacts ?? [],
    worldEntries,
    weatherNarrative,
    weightTrend30d,
  };
}

/**
 * Re-export memory helpers consumers may need (the readiness floor
 * for empty-day generation specifically).
 */
export { isReadyForEmptyDayEntries, daysSinceLastActivity } from './diaryMemory';
