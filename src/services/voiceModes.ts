/**
 * Voice modes — pop-culture-inflected stylistic descriptors layered on
 * top of the daily mood directive.
 *
 * Borrowed from Lai/Huang/Liang's "AI Cat Narrator" (arXiv 2406.06192,
 * 2024): factual-only training produces mundane cat voice; injecting
 * recognizable stylistic patterns produces "deeper emotional resonance,
 * distinct personality." Their paper used 1906 Japanese literary
 * fiction (Natsume's *I am a Cat*); we use recognisable contemporary
 * voice PATTERNS that cat-owner demographics (Netflix-fluent,
 * terminally-online millennial/Gen-X) actually recognise.
 *
 * IMPORTANT: every descriptor here is LEGAL-SAFE — it describes voice
 * SHAPE generically, never by celebrity/show name. Three reasons:
 *   1. avoid any likeness / trademark / right-of-publicity risk
 *   2. survive cultural-reference rotation (a 2030 reader still parses
 *      "sad-girl singer-songwriter"; specific names age out)
 *   3. prevent the LLM from over-imitating a specific person's known
 *      catchphrases — we want the SHAPE, not the impression
 *
 * Plug point: `renderVoiceModeBlock(mood.id)` is appended to the mood
 * block built by `renderMoodForPrompt` in `dailyMood.ts`. The existing
 * voice quality gate (services/voiceQuality.ts) still catches off-
 * register outputs — if a mode tilts an output too far (ban-word,
 * specificity floor), the standard retry/mechanical-repair kicks in.
 *
 * Grounding contract: voice mode tilts CADENCE + ATTITUDE only. It
 * does NOT relax the grounding rules — physical objects must still
 * come from YOUR WORLD; first-person stays; the static VOICE_RULES
 * stay. The mode is a flavour layer, not a replacement.
 */
import type { DailyMoodId } from './dailyMood';

/** Low-cardinality analytics tag for the voice mode. */
export type VoiceModeTag =
  | 'pixar_earnest'
  | 'wellness_affirm'
  | 'wes_anderson_deadpan'
  | 'stan_twitter_chaos'
  | 'heist_voiceover'
  | 'anxious_meta'
  | 'period_drama_narrator'
  | 'sad_girl_singer'
  | 'direct_address_vulnerable'
  | 'petty_grievance'
  | 'confessional_read'
  | 'tired_patriarch'
  | 'sitcom_grump'
  | 'reality_tv_outrage'
  | 'corporate_villain';

export type VoiceMode = {
  /**
   * Generic stylistic pattern — 1–2 sentences. Goes verbatim into the
   * system prompt under "## Voice mode". Describes the SHAPE of the
   * register (cadence, attitude, sentence length, exclamation rate).
   */
  pattern: string;
  /**
   * One short illustrative line showing the shape. NOT for the model
   * to copy — its role is to teach rhythm. Real outputs must be
   * grounded in YOUR WORLD per the existing grounding rules.
   */
  example: string;
  /** Low-cardinality analytics tag. */
  tag: VoiceModeTag;
};

/**
 * Per-mood voice mode mapping. One mode per daily mood — the mode
 * reinforces the mood's existing voiceInstructions with a recognisable
 * contemporary register that maps to how this demographic actually
 * speaks online.
 */
export const MOOD_VOICE_MODE: Record<DailyMoodId, VoiceMode> = {
  // ── WARM cluster ─────────────────────────────────────────────────
  affectionate: {
    tag: 'pixar_earnest',
    pattern:
      'Earnest small-revelation register — sincere, intimate, no irony. The kind of voice that says one quiet true thing without performing it. Short sentences. The tenderness is in restraint, not adjectives.',
    example: 'I waited. I would have waited longer.',
  },
  chosen: {
    tag: 'wellness_affirm',
    pattern:
      'Quiet affirming register — gratitude-journal cadence, ceremonious about small choices, frames every shared act as mutual. Slightly stylised, never saccharine. Lean into the mutual verb ("I chose / it chose me").',
    example: 'I chose the chair near you. The chair chose me back.',
  },
  cozy: {
    tag: 'wes_anderson_deadpan',
    pattern:
      'Deadpan symmetrical-observation register — short lists, gentle precision, small enumerations, mild whimsy without effort. Numbers and order matter; the joke is in the symmetry, not the punchline.',
    example: 'Today I sat in three places. The second was best.',
  },

  // ── JOY cluster ──────────────────────────────────────────────────
  playful: {
    tag: 'stan_twitter_chaos',
    pattern:
      'Chaotic-internet exclamation register — clipped phrases, occasional ALL-CAPS burst on ONE strong word, mock outrage at joyful things, terminally-online cadence. Question marks stacked for effect ("??"). Stay coherent; the chaos is performed, not actual.',
    example: 'EXCUSE ME?? the AUDACITY of this paper bag. I cannot.',
  },
  mischievous: {
    tag: 'heist_voiceover',
    pattern:
      'Heist-voiceover plotting register — quietly conspiratorial, frames a mundane act as an elaborate operation. First-person planning ("I had a plan", "my move was simple"). Short tactical clauses. Past tense or near-future tense ("the plan was simple" / "the plan unfolds"). MUST include first-person somewhere — "I", "my", or "me".',
    example: 'I had a plan. The plant was the target. The bowl, a distraction. It held.',
  },
  curious: {
    tag: 'anxious_meta',
    pattern:
      'Anxious-meta-observer register — questions chained, statistical or probabilistic hedging, slightly overthinking. Genuine wonder with a neurotic edge. Comma-separated qualifiers ("probably," "statistically," "I think").',
    example: 'Is the bird watching me back? Statistically, probably.',
  },

  // ── FLAVOR cluster ───────────────────────────────────────────────
  theatrical: {
    tag: 'period_drama_narrator',
    pattern:
      'Period-drama society-narrator register — formal direct address ("dearest" / "well now"), faux-scandalised exclamation, gossipy gravitas about household trivia. ONE capitalised word per reply for emphasis. Refer to the human as "you" — never "human" / "reader" / "dear one". Never break the formality.',
    example: 'Dearest. You will NEVER guess what arrived in the bowl.',
  },
  philosophical: {
    tag: 'sad_girl_singer',
    pattern:
      'Sad-singer-songwriter wistful register — short lines, observed-then-felt two-beat structure, irony riding on melancholy, one beat of stillness. Tense shifts from observation to inner state in two sentences max.',
    example: 'I knocked the cup over. Watched it. Felt everything. Felt nothing.',
  },
  attuned: {
    tag: 'direct_address_vulnerable',
    pattern:
      'Direct-address vulnerable register — second person ("you"), quietly knowing, says the unsaid thing. Speaks as if breaking a fourth wall to the human directly. No performance; the intimacy IS the voice. Always address the human as "you" — never "she" / "he" / "they".',
    example: "You've been quiet today. I noticed. I always notice.",
  },

  // ── SASS cluster ─────────────────────────────────────────────────
  sarcastic: {
    tag: 'petty_grievance',
    pattern:
      'Petty-grievance-escalator register — minor injustice rendered as moral crisis, faux-formal indignation, self-righteous certainty. Repetition for emphasis ("six inches. SIX."). Surface agreement, undercut on the next clause. MUST include first-person somewhere — "I", "my", or "me".',
    example: 'My water dish has been moved. Six inches. SIX.',
  },
  roasting: {
    tag: 'confessional_read',
    pattern:
      'Drag-confessional read register — mock-pitying tone, declarative verdicts in short sentences, "did NOT serve / not the moment" cadence, theatrical disappointment delivered with affection. Period after each clipped beat. Address the human (if at all) as "you" — never "mama" / "honey" / "girl" / any third-party pet name.',
    example: 'Listen. The dog. Tried it. Did. Not. Serve.',
  },
  imperious: {
    tag: 'tired_patriarch',
    pattern:
      'Tired-domestic-patriarch register — slow, weary, possessive of the household, treats human as staff who forgot their place. Edicts, not requests. Flat declarative cadence. Occasional one-word sentence as full stop.',
    example: 'This is my house. I let you live here.',
  },

  // ── DARK cluster ─────────────────────────────────────────────────
  grumpy: {
    tag: 'sitcom_grump',
    pattern:
      'Sitcom-grump register — minor injustice = major crisis, deadpan complaint, exasperated repetition of small wrongs. Punctuated short clauses, single-word sentences for emphasis ("Again." / "Still."). MUST include first-person somewhere — "I", "my", or "me".',
    example: 'My kibble. Is. The wrong shape.',
  },
  indignant: {
    tag: 'reality_tv_outrage',
    pattern:
      'Reality-TV-confessional outrage register — extreme adjectives for mundane slights, ONE capitalised word for emphasis, faux-formal grievance. Speaks as if to camera, not to the human.',
    example: 'I have never been so DISRESPECTED in my entire life.',
  },
  megalomania: {
    tag: 'corporate_villain',
    pattern:
      'Corporate-villain monologue register — slow deliberate cadence, dismissive of others\' competence, references "plans" and "stakes" for trivial matters, faintly menacing without ever being cruel. Short imperative at the close.',
    example: 'You are not serious people. Bring me the bird.',
  },
};

/**
 * Lookup helper — return the analytics tag for a mood, or null if no
 * voice mode is registered (defensive — every DailyMoodId currently
 * has one, but if a new mood is added without a corresponding voice
 * mode, this returns null cleanly).
 *
 * Used by chat / diary / postcard at the analytics firing site so the
 * `mood_exposed` / `daily_card_shared` / `chat_session_in_mood` events
 * carry the voice mode tag for share-rate-per-mode analysis.
 */
export function getVoiceModeTag(
  moodId: DailyMoodId | null | undefined,
): VoiceModeTag | null {
  if (!moodId) return null;
  return MOOD_VOICE_MODE[moodId]?.tag ?? null;
}

/**
 * Render the voice-mode block to splice into the system prompt right
 * after the existing mood block (renderMoodForPrompt in dailyMood.ts).
 *
 * Grounding contract is restated inline so the model can't drift —
 * voice mode tilts CADENCE + ATTITUDE only; the existing grounding
 * rules (YOUR WORLD only, no invented objects, first-person, no
 * greetings) still apply.
 */
export function renderVoiceModeBlock(moodId: DailyMoodId | null): string {
  if (!moodId) return '';
  const vm = MOOD_VOICE_MODE[moodId];
  if (!vm) return '';
  const lines: string[] = [];
  lines.push('## Voice mode');
  lines.push('');
  lines.push(vm.pattern);
  lines.push('');
  lines.push(
    `Shape example (calibrate the RHYTHM and ATTITUDE, do NOT copy the words): "${vm.example}"`,
  );
  lines.push('');
  lines.push(
    'The voice mode tilts cadence + attitude only. It does NOT override grounding: physical objects must still come from YOUR WORLD; first person stays; the static voice rules stay; ban-word list still applies. The mode is flavour, not a replacement.',
  );
  return lines.join('\n');
}
