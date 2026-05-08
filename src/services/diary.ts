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
import { resolveCatAgeYears, type CatProfile } from '../state/catStore';
import type { HealthEvent } from '../state/healthStore';
import type { ScanRecord } from '../state/scanStore';
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
   * Optional gallery photos for today. When provided, the most-recent
   * gallery photo becomes the diary's vision input. Falls back to
   * symptom-photo / scan-image / profile photo when gallery is empty.
   */
  galleryPhotosToday?: Array<{ uri: string; added_at: string }>;
  /**
   * Optional today's chat turns (BOTH user + assistant). The aggregator
   * extracts user-side themes; assistant turns aren't surfaced to the
   * diary because they'd echo our own words back at the cat-voice.
   */
  chatTurnsToday?: Array<{ role: 'user' | 'assistant'; content: string; created_at: string }>;
}): DiaryDayContext {
  const { cat, events, scans, streakDays, galleryPhotosToday, chatTurnsToday } = opts;
  const today = new Date();
  const todayKey = localDateKey(today);

  const isToday = (iso: string) => {
    try {
      return localDateKey(new Date(iso)) === todayKey;
    } catch {
      return false;
    }
  };

  // Filter today's events for THIS cat
  const todays = events.filter((e) => e.cat_id === cat.id && isToday(e.ts));

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

  // Scans today (full record, kept for photo fallback)
  const scansTodayRaw = scans.filter((s) => s.cat_id === cat.id && isToday(s.created_at));
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
      if (!isToday(turn.created_at)) continue;
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

  // Birthday / adoption-iversary today?
  const isBirthday = (() => {
    if (!cat.dob_iso) return false;
    try {
      const dob = new Date(cat.dob_iso);
      return (
        dob.getMonth() === today.getMonth() &&
        dob.getDate() === today.getDate()
      );
    } catch {
      return false;
    }
  })();
  const isAdoptionIversary = (() => {
    if (!cat.adopted_on_iso) return false;
    try {
      const adopted = new Date(cat.adopted_on_iso);
      return (
        adopted.getMonth() === today.getMonth() &&
        adopted.getDate() === today.getDate()
      );
    } catch {
      return false;
    }
  })();

  // Streak milestones — match exact-day landings only. Most users open
  // the diary nightly so we won't miss the day.
  const STREAK_MILESTONES = [7, 30, 60, 100, 180, 365];
  const streakMilestone = STREAK_MILESTONES.includes(streakDays) ? streakDays : null;

  // Recent emergency scan — covers today AND yesterday so a 9pm scan
  // followed by an 8am next-day diary read still acknowledges it.
  const recentEmergencyScan = (() => {
    const cutoff = Date.now() - 36 * 60 * 60 * 1000; // 36h
    return scans.some(
      (s) =>
        s.cat_id === cat.id &&
        new Date(s.created_at).getTime() >= cutoff &&
        s.urgency.toLowerCase() === 'emergency',
    );
  })();

  // Calendar special days — recognised by month-day match
  const m = today.getMonth(); // 0-11
  const d = today.getDate();  // 1-31
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
  const photoUri =
    galleryNewest ??
    symptomPhotosToday[0]?.photo_uri ??
    scanImageToday ??
    cat.photo_uri ??
    null;

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
    isBirthday,
    isAdoptionIversary,
    streakMilestone,
    recentEmergencyScan,
    specialDay,
    streakDays,
    weekday: WEEKDAYS[today.getDay()] ?? 'Today',
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
  archetype: PersonalityArchetype | null;
}): string {
  const { catName, catBreed, catAge, archetype } = opts;
  const archetypeLine = archetype
    ? `\n\nYOUR PERSONALITY: ${ARCHETYPE_META[archetype].name}. ${ARCHETYPE_VOICE[archetype]}`
    : '';
  return `${SYSTEM_PROMPT_BASE}

YOU: Your name is ${catName}. You are a ${catBreed ?? 'cat'} aged ${catAge}.${archetypeLine}

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

  const system = buildSystemPrompt({
    catName: cat.name,
    catBreed: cat.breed ?? null,
    catAge,
    archetype,
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
  // Note: photoUri alone is NOT material — a photo without any other
  // signal isn't a day worth narrating.
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
  archetype: PersonalityArchetype | null;
}): string {
  const { catName, archetype } = opts;
  const archetypeLine = archetype
    ? `\n\nYOUR PERSONALITY: ${ARCHETYPE_META[archetype].name}. ${ARCHETYPE_VOICE[archetype]}\n\nEMPTY-DAY VOICE FOR YOUR ARCHETYPE: ${ARCHETYPE_EMPTY_DAY_VOICE[archetype]}`
    : '';

  return `${EMPTY_DAY_SYSTEM_PROMPT}\n\nYOU: Your name is ${catName}.${archetypeLine}`;
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
  const system = buildEmptyDaySystemPrompt({ catName: cat.name, archetype });
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

  const system = buildSystemPrompt({
    catName: cat.name,
    catBreed: cat.breed ?? null,
    catAge,
    archetype,
  });
  const user = buildDeepUserPrompt(deep);

  const photoBase64 = await fileUriToBase64(deep.dayContext.photoUri);

  type LlmResult = {
    entry: string;
    mood_word: string;
    referenced_past_date: string | null;
  };

  const result = await completeJson<LlmResult>({
    activity: 'diary_generation',
    system,
    user,
    temperature: 0.85,
    maxTokens: 700, // a touch higher than 600 to allow memory-tier weaving
    imageBase64: photoBase64,
    imageDetail: 'low',
    jsonSchema: {
      name: 'cat_diary_entry_deep',
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
    referenced_past_date: result.referenced_past_date ?? null,
    is_empty_day: false,
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
export function buildDeepContext(opts: {
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
}): DeepDiaryContext {
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

  // Day-context — for today, use the existing aggregator. For past
  // dates, we'd ideally rebuild a day-specific context (filter events/
  // scans by the past date, not "today"). For now, when targetDate
  // is in the past we fall back to the existing aggregator's today-
  // filter — backfill primarily uses it for empty-day decisions, not
  // populated-day text. A v2 enhancement is per-date filtering.
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
  });

  // Memory tiers
  const recentEntries = buildRecentEntries({
    allEntries: allCachedEntries,
    catId: cat.id,
    excludeDate: dateKey,
    now,
  });
  const moodArc = detectMoodArc({
    recentEntries,
    todayCheckinMood: dayContext.checkin?.mood ?? null,
  });
  const recurringEntities = extractRecurringEntities(recentEntries);
  const lifeEvents = buildLifeEvents({ cat, events, scans, now });
  const upcomingEvents = buildAnticipations({ cat, events, now });
  const recurringChatThemes = buildRecurringChatThemes({ recentEntries });
  const seasonalContext = getSeasonalContext(now);

  // Empty-day decision
  const isEmptyDay = isToday && !hasMaterialToday(dayContext);
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
  const lookbackCutoff = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - RECURRING_LOOKBACK_DAYS);
    return localDateKey(d);
  })();
  const dirEntries = directoryEntries ?? [];

  function toSubjectMemory(e: (typeof dirEntries)[number]): SubjectMemory {
    const last = new Date(`${e.last_seen}T12:00:00`);
    const days = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 86400000));
    const descriptor =
      e.kind === 'pet'
        ? e.species
          ? `another ${e.species}`
          : 'another pet'
        : e.kind === 'person'
          ? e.relationship
          : undefined;
    return {
      name: e.name,
      kind: e.kind,
      ...(descriptor ? { descriptor } : {}),
      appearances: e.total_appearances,
      lastSeen: e.last_seen,
      daysSinceLastSeen: days,
      ...(e.vibe ? { vibe: e.vibe } : {}),
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
  const recurringSubjects: SubjectMemory[] = dirEntries
    .filter((e) => e.last_seen >= lookbackCutoff && !todaySet.has(e.name))
    .sort((a, b) => b.total_appearances - a.total_appearances)
    .slice(0, RECURRING_MAX)
    .map(toSubjectMemory);

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
  };
}

/**
 * Re-export memory helpers consumers may need (the readiness floor
 * for empty-day generation specifically).
 */
export { isReadyForEmptyDayEntries, daysSinceLastActivity } from './diaryMemory';
