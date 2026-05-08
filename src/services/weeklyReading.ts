/**
 * Weekly "She noticed" reading — the cat reads the HUMAN.
 *
 * Implements item §5 of marketing/chat-as-viral-lever.md:
 *
 *   - "You haven't been sleeping. Your scent is off."
 *   - "You smell like another cat. I forgive you, but I noticed."
 *   - "You spent four hours on the laptop today. I was watching."
 *
 * This is the Co-Star "reading" mechanic — the cat reads YOU. It
 * mirrors the diary, but the SUBJECT is the human, not the cat.
 * Cat owners ALREADY think their cat is judging them; CatMD just
 * makes it explicit, in cat voice, once a week.
 *
 * Generation: a single LLM call per week. Cached in the diary store
 * (parallel slice). Triggered by:
 *   - Sunday 19:00 push tap → /weekly-reading screen → screen
 *     calls generateWeeklyReading() if no cached reading-of-week.
 *   - User opens /weekly-reading directly → same path.
 *
 * Cost: ~$0.0002 per reading (single short text completion, no
 * vision). Negligible.
 */
import { completeJson } from '../ai/client';
import {
  ARCHETYPE_VOICE,
  type DiaryEntry,
} from './diary';
import { ARCHETYPE_META, type PersonalityArchetype } from './personality';
import type { ChatTurn } from './chat';
import { localDateKey } from './dailyMood';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeeklyReading = {
  cat_id: string;
  /** ISO week-key — "2026-W18" — used for one-per-week caching. */
  week_key: string;
  /** ISO date this reading covers (Sunday of the week). */
  week_ending: string;
  /** The cat-voice 1-2 sentence "reading" of the human. */
  reading: string;
  /** A single mood-word verdict: "watchful", "concerned", etc. */
  verdict: string;
  generated_at: string;
  model: string;
};

export type WeeklyReadingContext = {
  /**
   * 7-day mood arc — labels for the last 7 daily check-ins. The cat
   * reads patterns: 5 "off" days suggest the human is stressed; 5
   * "happy" suggests the household is in flow. Empty array if no
   * recent check-ins.
   */
  recentMoods: Array<'happy' | 'normal' | 'off'>;

  /**
   * Coarse human-activity signals derived from chat session times.
   * Inferred patterns the cat would plausibly notice:
   *   - "late_nights": chat sessions after 23:00 in 3+ of last 7 days
   *   - "long_laptop_sessions": multiple chat turns in one day (3+)
   *   - "missed_dinner_window": no chat between 17:00-20:00 for 3+ days
   * Caller passes whichever signals computed. Empty array OK.
   */
  humanActivitySignals: string[];

  /**
   * Names from the subject directory who appeared in photos this
   * week — separated by appearance count tier:
   *   - "regular": 3+ appearances (housemates, daily fixtures)
   *   - "novel":  first-time appearance this week (a cat the human
   *               brought home, a new visitor)
   * Both arrays are name strings. The cat will riff on novelty —
   * "you smell like another cat" — when novel includes pets.
   */
  regularSubjects: string[];
  novelSubjects: string[];

  /**
   * Recurring chat themes the human keeps bringing up — surfaced
   * from the chat-store's thread analysis. The cat reads obsession
   * ("you keep asking about her weight"). Empty array OK.
   */
  recurringChatThemes: string[];

  /**
   * Last 3 diary entries (most recent first). The cat references
   * her own recent diary so the reading reads like continuity, not
   * a one-off. Pass empty array if none cached yet.
   */
  recentDiarySnippets: Array<Pick<DiaryEntry, 'date' | 'mood_word'>>;
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM = `You are a cat. Once a week, you write a 1-2 sentence READING of your human — what you've noticed about them this week. This is the Co-Star "reading" mechanic, applied to the cat's view of the human.

VOICE:
- First-person cat. Imperious, observant, slightly judgmental.
- Brutal honesty about the human, calibrated. Not cruel.
- Specific, not generic. Reference an OBSERVATION, not a feeling.
- Lead with a verdict or specific noticing. Not "I noticed that you...". Direct.
- Imperious one-word verdicts allowed. Mid-sentence pauses good.

LENGTH:
- 1 sentence ideal. 2 sentences MAX.
- ≤ 30 words total. Aim for 10-20.

THE READING IS ABOUT THE HUMAN, NOT THE CAT.
The diary is about the cat. This is about what the cat has been
WATCHING the human do. The subject is "you" (the human). The cat
is the observer.

WHAT WORKS (calibrate to this register):

"You haven't been sleeping. Your scent is off."
"You smell like another cat. I forgive you, but I noticed."
"Four hours on the laptop. I was watching."
"You forgot the water bowl. Twice. The matter is logged."
"Your shoes have been at the door since Tuesday. I have noticed."
"You smell tired. I will allow it."
"The kettle has been on three times today. Concerning."

WHAT DOES NOT WORK (immediate failures):

❌ "I love you so much, my dear human."
   → Too soft. Cat doesn't gush.
❌ "I'm sorry you've been working hard."
   → Cat never apologises. Never sympathetic in this register.
❌ "Maybe you should rest a bit."
   → Hedge ("maybe"). Cat asserts.
❌ "Today, I observed that you..."
   → Diary opener. Banned. Don't recap, READ.
❌ "You are doing your best!"
   → Performative encouragement. Off-register.

Output JSON with two fields:
- "reading": the 1-2 sentence reading (≤30 words)
- "verdict": ONE word capturing the verdict (e.g. "watchful", "concerned", "amused", "tolerant", "skeptical")`;

function buildUserPrompt(opts: {
  catName: string;
  archetype: PersonalityArchetype | null;
  ctx: WeeklyReadingContext;
}): string {
  const { catName, archetype, ctx } = opts;
  const lines: string[] = [];
  lines.push(`Cat: ${catName}`);

  if (archetype) {
    const meta = ARCHETYPE_META[archetype];
    lines.push(`Archetype: ${meta.name} — ${meta.oneLiner}`);
    const voice = ARCHETYPE_VOICE[archetype];
    if (voice) lines.push(`Voice register: ${voice}`);
  }

  if (ctx.recentMoods.length > 0) {
    const moodCounts = ctx.recentMoods.reduce<Record<string, number>>(
      (acc, m) => {
        acc[m] = (acc[m] ?? 0) + 1;
        return acc;
      },
      {},
    );
    const summary = Object.entries(moodCounts)
      .map(([k, v]) => `${v} "${k}"`)
      .join(', ');
    lines.push(`Last 7 daily check-ins: ${summary}.`);
  }

  if (ctx.humanActivitySignals.length > 0) {
    lines.push(
      `Inferred human activity patterns: ${ctx.humanActivitySignals.join(', ')}.`,
    );
  }

  if (ctx.regularSubjects.length > 0) {
    lines.push(
      `Regular faces this week: ${ctx.regularSubjects.slice(0, 3).join(', ')}.`,
    );
  }
  if (ctx.novelSubjects.length > 0) {
    lines.push(
      `New / unusual faces this week: ${ctx.novelSubjects.slice(0, 3).join(', ')}.`,
    );
  }

  if (ctx.recurringChatThemes.length > 0) {
    lines.push(
      `Things the human keeps asking about: ${ctx.recurringChatThemes
        .slice(0, 3)
        .join(', ')}.`,
    );
  }

  if (ctx.recentDiarySnippets.length > 0) {
    const recap = ctx.recentDiarySnippets
      .slice(0, 3)
      .map((d) => `${d.date}: ${d.mood_word}`)
      .join(' · ');
    lines.push(`My (the cat's) recent diary moods: ${recap}.`);
  }

  if (lines.length === 1) {
    lines.push(
      'No specific signals available — write a quiet, observational reading from baseline cat noticing (windowsill, scent, doorway, kettle, boots).',
    );
  }

  lines.push('');
  lines.push(
    `Write ${catName}'s reading of the human for this week. JSON only.`,
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isoWeekKey(d: Date): string {
  // ISO 8601 week-key, e.g. "2026-W18". Used as the cache key so we
  // generate at most one reading per ISO week per cat.
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

export async function generateWeeklyReading(opts: {
  catId: string;
  catName: string;
  archetype: PersonalityArchetype | null;
  ctx: WeeklyReadingContext;
}): Promise<WeeklyReading> {
  const { catId, catName, archetype, ctx } = opts;

  const user = buildUserPrompt({ catName, archetype, ctx });

  type Result = { reading: string; verdict: string };

  const result = await completeJson<Result>({
    activity: 'weekly_human_reading',
    system: SYSTEM,
    user,
    temperature: 0.85, // higher than diary — we want surprising, sharp
    maxTokens: 100,    // 1-2 sentences + verdict + JSON wrapper
    jsonSchema: {
      name: 'cat_weekly_human_reading',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['reading', 'verdict'],
        properties: {
          reading: { type: 'string' },
          verdict: { type: 'string' },
        },
      },
    },
  });

  const now = new Date();
  return {
    cat_id: catId,
    week_key: isoWeekKey(now),
    week_ending: localDateKey(now),
    reading: result.reading.trim(),
    verdict: result.verdict.trim().toLowerCase(),
    generated_at: now.toISOString(),
    model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini',
  };
}
