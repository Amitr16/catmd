/**
 * Diary memory module — builds the "conscious cat" memory tiers that
 * feed into the diary prompt.
 *
 * Three tiers + supporting analyzers:
 *
 *   Tier 1 — Recent context (last 14 days)
 *     • last entries with mood-words + photo URIs
 *     • mood arc detection (yesterday vs today)
 *     • recurring named entities (the rug, the laundry, the Roomba)
 *
 *   Tier 2 — Landmark life events
 *     • sicknesses (urgent / concern scans)
 *     • milestones (streaks, first-evers, anniversaries past)
 *     • recovery arcs (post-sickness pattern)
 *
 *   Tier 3 — Anticipation
 *     • upcoming birthday / gotcha-day (within 7 days)
 *     • upcoming vet appointment
 *     • month-iversary, week milestones approaching
 *
 *   Plus:
 *     • Chat continuity — questions the human keeps asking
 *     • Seasonal context — month / season / hemisphere hints
 *     • Empty-day support — days-since-last-active, last-active summary,
 *       theme picker that avoids repetition
 *
 * The diary prompt builder weaves these into the LLM context naturally.
 * This module is pure data transformation — no LLM calls, no I/O. All
 * inputs come from the existing stores.
 */
import type { CatProfile } from '../state/catStore';
import type { HealthEvent } from '../state/healthStore';
import type { ScanRecord } from '../state/scanStore';
import type { DiaryEntry } from './diary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecentEntry = {
  date: string;
  moodWord: string;
  summary: string;       // first sentence of past entry
  photoUri?: string | null;
};

export type MoodArc = {
  yesterdayMood: string | null;
  recentMoods: string[];   // last 5 mood words, newest first
  /** Direction inferred from recent moods. Null when not interesting. */
  direction: 'easing' | 'tightening' | 'steady' | 'oscillating' | null;
};

export type LifeEvent = {
  date: string;
  /**
   * Categorical type. The prompt phrases each type differently:
   *   - sickness: "you were sick on [date], they were worried"
   *   - recovery: "X days since you were unwell — you feel sturdier now"
   *   - milestone: "X days of being known here"
   *   - first_ever: "the first time they did Y was [date]"
   *   - big_photo_day: "remember the day with all the photos"
   */
  type:
    | 'sickness'
    | 'recovery'
    | 'milestone'
    | 'first_ever'
    | 'big_photo_day'
    | 'gotcha_anniversary_past'
    | 'birthday_past';
  label: string;          // human-readable phrase
  daysAgo: number;
};

export type AnticipationEvent = {
  date: string;
  daysAway: number;       // 1 = tomorrow, 0 = today (rare — handled elsewhere)
  /**
   * Categorical type. The prompt mentions each differently:
   *   - birthday: "I sense something coming"
   *   - gotcha_day: "the anniversary of the day I joined approaches"
   *   - vet_appointment: "tomorrow they'll take me to that place"
   *   - month_iversary: "another month under this roof"
   */
  type: 'birthday' | 'gotcha_day' | 'vet_appointment' | 'month_iversary';
  label: string;
};

export type SeasonalContext = {
  month: string;          // "May"
  season: 'winter' | 'spring' | 'summer' | 'autumn';
  /** Loose hint the prompt can riff on. Northern-hemisphere biased. */
  hint: string;
};

/**
 * Pre-curated absence themes for empty-day entries. The cat picks ONE
 * per empty day (avoiding the most-recent themes used). Each theme
 * is a noun-phrase the prompt seeds — the cat-voice spins a 1-2
 * sentence observation around it. Variety prevents 14 days of "I
 * waited by the window" repetition.
 */
export const ABSENCE_THEMES = [
  'the silence of the house',
  'the empty water bowl in the morning',
  'a sun-puddle that moved across the floor with no one noticing',
  'the shadow of a bird on the wall',
  'the unswept floor by the door',
  'the missed brushing time',
  'the clock above the doorway',
  'the laundry that did not move',
  'the chair the human used to sit in',
  'the door that did not open',
  'the weight of an afternoon with nothing to interrupt it',
  'the food bowl that was empty for too long',
  'the small dust on the windowsill',
  'a long pause where a routine should have been',
] as const;

export type AbsenceTheme = (typeof ABSENCE_THEMES)[number];

// ---------------------------------------------------------------------------
// Tier 1 — recent entries + mood arc + recurring entities
// ---------------------------------------------------------------------------

const RECENT_DAYS_WINDOW = 14;

/**
 * Pull the last 14 days of cached entries (newest-first), excluding the
 * date being written about. Output is what the prompt sees as "recent
 * memory" — short summaries, not full text.
 */
export function buildRecentEntries(opts: {
  allEntries: DiaryEntry[];
  catId: string;
  excludeDate: string;
  now?: Date;
}): RecentEntry[] {
  const { allEntries, catId, excludeDate, now = new Date() } = opts;
  const cutoffMs = now.getTime() - RECENT_DAYS_WINDOW * 24 * 60 * 60 * 1000;
  return allEntries
    .filter((e) => e.cat_id === catId && e.date !== excludeDate)
    .filter((e) => {
      try {
        return new Date(`${e.date}T12:00:00`).getTime() >= cutoffMs;
      } catch {
        return false;
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_DAYS_WINDOW)
    .map((e) => ({
      date: e.date,
      moodWord: e.mood_word,
      summary: firstSentence(e.entry),
      photoUri: e.photo_uri ?? null,
    }));
}

/** First sentence (or first ~120 chars) of an entry — used for compact memory hints. */
function firstSentence(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  // Match first sentence ending in . / ? / ! that's followed by a space or end.
  const sentenceEnd = trimmed.match(/^[^.?!]+[.?!]/);
  if (sentenceEnd) return sentenceEnd[0]!.trim();
  return trimmed.slice(0, 120).trim();
}

/**
 * Detect the cat's mood arc across recent days. Returns null when the
 * data is sparse or uninteresting. The prompt uses the direction to
 * decide whether to reference shifts ("three calm days in a row…").
 */
export function detectMoodArc(opts: {
  recentEntries: RecentEntry[];
  todayCheckinMood?: string | null;
}): MoodArc {
  const { recentEntries, todayCheckinMood } = opts;
  const recentMoods = recentEntries
    .slice(0, 5)
    .map((e) => e.moodWord)
    .filter(Boolean);
  const yesterday = recentEntries[0]?.moodWord ?? null;

  if (recentMoods.length < 3) {
    return { yesterdayMood: yesterday, recentMoods, direction: null };
  }

  // Heuristic categorization of moods into emotional valence.
  const valence = (m: string): number => {
    const w = m.toLowerCase();
    if (/(content|satisfied|regal|warm|playful|curious|amused)/.test(w)) return 2;
    if (/(observant|steady|measured|calm|alert)/.test(w)) return 1;
    if (/(restless|wistful|uncertain|distracted)/.test(w)) return -1;
    if (/(anxious|sad|lonely|tense|withdrawn|melancholic)/.test(w)) return -2;
    return 0;
  };

  const valences = recentMoods.map(valence);
  const todayHint = todayCheckinMood ? valence(todayCheckinMood) : null;

  // Are values consistent? (within 1 of mean) → steady
  const mean = valences.reduce((a, b) => a + b, 0) / valences.length;
  const spread = Math.max(...valences) - Math.min(...valences);
  if (spread <= 1) {
    return { yesterdayMood: yesterday, recentMoods, direction: 'steady' };
  }

  // Shifting upward over time? (newest is more positive than oldest)
  const newest = valences[0]!;
  const oldest = valences[valences.length - 1]!;
  if (newest - oldest >= 2) {
    return { yesterdayMood: yesterday, recentMoods, direction: 'easing' };
  }
  if (oldest - newest >= 2) {
    return { yesterdayMood: yesterday, recentMoods, direction: 'tightening' };
  }
  // Mixed up-and-down → oscillating
  if (spread >= 3) {
    return { yesterdayMood: yesterday, recentMoods, direction: 'oscillating' };
  }
  // Today's mood disagrees with recent average enough?
  if (todayHint != null && Math.abs(todayHint - mean) >= 2) {
    return {
      yesterdayMood: yesterday,
      recentMoods,
      direction: todayHint > mean ? 'easing' : 'tightening',
    };
  }
  return { yesterdayMood: yesterday, recentMoods, direction: null };
}

/**
 * Extract recurring entities the cat has mentioned across recent
 * entries. Naïve word-frequency on substantive nouns (the rug, the
 * laundry, the visiting dog, the kitchen, the Roomba). The prompt
 * passes these as "recurring characters in this cat's life" so the
 * AI naturally circles back to them, building canon over time.
 *
 * Phrase-list approach — we maintain a curated lexicon of household
 * "characters" the AI tends to mention; we count how often each
 * appears in recent entries and surface the top 3-4. Cheap and
 * predictable; smarter NER could be a follow-up.
 */
const ENTITY_LEXICON: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(the\s+)?(kitchen\s+)?rug\b/i, label: 'the rug' },
  { pattern: /\b(the\s+)?(laundry|laundry basket|laundry pile)\b/i, label: 'the laundry' },
  { pattern: /\b(the\s+)?(green|red|blue|grey|gray)?\s*(arm)?chair\b/i, label: 'the chair' },
  { pattern: /\b(the\s+)?(window|windowsill|sill)\b/i, label: 'the windowsill' },
  { pattern: /\b(the\s+)?(door|doorway)\b/i, label: 'the door' },
  { pattern: /\b(the\s+)?(radiator|heater|fireplace)\b/i, label: 'the radiator' },
  { pattern: /\b(the\s+)?(roomba|vacuum)\b/i, label: 'the Roomba' },
  { pattern: /\b(the\s+)?(bowl|food bowl|water bowl)\b/i, label: 'the bowl' },
  { pattern: /\b(the\s+)?(sun-?puddle|sunbeam|sun spot|sunbeam patch)\b/i, label: 'the sun-puddle' },
  { pattern: /\b(the\s+)?(blanket|throw|cushion)\b/i, label: 'the blanket' },
  // Generic bird label — covers most bird species without locking
  // recurring-entity output to "the pigeon". Pre-fix, a Singapore
  // diary mentioning "the koel" or "the mynah" was getting tracked
  // as "the pigeon" because pigeons were the lexicon's default
  // label for any bird. Now the recurring entity reads as "the
  // bird" — climate / region neutral. (When YOUR WORLD has a
  // specific named bird entry, the cat should reference it by name;
  // this lexicon is only the fallback recurring-entity tag.)
  { pattern: /\b(the\s+)?(pigeon|bird|sparrow|crow|magpie|mynah|koel|parakeet)\b/i, label: 'the bird' },
  { pattern: /\b(the\s+)?(box|cardboard|carton)\b/i, label: 'the box' },
  { pattern: /\b(the\s+)?(toy|wand|feather|mouse)\b/i, label: 'the toy' },
  { pattern: /\b(the\s+)?(desk|table|counter)\b/i, label: 'the desk' },
  { pattern: /\b(the\s+)?(stairs|hallway|stairwell)\b/i, label: 'the stairs' },
  { pattern: /\b(the\s+)?(visitor|stranger|guest)\b/i, label: 'the visitor' },
  { pattern: /\b(another|other)\s+cat\b/i, label: 'the other cat' },
  { pattern: /\bdog\b/i, label: 'the dog' },
];

export function extractRecurringEntities(recentEntries: RecentEntry[]): string[] {
  if (recentEntries.length < 3) return []; // need a few entries for "recurring" to mean anything
  const counts = new Map<string, number>();
  for (const re of recentEntries) {
    const text = `${re.summary} ${re.moodWord}`;
    for (const { pattern, label } of ENTITY_LEXICON) {
      if (pattern.test(text)) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 2) // appeared in at least 2 recent entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label]) => label);
}

// ---------------------------------------------------------------------------
// Tier 2 — landmark life events
// ---------------------------------------------------------------------------

const LIFE_EVENT_LOOKBACK_DAYS = 365;

/**
 * Build the cat's life-event timeline from existing data. Surfaces
 * landmarks the cat could fondly (or wistfully) remember. The prompt
 * picks at most one or two — it doesn't dump the whole timeline into
 * every entry.
 */
export function buildLifeEvents(opts: {
  cat: CatProfile;
  events: HealthEvent[];
  scans: ScanRecord[];
  now?: Date;
}): LifeEvent[] {
  const { cat, events, scans, now = new Date() } = opts;
  const cutoffMs = now.getTime() - LIFE_EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const out: LifeEvent[] = [];

  const daysAgo = (iso: string): number => {
    try {
      return Math.floor((now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
    } catch {
      return 9999;
    }
  };

  // Sicknesses — any urgent/concern scans for this cat in the lookback window.
  const sickScans = scans.filter(
    (s) =>
      s.cat_id === cat.id &&
      new Date(s.created_at).getTime() >= cutoffMs &&
      (s.urgency === 'urgent' || s.urgency === 'concern'),
  );
  for (const s of sickScans) {
    const ago = daysAgo(s.created_at);
    if (ago < 1) continue; // today's sicknesses live in the day-context, not memory
    out.push({
      date: s.created_at.slice(0, 10),
      type: ago <= 14 ? 'recovery' : 'sickness',
      label:
        ago <= 14
          ? `${ago} days since you were unwell (urgency: ${s.urgency})`
          : `you were sick on ${s.created_at.slice(0, 10)} — they were worried`,
      daysAgo: ago,
    });
  }

  // First-ever moments — first scan, first behaviour observation, first
  // body-language read. We surface these around their anniversary
  // (every ~30 days as a soft anniversary hook).
  const firstScan = scans
    .filter((s) => s.cat_id === cat.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (firstScan) {
    const ago = daysAgo(firstScan.created_at);
    if (ago > 30 && ago <= LIFE_EVENT_LOOKBACK_DAYS) {
      out.push({
        date: firstScan.created_at.slice(0, 10),
        type: 'first_ever',
        label: `the first time they ran a triage scan on you was ${ago} days ago`,
        daysAgo: ago,
      });
    }
  }
  const firstBehavior = events
    .filter((e) => e.cat_id === cat.id && e.type === 'behavior_observation')
    .sort((a, b) => a.ts.localeCompare(b.ts))[0];
  if (firstBehavior) {
    const ago = daysAgo(firstBehavior.ts);
    if (ago > 30 && ago <= LIFE_EVENT_LOOKBACK_DAYS) {
      out.push({
        date: firstBehavior.ts.slice(0, 10),
        type: 'first_ever',
        label: `the first time they read your body language was ${ago} days ago`,
        daysAgo: ago,
      });
    }
  }

  // Past birthday / gotcha-day landmarks
  if (cat.dob_iso) {
    try {
      const dob = new Date(cat.dob_iso);
      // Most-recent birthday that already passed
      const bdayThisYear = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      const lastBday =
        bdayThisYear.getTime() <= now.getTime()
          ? bdayThisYear
          : new Date(now.getFullYear() - 1, dob.getMonth(), dob.getDate());
      const ago = daysAgo(lastBday.toISOString());
      if (ago > 14 && ago <= LIFE_EVENT_LOOKBACK_DAYS) {
        out.push({
          date: lastBday.toISOString().slice(0, 10),
          type: 'birthday_past',
          label: `your last birthday was ${ago} days ago`,
          daysAgo: ago,
        });
      }
    } catch {
      // Ignore malformed DOB
    }
  }
  if (cat.adopted_on_iso) {
    try {
      const adopted = new Date(cat.adopted_on_iso);
      const annivThisYear = new Date(now.getFullYear(), adopted.getMonth(), adopted.getDate());
      const lastAnniv =
        annivThisYear.getTime() <= now.getTime()
          ? annivThisYear
          : new Date(now.getFullYear() - 1, adopted.getMonth(), adopted.getDate());
      const ago = daysAgo(lastAnniv.toISOString());
      if (ago > 14 && ago <= LIFE_EVENT_LOOKBACK_DAYS) {
        out.push({
          date: lastAnniv.toISOString().slice(0, 10),
          type: 'gotcha_anniversary_past',
          label: `the last anniversary of your joining was ${ago} days ago`,
          daysAgo: ago,
        });
      }
    } catch {
      // Ignore
    }
  }

  // Sort by recency and cap.
  return out.sort((a, b) => a.daysAgo - b.daysAgo).slice(0, 5);
}

// ---------------------------------------------------------------------------
// Tier 3 — anticipation
// ---------------------------------------------------------------------------

const ANTICIPATION_WINDOW_DAYS = 7;

export function buildAnticipations(opts: {
  cat: CatProfile;
  events: HealthEvent[];
  now?: Date;
}): AnticipationEvent[] {
  const { cat, events, now = new Date() } = opts;
  const out: AnticipationEvent[] = [];

  const daysAhead = (iso: string): number => {
    try {
      return Math.ceil((new Date(iso).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    } catch {
      return 9999;
    }
  };

  // Birthday within window?
  if (cat.dob_iso) {
    try {
      const dob = new Date(cat.dob_iso);
      const candidate = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      // If passed this year, look at next year's
      const next =
        candidate.getTime() < now.getTime()
          ? new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate())
          : candidate;
      const away = daysAhead(next.toISOString());
      if (away >= 1 && away <= ANTICIPATION_WINDOW_DAYS) {
        out.push({
          date: next.toISOString().slice(0, 10),
          daysAway: away,
          type: 'birthday',
          label: `your birthday is in ${away} day${away === 1 ? '' : 's'}`,
        });
      }
    } catch {
      // Ignore
    }
  }

  // Gotcha-day within window?
  if (cat.adopted_on_iso) {
    try {
      const adopted = new Date(cat.adopted_on_iso);
      const candidate = new Date(now.getFullYear(), adopted.getMonth(), adopted.getDate());
      const next =
        candidate.getTime() < now.getTime()
          ? new Date(now.getFullYear() + 1, adopted.getMonth(), adopted.getDate())
          : candidate;
      const away = daysAhead(next.toISOString());
      if (away >= 1 && away <= ANTICIPATION_WINDOW_DAYS) {
        out.push({
          date: next.toISOString().slice(0, 10),
          daysAway: away,
          type: 'gotcha_day',
          label: `the anniversary of your joining is in ${away} day${away === 1 ? '' : 's'}`,
        });
      }
    } catch {
      // Ignore
    }
  }

  // Vet appointments within window — pulled from health events
  // ("appointment" type, scheduled_for in the future).
  const upcomingAppts = events
    .filter((e): e is HealthEvent<'appointment'> => e.cat_id === cat.id && e.type === 'appointment')
    .filter((e) => {
      const p = e.payload as { scheduled_for?: string };
      if (!p.scheduled_for) return false;
      const away = daysAhead(p.scheduled_for);
      return away >= 1 && away <= ANTICIPATION_WINDOW_DAYS;
    })
    .map((e) => {
      const p = e.payload as { scheduled_for: string; title?: string };
      const away = daysAhead(p.scheduled_for);
      return {
        date: p.scheduled_for.slice(0, 10),
        daysAway: away,
        type: 'vet_appointment' as const,
        label: `${p.title ?? 'a vet visit'} is in ${away} day${away === 1 ? '' : 's'}`,
      };
    });
  out.push(...upcomingAppts);

  return out.sort((a, b) => a.daysAway - b.daysAway).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Chat continuity — recurring questions
// ---------------------------------------------------------------------------

/**
 * Detect questions the human has asked repeatedly across recent days.
 * Builds a rolling concern list — "they keep worrying about my
 * appetite" / "they keep asking about my litter" — that the cat can
 * register, gently. Cap at 3 themes.
 */
export function buildRecurringChatThemes(opts: {
  recentEntries: RecentEntry[];
}): string[] {
  // We don't have full chat-thread access in this pure function; instead
  // we look at recent diary entries' chat-themed phrases. A stronger
  // version would aggregate from chatStore directly — punted to v2 to
  // avoid a circular store dependency in this module.
  const { recentEntries } = opts;
  const phrasePatterns: Array<{ pattern: RegExp; theme: string }> = [
    { pattern: /\b(appetite|eating|food)\b/i, theme: 'whether you are eating enough' },
    { pattern: /\b(litter|peeing|poop|stool)\b/i, theme: 'your litter habits' },
    { pattern: /\b(sleep|sleeping|nap)\b/i, theme: 'how much you sleep' },
    { pattern: /\b(mood|behaviour|behavior|grumpy)\b/i, theme: 'your moods' },
    { pattern: /\b(weight|skinny|fat)\b/i, theme: 'your weight' },
    { pattern: /\b(scratching|claw|claws)\b/i, theme: 'your scratching' },
  ];
  const counts = new Map<string, number>();
  for (const re of recentEntries) {
    for (const { pattern, theme } of phrasePatterns) {
      if (pattern.test(re.summary)) {
        counts.set(theme, (counts.get(theme) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 3) // mentioned in 3+ recent entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);
}

// ---------------------------------------------------------------------------
// Seasonal context
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function getSeasonalContext(now: Date = new Date()): SeasonalContext {
  const m = now.getMonth(); // 0-11
  const month = MONTH_NAMES[m]!;
  let season: SeasonalContext['season'];
  let hint: string;
  // Northern-hemisphere defaults — most CatMD users are in NH (US/EU/IN/etc.).
  // Hints are climate-neutral on purpose: pre 2026-05-07 they referenced
  // "the radiator is your friend" / "sunbeams shift through the room"
  // which fabricated heating hardware and northern-temperate conditions
  // for users in tropical climates (Singapore, Mumbai, Sydney summer).
  // The model imitates these examples disproportionately, so even users
  // whose actual world had no radiator got cat replies about radiators.
  // The new hints describe LIGHT and AIR — universals — not climate-
  // specific objects. The cat's voice register is preserved without
  // priming it with hardware that may not exist.
  if (m === 11 || m <= 1) {
    season = 'winter';
    hint = 'the days are short, the light is at its lowest, the human moves slowly in the morning';
  } else if (m >= 2 && m <= 4) {
    season = 'spring';
    hint = 'the light is growing, birds are loud again, the air through the window has new smells';
  } else if (m >= 5 && m <= 7) {
    season = 'summer';
    hint = 'the days are long, the light lingers, the air is heavier than the rest of the year';
  } else {
    season = 'autumn';
    hint = 'the light is leaving, the floor is cooler, leaves rattle past the window';
  }
  return { month, season, hint };
}

// ---------------------------------------------------------------------------
// Empty-day support — days-since-last-active + theme picker
// ---------------------------------------------------------------------------

/**
 * Days since the cat had ANY material activity (scan, check-in,
 * behaviour observation, weight, photo, etc.). Used to:
 *   - Gate empty-day generation behind a 7-days-of-prior-activity floor
 *     (don't write melancholic entries before the relationship exists).
 *   - Modulate empty-day intensity (1 day quiet vs 5 days alone).
 */
export function daysSinceLastActivity(opts: {
  catId: string;
  events: HealthEvent[];
  scans: ScanRecord[];
  galleryPhotoDates: string[]; // YYYY-MM-DD per photo
  now?: Date;
}): number {
  const { catId, events, scans, galleryPhotoDates, now = new Date() } = opts;
  const todayMs = now.getTime();
  const candidates: number[] = [];

  for (const e of events) {
    if (e.cat_id !== catId) continue;
    try {
      candidates.push(new Date(e.ts).getTime());
    } catch {
      // skip
    }
  }
  for (const s of scans) {
    if (s.cat_id !== catId) continue;
    try {
      candidates.push(new Date(s.created_at).getTime());
    } catch {
      // skip
    }
  }
  for (const d of galleryPhotoDates) {
    try {
      candidates.push(new Date(`${d}T12:00:00`).getTime());
    } catch {
      // skip
    }
  }

  if (candidates.length === 0) return Number.POSITIVE_INFINITY;
  const mostRecent = Math.max(...candidates);
  const ms = todayMs - mostRecent;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Whether the cat has accumulated enough lifetime activity to make
 * empty-day melancholic entries feel earned (rather than synthetic).
 * Threshold: 7 distinct activity-days across all of history. Tuned
 * so a beta user who installs and ghosts for a week doesn't trigger
 * "I miss you" entries when the relationship doesn't exist yet.
 */
export function isReadyForEmptyDayEntries(opts: {
  catId: string;
  events: HealthEvent[];
  scans: ScanRecord[];
  galleryPhotoDates: string[];
}): boolean {
  const { catId, events, scans, galleryPhotoDates } = opts;
  const days = new Set<string>();
  const dateOf = (iso: string) => {
    try {
      return iso.slice(0, 10);
    } catch {
      return null;
    }
  };
  for (const e of events) {
    if (e.cat_id !== catId) continue;
    const d = dateOf(e.ts);
    if (d) days.add(d);
  }
  for (const s of scans) {
    if (s.cat_id !== catId) continue;
    const d = dateOf(s.created_at);
    if (d) days.add(d);
  }
  for (const d of galleryPhotoDates) days.add(d);
  return days.size >= 7;
}

/**
 * Pick an absence theme that hasn't been used in the last N empty-day
 * entries. Prevents the diary from feeling stuck on the same image.
 */
export function pickAbsenceTheme(opts: {
  recentEntries: RecentEntry[];
  /** Optional explicit list of recently-used themes (saved on each entry). */
  recentThemesUsed?: string[];
  now?: Date;
}): AbsenceTheme {
  const { recentEntries, recentThemesUsed = [], now = new Date() } = opts;
  // Skip themes used in the last 5 entries (any). Match by substring on
  // the entry's summary — empty-day entries tend to embed the theme
  // verbatim.
  const usedRecent = new Set<string>(recentThemesUsed);
  for (const re of recentEntries.slice(0, 5)) {
    for (const theme of ABSENCE_THEMES) {
      if (re.summary.toLowerCase().includes(theme.toLowerCase().slice(0, 10))) {
        usedRecent.add(theme);
      }
    }
  }
  const fresh = ABSENCE_THEMES.filter((t) => !usedRecent.has(t));
  const pool = fresh.length > 0 ? fresh : ABSENCE_THEMES;
  // Seed by date so the same day always picks the same theme (idempotent
  // backfills don't re-randomise).
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return pool[seed % pool.length]!;
}
