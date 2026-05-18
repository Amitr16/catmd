/**
 * Voice Quality — deterministic shareability gate for cat output.
 *
 * Added 2026-05-14 per the share-quality audit. Three surfaces produce
 * the cat's visible voice — chat replies, diary share-lines, postcard
 * captions — and all three have historically relied on the LLM's
 * prompt instructions alone. That's good but not enough; ~5-15% of
 * generations slip through with generic pet-app phrasing, invented
 * named entities, assistant register, or are simply too long to
 * screenshot.
 *
 * This service is a post-generation evaluator. It scores the final
 * text against a set of taste rules, returns a numeric score + the
 * specific failures, and lets the caller decide whether to retry,
 * mechanically repair, or fall back. Pure functions — no AI calls,
 * no I/O. Testable.
 *
 * Trust outranks shareability: when `isMedicalContext === true`, the
 * gate softens. A clear, careful medical reply beats a quotable one.
 *
 * Architecture:
 *   - Each surface has its own length cap + threshold.
 *   - Positive signals (concrete anchor, cat POV, sideways affection,
 *     mood flavor, standalone quotability) add points.
 *   - Negative signals (banned phrases, assistant voice, unsupported
 *     named entity, generic sentiment, length overflow) subtract.
 *   - Sum ≥ threshold = ok. Failure reasons returned for retry.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceSurface = 'chat' | 'diary_card' | 'postcard';

export type VoiceQualityContext = {
  /** The cat's name. Used to whitelist self-reference + exclude from
   *  the unsupported-named-entity check. */
  catName?: string;
  /** Names of people/pets the cat KNOWS (from subject directory).
   *  Any named entity in the text not in this set + catName triggers
   *  the unsupported-named-entity check. Lowercased for matching. */
  knownSubjects?: string[];
  /** World entries (chair, garden, wand). Lowercased for matching. */
  knownObjects?: string[];
  /** Self-facts the cat has internalised. Used to validate "I love
   *  tuna"-style assertions in the text. */
  allowedFacts?: string[];
  /** True for triage / scan / pain-related chat. Quality gate softens
   *  on medical context — trust beats virality. */
  isMedicalContext?: boolean;
  /** Today's mood (from the daily lottery). Used for "mood flavor"
   *  scoring — a `cozy` reply should feel cozy, not megalomaniacal. */
  moodTag?: string;
};

export type VoiceQualityResult = {
  /** True iff score ≥ surface threshold AND no hard-fail (unsupported
   *  named entity, assistant voice). */
  ok: boolean;
  /** Raw numeric score. Used for analytics + dashboards. */
  score: number;
  /** Human-readable failure reasons for retry-prompt injection. Empty
   *  when ok. Sorted by severity (hard fails first). */
  reasons: string[];
  /** Optional mechanical repair — applied when the issue is local
   *  (length, banned phrase, trailing filler). Never invents details. */
  repaired?: string;
};

// ---------------------------------------------------------------------------
// Banned / generic phrase tables
// ---------------------------------------------------------------------------

/** Phrases that immediately drop the score. Lowercased. Whole-word
 *  matching where the phrase is a verb/noun unit; substring match for
 *  multi-word idioms. */
const BANNED_PHRASES: ReadonlyArray<string> = [
  // Saccharine pet-app cliché
  'your furry friend',
  'furry friend',
  'purrfect',
  'whisker-twitching',
  'whisker twitching',
  'fluff ball',
  'fluffball',
  'meow meow',
  // Assistant register that breaks the spell
  'as an ai',
  'as a language model',
  "i'm here for you",
  'i am here for you',
  'how can i help',
  'that sounds hard',
  'thank you for sharing',
  'i understand how',
  // Cloying Hallmark register
  'best human ever',
  'best human in the world',
  'love you so much',
  'love you to the moon',
  'love you forever',
  // Medical-advice register (should never appear in cat-voice)
  'i recommend',
  'you should consult',
  'please consult',
  'consult your vet',
];

/** Generic praise — vague positive statements with no anchor. Score
 *  penalty but not auto-fail (some can be repaired in retry). */
const GENERIC_PRAISE: ReadonlyArray<string> = [
  'today was special',
  'today was wonderful',
  'today was beautiful',
  'today was a beautiful day',
  'today was a good day',
  'today was great',
  'had a wonderful day',
  'had a great day',
  'had a beautiful day',
  'you make me happy',
  'life is beautiful',
  'life is good',
  'i am so grateful',
  "i'm so grateful",
  'feeling grateful',
  'feeling blessed',
  'so blessed',
  'my favorite human',
  'my favourite human',
  'the best day',
];

// ---------------------------------------------------------------------------
// Surface configuration
// ---------------------------------------------------------------------------

/** Soft word cap per surface. Going over → score penalty. */
const SURFACE_WORD_CAP: Record<VoiceSurface, number> = {
  postcard: 12,
  diary_card: 18,
  chat: 45,
};

/** Score threshold per surface. Medical context lowers chat's bar. */
const SURFACE_THRESHOLD: Record<VoiceSurface, number> = {
  postcard: 7,
  diary_card: 7,
  chat: 6,
};
const MEDICAL_CHAT_THRESHOLD = 4;

// ---------------------------------------------------------------------------
// Helpers — lexical signals
// ---------------------------------------------------------------------------

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Lowercased + de-punctuated for matching. */
function normalise(text: string): string {
  return text.toLowerCase();
}

function containsBanned(text: string): string[] {
  const lower = normalise(text);
  return BANNED_PHRASES.filter((p) => lower.includes(p));
}

function containsGenericPraise(text: string): string[] {
  const lower = normalise(text);
  return GENERIC_PRAISE.filter((p) => lower.includes(p));
}

/** Capitalised words that aren't a sentence-start. These are PROPER-
 *  noun candidates — if any aren't in knownSubjects + catName + a
 *  short common-word allowlist, flag as unsupported named entity. */
const COMMON_CAPS_ALLOWLIST: ReadonlyArray<string> = [
  'i', "i'm", "i'll", "i've", "i'd",
  // Days
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // Months
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  // Common adverbs/determiners that sometimes start clauses
  'today', 'tomorrow', 'yesterday',
];

function findUnsupportedNamedEntities(
  text: string,
  context: VoiceQualityContext,
): string[] {
  const allowed = new Set<string>(
    [
      ...(context.catName ? [context.catName] : []),
      ...(context.knownSubjects ?? []),
    ].map((s) => s.toLowerCase()),
  );
  const allowList = new Set<string>(COMMON_CAPS_ALLOWLIST);

  // Split on sentence boundaries. For each sentence, the first
  // word's capitalisation is grammatical, not a name signal — skip.
  const sentences = text.split(/[.!?]+\s+/).filter(Boolean);
  const flagged = new Set<string>();
  for (const sentence of sentences) {
    const tokens = sentence.trim().split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      const raw = tokens[i]!;
      const stripped = raw.replace(/[^\p{L}'-]/gu, ''); // keep letters + apostrophe + hyphen
      if (stripped.length < 2) continue;
      // First word of a sentence — caps are grammatical
      if (i === 0) continue;
      // All-caps emphasis (one word in caps for theatrical mood) — fine
      if (stripped === stripped.toUpperCase() && stripped.length > 1) continue;
      // Not capitalised → not a name
      if (stripped[0] !== stripped[0]!.toUpperCase()) continue;
      // Lowercased for matching
      const lower = stripped.toLowerCase();
      if (allowList.has(lower)) continue;
      if (allowed.has(lower)) continue;
      flagged.add(stripped);
    }
  }
  return [...flagged];
}

/** Heuristic: does the text contain a CONCRETE anchor (named subject,
 *  known object, time-of-day, weather, body-part reference)? */
function hasConcreteAnchor(
  text: string,
  context: VoiceQualityContext,
): boolean {
  const lower = normalise(text);
  // Named subjects + known objects (from context)
  for (const s of [...(context.knownSubjects ?? []), ...(context.knownObjects ?? [])]) {
    if (s && lower.includes(s.toLowerCase())) return true;
  }
  // Body / time / weather / sensory anchors — universal grounding
  const anchorPatterns = [
    /\b(paw|tail|whisker|ear|nose|fur|claw|head|chest|belly|spine)s?\b/,
    /\b(morning|afternoon|evening|night|noon|dawn|dusk)\b/,
    /\b(sun|rain|snow|wind|cold|warm|hot|fog|storm|cloud|sky)\b/,
    /\b(bowl|chair|cushion|blanket|window|door|floor|bed|sofa|laptop|keyboard|sock|sock)\b/,
    /\b(lap|shoulder|hand|wrist|knee|hair)\b/,
    /\b(silen|quiet|sound|sigh|hum|breath)/, // partial roots
  ];
  return anchorPatterns.some((re) => re.test(lower));
}

/** Heuristic: does the text read as cat POV (first person, no
 *  third-person human-narrator phrasing)? */
function hasCatPointOfView(text: string): boolean {
  const lower = normalise(text);
  // Strong positive markers
  const catPovMarkers = /\b(i|my|me|mine)\b/;
  if (!catPovMarkers.test(lower)) return false;
  // Anti-markers — narrator voice
  const narratorPatterns = [
    /\bthe cat (was|is|did|sat|slept|ate)/,
    /\bshe (was|is|did|sat|slept|ate) on/,  // could be narrator about cat
    /\bhe (was|is|did|sat|slept|ate) on/,
  ];
  if (narratorPatterns.some((re) => re.test(lower))) return false;
  return true;
}

/** Heuristic: does the text have a flavor (sass / warmth / drama /
 *  observation / wit) rather than flat sentiment? Detected by the
 *  presence of decisive verbs, specific qualifiers, or sentence
 *  patterns the cat-voice prompts encourage. */
function hasFlavor(text: string): boolean {
  const lower = normalise(text);
  const flavorMarkers = [
    // Cat-decisive verbs (action with judgement)
    /\b(decided|allowed|permitted|noticed|observed|approved|declared|annexed|outlawed|supervised|forgave|forgiven|claimed|selected|chose|chosen|elected)\b/,
    // Cat-evaluative qualifiers
    /\b(adequate|tolerable|insufficient|excellent|optimal|unconcluded|acceptable|sufficient)\b/,
    // Temporal precision (cat noticing things "again", "still", "exactly")
    /\b(again|still|finally|already|yet|barely|briefly|exactly|specifically)\b/,
    // "one of all the ___" — sideways selection pattern
    /\bone of\b/,
    /\bof all\b/,
    // First-person decisive idioms
    /\bI have\b.+(decided|noticed|outlawed|claimed|forgiven|been|chosen)/,
    /\bof course\b.+(not|never)/,
    // Cat physical anchors used as verbs (sat, watched, stayed)
    /\b(forgave|came back|smelling like|smells like|tastes like|sounds like|feels like)\b/,
  ];
  return flavorMarkers.some((re) => re.test(lower));
}

/** Heuristic: is the text a standalone quote (parses without app
 *  context)? Approximate by checking for orphan references that
 *  require the rest of a thread to make sense. */
function isStandaloneQuote(text: string): boolean {
  const lower = normalise(text);
  // Dependent openers — make sense only as a reply
  const dependent = [
    /^(yes|no|maybe|sure|ok|right|fine)\b/,
    /^(because|but|and|so|then)\b/,
    /^(it|that|this|those|these)\b/,
  ];
  if (dependent.some((re) => re.test(lower))) return false;
  return text.trim().length >= 8;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const POSITIVE_WEIGHTS = {
  concreteAnchor: 2,
  catPov: 2,
  flavor: 2,
  fitsLength: 2,
  hasMood: 1,
  standalone: 1,
};

const NEGATIVE_WEIGHTS = {
  bannedPhrase: -4,
  assistantVoice: -4,
  unsupportedEntity: -5,
  genericSentiment: -3,
  tooLong: -2,
  empty: -10,
};

/**
 * Score a cat voice line for shareability + register.
 *
 * Pure function. Returns score, ok flag, reasons[], and optional
 * mechanical repair. Caller decides what to do on failure (retry
 * with LLM, mechanical repair, fall back to a safe alternative).
 */
export function evaluateCatVoiceLine(
  text: string,
  surface: VoiceSurface,
  context: VoiceQualityContext = {},
): VoiceQualityResult {
  const reasons: string[] = [];
  let score = 0;

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      score: NEGATIVE_WEIGHTS.empty,
      reasons: ['Output is empty.'],
    };
  }

  // ── Negative signals (hard fails first) ───────────────────────────
  const unsupportedEntities = findUnsupportedNamedEntities(trimmed, context);
  if (unsupportedEntities.length > 0) {
    score += NEGATIVE_WEIGHTS.unsupportedEntity;
    reasons.push(
      `Unsupported named entity/entities (${unsupportedEntities.join(', ')}) — rewrite without naming anyone/anything not in the cat's known memory.`,
    );
  }

  const bannedHits = containsBanned(trimmed);
  if (bannedHits.length > 0) {
    score += NEGATIVE_WEIGHTS.bannedPhrase;
    reasons.push(
      `Banned phrase(s) detected (${bannedHits.join(', ')}) — rewrite without them.`,
    );
  }

  // Assistant-voice / therapy-speak detection (subset of banned, but
  // categorised separately for analytics + retry prompts).
  const assistantPatterns = [
    /\bas an ai\b/i,
    /\bas a language model\b/i,
    /\bi am here for you\b/i,
    /\bi'm here for you\b/i,
    /\bhow can i (help|assist)\b/i,
    /\bthat sounds (hard|difficult|tough)\b/i,
  ];
  const hasAssistantVoice = assistantPatterns.some((re) => re.test(trimmed));
  if (hasAssistantVoice) {
    score += NEGATIVE_WEIGHTS.assistantVoice;
    reasons.push(
      'Reads as an AI assistant, not a cat — rewrite from the cat\'s first-person POV with no therapy/assistant register.',
    );
  }

  const genericHits = containsGenericPraise(trimmed);
  if (genericHits.length > 0) {
    score += NEGATIVE_WEIGHTS.genericSentiment;
    reasons.push(
      `Generic sentiment ("${genericHits[0]}") — replace with a specific observation about today or a known item.`,
    );
  }

  // Length
  const wc = wordCount(trimmed);
  const cap = SURFACE_WORD_CAP[surface];
  if (wc > cap) {
    score += NEGATIVE_WEIGHTS.tooLong;
    reasons.push(
      `Too long for ${surface} (${wc} words, cap ${cap}) — tighten to a single screenshot-shaped line.`,
    );
  }

  // ── Positive signals ─────────────────────────────────────────────
  if (hasConcreteAnchor(trimmed, context)) score += POSITIVE_WEIGHTS.concreteAnchor;
  if (hasCatPointOfView(trimmed)) score += POSITIVE_WEIGHTS.catPov;
  if (hasFlavor(trimmed)) score += POSITIVE_WEIGHTS.flavor;
  if (wc <= cap) score += POSITIVE_WEIGHTS.fitsLength;
  if (context.moodTag && context.moodTag.length > 0) score += POSITIVE_WEIGHTS.hasMood;
  if (isStandaloneQuote(trimmed)) score += POSITIVE_WEIGHTS.standalone;

  // ── Threshold ────────────────────────────────────────────────────
  const threshold = context.isMedicalContext && surface === 'chat'
    ? MEDICAL_CHAT_THRESHOLD
    : SURFACE_THRESHOLD[surface];

  // Hard fails: an unsupported entity or assistant voice make this
  // un-ok regardless of score. Trust over score.
  const hardFail = unsupportedEntities.length > 0 || hasAssistantVoice;
  const ok = !hardFail && score >= threshold;

  // Mechanical repair — applied opportunistically when the issue is
  // local (length, trailing filler, banned phrase stripping). Never
  // invents content.
  let repaired: string | undefined;
  if (!ok) {
    const localRepair = mechanicalRepair(trimmed, surface, context);
    if (localRepair && localRepair !== trimmed) {
      repaired = localRepair;
    }
  }

  return {
    ok,
    score,
    reasons,
    ...(repaired ? { repaired } : {}),
  };
}

// ---------------------------------------------------------------------------
// Mechanical repair — for issues we can fix locally without inventing
// ---------------------------------------------------------------------------

/**
 * Apply local, no-invention fixes:
 *   - strip trailing filler (em-dash followed by hedge clauses)
 *   - chop down to first sentence if too long
 *   - cap word count at the surface limit
 *   - delete banned phrases (preserves surrounding sentence shape)
 *
 * Returns the repaired text, or the original if no repair was applicable.
 * NEVER adds new words/facts — repair is subtractive only.
 */
function mechanicalRepair(
  text: string,
  surface: VoiceSurface,
  _context: VoiceQualityContext,
): string {
  let s = text.trim();
  // 1. Strip banned phrases (preserving sentence structure)
  for (const banned of BANNED_PHRASES) {
    // Word-boundary insensitive replace
    const re = new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    s = s.replace(re, '').replace(/\s+/g, ' ').trim();
  }
  // 2. First sentence only if multi-sentence + over cap
  if (wordCount(s) > SURFACE_WORD_CAP[surface]) {
    const firstSentence = s.match(/^[^.!?]*[.!?]/);
    if (firstSentence) s = firstSentence[0].trim();
  }
  // 3. Word-cap by truncation if still over
  if (wordCount(s) > SURFACE_WORD_CAP[surface]) {
    const words = s.split(/\s+/).slice(0, SURFACE_WORD_CAP[surface]);
    s = words.join(' ');
    if (!/[.!?]$/.test(s)) s += '.';
  }
  // 4. Clean up double punctuation introduced by removal
  s = s.replace(/\s+([.!?,])/g, '$1');
  s = s.replace(/([.!?])\1+/g, '$1');
  return s.trim();
}

// ---------------------------------------------------------------------------
// Retry prompt builder
// ---------------------------------------------------------------------------

/**
 * Compose the violations string that a caller can inject into a retry
 * LLM call. Caller appends this to their existing user prompt with
 * "your previous attempt failed because: ..." framing. Returns null
 * when there's nothing to retry on.
 */
export function buildRetryDirective(
  result: VoiceQualityResult,
  surface: VoiceSurface,
): string | null {
  if (result.ok || result.reasons.length === 0) return null;
  const surfaceLabel: Record<VoiceSurface, string> = {
    chat: 'chat reply',
    diary_card: 'diary card line',
    postcard: 'postcard caption',
  };
  const cap = SURFACE_WORD_CAP[surface];
  const fixList = result.reasons.map((r) => `  - ${r}`).join('\n');
  return [
    `Rewrite the ${surfaceLabel[surface]} to be more specific, quotable, and cat-like.`,
    '',
    'Fix ALL of these:',
    fixList,
    '',
    `Hard rules:`,
    `  - First-person cat voice. No assistant/therapy register.`,
    `  - ≤ ${cap} words.`,
    `  - Only reference people / pets / objects from the provided context. NEVER invent.`,
    `  - No generic praise ("today was special", "you make me happy", etc.).`,
    `  - Specific attention > Hallmark sweetness.`,
    `  - Make it a line a user would screenshot.`,
  ].join('\n');
}
