/**
 * Fact retrieval — pinned-context layer for chat.
 *
 * The chat system prompt carries 5-10k tokens of memory: diary
 * entries, mood arc, named subjects, recent triage, anticipation
 * events, life events, self-facts. The recall benchmark
 * (`scripts/bench-recall.py`) showed gpt-4o-mini scoring only ~55%
 * on questions where the data IS there — the model just doesn't
 * always pull it out. Especially weak on medical context (17% recall)
 * and "catch me up across multiple tiers" (78% — better but not great).
 *
 * The fix: pre-rank the facts by their relevance to the current user
 * message, and PIN the top 5-7 at the END of the system prompt (the
 * highest-attention slot for the next reply). The detail stays in
 * the tier-sections; this layer just tells the model "for THIS
 * reply, these are the items to cite."
 *
 * Approach: heuristic keyword matching, no extra LLM call. Free,
 * fast, deterministic. The heuristic is open to upgrading to
 * embedding similarity later if the recall plateau becomes a problem.
 *
 * See: marketing/chat-as-viral-lever.md, docs/CHAT-PROMPT-ARCH.md.
 */
import type { CatContext } from './catContext';
import type {
  AnticipationEvent,
  LifeEvent,
  MoodArc,
} from './diaryMemory';
import type { SelfFact } from '../state/selfFactsStore';
import { embed } from '../ai/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FactTier =
  | 'medical'        // recent triage / sickness / recovery
  | 'subject'        // named people & pets
  | 'diary'          // recent diary entries (last few days)
  | 'anticipation'   // upcoming birthday / vet / gotcha-day
  | 'mood_arc'       // 5-day mood pattern
  | 'life_event'     // landmark moments (past sicknesses, recoveries)
  | 'self_fact'      // user-told facts ("you love tuna")
  | 'today'          // today's check-in mood + appetite
  | 'vaccination'    // last shot per vaccine + next due + overdue
  | 'medication_log' // historical dose adherence (separate from profile.medications)
  | 'weight_log'     // weight history + 90-day trend
  | 'appointment'    // vet appointments (next + recent completed)
  | 'pain_score'     // recent FGS measurements
  | 'profile_field'  // breed, age, DOB, weight (current), name, lifestyle, sex
  | 'reminder'       // medication reminder time, weekly check-in time
  | 'world_object'   // real objects/furniture/toys (the green chair, wand toy)
  | 'world_place'    // real places (the garden, the kitchen window)
  | 'world_environment'; // ephemeral environmental context (snow today, rain)

export type Fact = {
  id: string;
  /** The line that gets pinned into the prompt verbatim. */
  text: string;
  tier: FactTier;
  /**
   * Tokens (lowercased) that, if present in the user's message, boost
   * this fact's relevance. Subject-specific facts include the subject
   * name; medical facts include health vocabulary; etc.
   */
  keywords: string[];
  /** 0-10 base priority. Higher = more important by default. */
  priority: number;
};

// ---------------------------------------------------------------------------
// Question-intent patterns — boost specific tiers when the user asks
// a question whose intent matches.
// ---------------------------------------------------------------------------

const INTENT_PATTERNS: Array<{
  re: RegExp;
  boostTiers: FactTier[];
  boost: number;
}> = [
  // Health / current-feeling
  {
    re: /\b(sick|unwell|ill|hurt|pain|how (?:are|do) you|how do you feel|are you ok|feeling|recover|throw\s?up|vomit)\b/i,
    boostTiers: ['medical', 'today', 'mood_arc'],
    boost: 8,
  },
  // Recent past — "lately", "this week", "how have you been"
  {
    re: /\b(lately|recent(?:ly)?|past (?:few )?(?:days|week)|how have you been|this week)\b/i,
    boostTiers: ['mood_arc', 'diary', 'medical'],
    boost: 6,
  },
  // Today specifically
  {
    re: /\b(today|right now|currently|so far)\b/i,
    boostTiers: ['today', 'diary'],
    boost: 5,
  },
  // Future / upcoming
  {
    re: /\b(coming up|upcoming|soon|next (?:week|day|month)|when(?:'s)?|birthday|vet|appointment)\b/i,
    boostTiers: ['anticipation'],
    boost: 7,
  },
  // Memory / past landmarks
  {
    re: /\b(remember|last time|before|the time when|that day|when (?:were you|did you))\b/i,
    boostTiers: ['life_event', 'diary'],
    boost: 6,
  },
  // People / pets
  {
    re: /\b(who|visit(?:ed|or)?|around|been by|family|guest|came over)\b/i,
    boostTiers: ['subject'],
    boost: 5,
  },
  // Food / preferences / taste
  {
    re: /\b(food|eat|hungry|favourite|favorite|like|love|hate|prefer)\b/i,
    boostTiers: ['self_fact'],
    boost: 4,
  },
  // Gone / missed
  {
    re: /\b(miss(?:ed)? (?:me|you)|while .* gone|gone (?:for|today)|away)\b/i,
    boostTiers: ['diary', 'mood_arc'],
    boost: 5,
  },
  // Catch-me-up / anything happening / what's up — now also pulls
  // weight trend + medication adherence + appointments + vaccinations
  // so the cat reports the full health picture, not just diary/mood.
  {
    re: /\b(catch me up|catch up|what'?s (?:up|new|happening|going on)|anything new|fill me in)\b/i,
    boostTiers: [
      'medical', 'mood_arc', 'diary', 'anticipation', 'subject',
      'weight_log', 'medication_log', 'appointment', 'vaccination',
    ],
    boost: 4,
  },
  // Vaccinations / shots / boosters
  {
    re: /\b(shot|vaccin(?:e|ation|ated)|booster|fvrcp|rabies|felv|bordetella|due for|overdue)\b/i,
    boostTiers: ['vaccination'],
    boost: 8,
  },
  // Medication doses — adherence history (NOT the profile's medications list)
  {
    re: /\b(dose|dosed|pill|medicine|medication|take(?:n)? (?:my|your|the) pill|miss(?:ed)? (?:my|your|the) (?:pill|dose|meds))\b/i,
    boostTiers: ['medication_log'],
    boost: 7,
  },
  // Weight & trend
  {
    re: /\b(weight|heavy|light|gained?|lost|losing|gaining|kilos?|kgs?|pounds?|lbs?|fat|skinny|chubby|trim|bcs|body condition)\b/i,
    boostTiers: ['weight_log', 'profile_field'],
    boost: 7,
  },
  // Appointments / vet visits — explicit
  {
    re: /\b(appointment|vet visit|vet appointment|next vet|seeing the vet|going to the vet|annual)\b/i,
    boostTiers: ['appointment', 'anticipation'],
    boost: 8,
  },
  // Pain / discomfort / FGS
  {
    re: /\b(pain|hurts?|hurting|grimace|ouch|sore|tender|ache)\b/i,
    boostTiers: ['pain_score', 'medical'],
    boost: 7,
  },
  // Profile-field reads (breed, age, name, sex, etc.) — not in
  // existing tiers, surface them as their own category.
  {
    re: /\b(breed|race|kind of cat|type of cat|how old|age|years? old|months? old|name|called|sex|boy|girl|male|female|spayed|neutered|fixed|indoor|outdoor)\b/i,
    boostTiers: ['profile_field'],
    boost: 6,
  },
  // Reminders — "when is X due", med reminder time
  {
    re: /\b(reminder|when (?:is|do|am i|am I) (?:supposed|due|expected)|due (?:to|for) (?:take|have)|schedule|alarm)\b/i,
    boostTiers: ['reminder'],
    boost: 6,
  },
  // World objects — furniture, toys, things. Broad keyword set covering
  // the typical things a cat owner would mention.
  {
    re: /\b(chair|sofa|couch|bed|rug|blanket|cushion|pillow|carpet|curtain|window|door|shelf|bookshelf|nightstand|table|desk|tree|tower|condo|scratch(?:er|ing post)?|carrier|crate|bowl|dish|cup|mug|toy|wand|laser|mouse|ball|feather|kicker|fountain|litter|box|cardboard)\b/i,
    boostTiers: ['world_object'],
    boost: 8,
  },
  // World places — rooms, outdoor, locations in the home
  {
    re: /\b(garden|yard|porch|balcony|deck|hallway|stairs|kitchen|bathroom|bedroom|living room|sunroom|outside|outdoors|window(?:sill)?|doorway|patio|fire ?place|hearth|nook|corner|spot)\b/i,
    boostTiers: ['world_place'],
    boost: 8,
  },
  // Environment — ephemeral world state (weather, today's outside)
  {
    re: /\b(snow|rain|storm|wind|sun(?:ny|shine)?|cloud|cold|hot|warm|chilly|freezing|weather|outside today|outdoors today)\b/i,
    boostTiers: ['world_environment'],
    boost: 7,
  },
];

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function scoreFact(userMessage: string, fact: Fact): number {
  const lower = userMessage.toLowerCase();
  let score = fact.priority;

  // Direct keyword match on the fact's own keywords
  if (fact.keywords.some((k) => k && lower.includes(k.toLowerCase()))) {
    score += 6;
  }

  // Intent-pattern boost — only the FIRST matching pattern fires
  // (otherwise "how have you been today" double-boosts mood_arc).
  for (const { re, boostTiers, boost } of INTENT_PATTERNS) {
    if (re.test(lower) && boostTiers.includes(fact.tier)) {
      score += boost;
      break;
    }
  }

  return score;
}

/**
 * Catch-me-up pattern — when the user asks for a sweeping update, we
 * bump the limit and let multiple tiers in. The previous 7-fact
 * cap was crowding out tiers on these prompts. See
 * scripts/bench-recall-pinned.py for the regression that motivated
 * this.
 */
const CATCH_ME_UP_RE =
  /\b(catch me up|catch up|what'?s (?:up|new|happening|going on)|anything new|fill me in|update me|the gossip)\b/i;

/**
 * Per-tier caps — prevent a single tier from monopolising the picks.
 * The score function naturally clusters scores by tier (a question
 * about Bella scores all 3 subject facts highly), which can starve
 * out the other tiers in a fixed top-N selection. Caps re-balance.
 *
 * Tuning notes:
 *   - `diary` was 3 (unbounded by tier in v1) → now 2. Three diary
 *      entries was the most common over-fill mode and the 3rd entry
 *      rarely added new signal vs the first two.
 *   - `self_fact` capped at 2 to leave room for other tiers.
 *   - `subject` stays at 3 so Bella + Mom + Lucas can all fit when
 *      the user asks "who's been around".
 */
const TIER_CAPS: Record<FactTier, number> = {
  medical: 2,
  subject: 3,
  diary: 2,
  anticipation: 2,
  mood_arc: 1,
  life_event: 2,
  self_fact: 2,
  today: 1,
  vaccination: 2,     // last given + next-due is the typical pair
  medication_log: 2,  // last dose + adherence summary
  weight_log: 1,      // latest + trend collapses into one fact
  appointment: 2,     // next + recent completed
  pain_score: 1,      // latest pain reading is enough
  profile_field: 3,   // breed + age + weight at most for "tell me about yourself"
  reminder: 2,        // med reminder + weekly check-in
  world_object: 3,    // up to 3 real objects/furniture/toys per reply
  world_place: 2,     // up to 2 real places per reply
  world_environment: 1, // single environmental context (today's weather)
};

/**
 * Pick the top N most-relevant facts for the user's current message,
 * with per-tier caps to prevent one tier monopolising. Default limit
 * is 7; a "catch me up" pattern bumps it to 9 so multi-tier sweeps
 * have room to breathe.
 *
 * Stable: ties broken by original order in the input array (which is
 * built tier-by-tier so the ordering is predictable).
 */
export function selectRelevantFacts(opts: {
  userMessage: string;
  facts: Fact[];
  limit?: number;
}): Fact[] {
  const isCatchMeUp = CATCH_ME_UP_RE.test(opts.userMessage);
  const limit = opts.limit ?? (isCatchMeUp ? 9 : 7);

  // Score, sort desc. Tiny epsilon based on input index makes ties
  // stable.
  const scored = opts.facts.map((f, i) => ({
    f,
    s: scoreFact(opts.userMessage, f) - i * 0.001,
  }));
  scored.sort((a, b) => b.s - a.s);

  // Take with per-tier caps. Once a tier hits its cap we skip
  // further picks from it, freeing slots for the next-best fact in
  // a different tier.
  const selected: Fact[] = [];
  const tierCounts: Partial<Record<FactTier, number>> = {};
  for (const { f } of scored) {
    if (selected.length >= limit) break;
    const cap = TIER_CAPS[f.tier];
    const used = tierCounts[f.tier] ?? 0;
    if (used >= cap) continue;
    selected.push(f);
    tierCounts[f.tier] = used + 1;
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Embedding-based scorer (alternative to the keyword + intent heuristic).
//
// Behind the EXPO_PUBLIC_FACT_SCORER=embedding flag. Same shape as
// `selectRelevantFacts` (per-tier caps, catch-me-up bump, top-N
// truncation), but scoring is cosine similarity between the user
// message embedding and each fact's embedding instead of regex
// keyword matching.
//
// Why this exists: the keyword scorer can't catch synonyms ("bleh"
// for "off"), paraphrase ("how's the body holding up?" for "are you
// sick?"), or new vocabulary it hasn't been hand-trained on. The
// recall benchmark caps out around 62% with keywords; embeddings
// should lift that materially.
//
// Cost: one embedding per turn (~$0.0001) for the user message, plus
// one per UNIQUE fact text (cached). Fact embeddings are cached by
// text content — facts whose text is identical between turns reuse
// the cached vector. Fresh facts (new diary entry, new world entry)
// pay the embedding cost once, then ride the cache.
//
// Latency: typical ~150-300ms wall-clock added per chat turn (one
// embed call serially in front of `completeText`). Could be reduced
// by batching all fact texts in one HTTPS call — left as future
// work; the prototype keeps it simple.
// ---------------------------------------------------------------------------

/**
 * Process-lifetime cache from fact text → embedding vector. Keyed by
 * the literal text so dedup happens automatically across facts that
 * happen to render identical strings (rare, but free). Cleared on
 * app restart — first-turn after launch pays a fresh embedding cost.
 *
 * Bounded soft-cap: 500 entries. When exceeded, oldest insertion
 * order is evicted via Map iteration order. 500 × 1536 floats × 4
 * bytes ≈ 3 MB heap — comfortable.
 */
const FACT_EMBEDDING_CACHE = new Map<string, number[]>();
const FACT_EMBEDDING_CACHE_MAX = 500;

function rememberFactEmbedding(text: string, vec: number[]): void {
  if (FACT_EMBEDDING_CACHE.size >= FACT_EMBEDDING_CACHE_MAX) {
    // Drop the oldest insertion (Map iteration order).
    const firstKey = FACT_EMBEDDING_CACHE.keys().next().value;
    if (firstKey !== undefined) FACT_EMBEDDING_CACHE.delete(firstKey);
  }
  FACT_EMBEDDING_CACHE.set(text, vec);
}

/**
 * Cosine similarity in [-1, 1] (typically [0, 1] for OpenAI
 * embeddings which live on a hyperplane). Defensive against
 * different-dimension or all-zero vectors — returns 0 in degenerate
 * cases rather than throwing or returning NaN.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compute (or hit cache for) the embedding of a fact. Includes the
 * tier label as a soft prefix — "[medical] 12 days ago: triage scan"
 * — which gives the embedding a tiny tier-aware nudge so two facts
 * with overlapping vocabulary but different tiers (e.g. "vet
 * appointment" anticipation vs "vet visit" life event) separate
 * cleanly in vector space.
 */
async function embedFact(fact: Fact): Promise<number[]> {
  const key = `[${fact.tier}] ${fact.text}`;
  const cached = FACT_EMBEDDING_CACHE.get(key);
  if (cached) return cached;
  const vec = await embed(key, 'embedding_fact_score');
  rememberFactEmbedding(key, vec);
  return vec;
}

/**
 * Embedding-based fact selector. Drop-in replacement for
 * `selectRelevantFacts` when the feature flag is on. Same per-tier
 * caps, same catch-me-up bump, same return shape — only the scoring
 * function changes.
 *
 * Failure mode: if the embedding call throws (network, API error),
 * we fall back to the keyword scorer transparently so the chat
 * pipeline continues to work. The caller sees a result either way;
 * the tradeoff (stale recall scoring) is preferable to a chat reply
 * that fails because the ranker exploded.
 */
export async function selectRelevantFactsByEmbedding(opts: {
  userMessage: string;
  facts: Fact[];
  limit?: number;
}): Promise<Fact[]> {
  const isCatchMeUp = CATCH_ME_UP_RE.test(opts.userMessage);
  const limit = opts.limit ?? (isCatchMeUp ? 9 : 7);

  let queryVec: number[];
  let factVecs: Array<{ f: Fact; v: number[] }>;
  try {
    // Embed user message + every fact in parallel. The cache makes
    // repeat-fact embeds free, so the dominant cost is the user-
    // message embed (always fresh) and any facts whose text changed
    // since last turn (typically 0-2 — recent diary entry, new
    // world entry).
    const [qv, fvs] = await Promise.all([
      embed(opts.userMessage, 'embedding_fact_score'),
      Promise.all(opts.facts.map(async (f) => ({ f, v: await embedFact(f) }))),
    ]);
    queryVec = qv;
    factVecs = fvs;
  } catch (e) {
    console.warn('[factRetrieval] embedding scorer failed, falling back to keyword:', e);
    return selectRelevantFacts(opts);
  }

  // Score by cosine similarity. Stability epsilon (smaller than
  // keyword scorer's because cosine deltas are themselves small) so
  // ties break by input order.
  const scored = factVecs.map(({ f, v }, i) => ({
    f,
    s: cosineSimilarity(queryVec, v) - i * 0.00001,
  }));
  scored.sort((a, b) => b.s - a.s);

  // Same per-tier caps as keyword path — preserves the rebalancing
  // behaviour that prevents subject-heavy "who" questions from
  // monopolising the picks.
  const selected: Fact[] = [];
  const tierCounts: Partial<Record<FactTier, number>> = {};
  for (const { f } of scored) {
    if (selected.length >= limit) break;
    const cap = TIER_CAPS[f.tier];
    const used = tierCounts[f.tier] ?? 0;
    if (used >= cap) continue;
    selected.push(f);
    tierCounts[f.tier] = used + 1;
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Render — produces the pinned header text
// ---------------------------------------------------------------------------

/**
 * Render the relevant-facts header. Intentionally short — it's a
 * focusing prompt, not a context dump. The full data still lives in
 * the tier-sections of the system prompt.
 */
export function renderFactsHeader(facts: Fact[]): string {
  if (facts.length === 0) return '';
  const lines: string[] = [];
  lines.push('');
  lines.push('## ⚠️ MOST RELEVANT FACTS FOR THIS REPLY');
  lines.push('');
  lines.push(
    'These items are picked from your memory specifically because they MATCH what your human just asked. CITE them — by name, date, number, or specific detail — in your reply if they relate to the question. The human notices when you don\'t. Do NOT invent specifics that are not in your data — if a detail is missing, refer to it loosely or admit you do not remember.',
  );
  lines.push('');
  for (const f of facts) {
    lines.push(`- ${f.text}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Build Fact[] from the chat context inputs
// ---------------------------------------------------------------------------

type DiaryDigestEntry = {
  date: string;
  mood: string | null;
  summary: string;
  isEmptyDay: boolean;
};

type SubjectDigest = {
  name: string;
  kind: 'person' | 'pet' | 'other';
  species?: string;
  relationship?: string;
  appearances: number;
  lastSeen: string;
  vibe?: string;
};

function daysSinceISO(iso: string, now = Date.now()): number {
  try {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return 999;
    return Math.floor((now - t) / (24 * 60 * 60 * 1000));
  } catch {
    return 999;
  }
}

const SELF_FACT_STOPWORDS = new Set([
  'you', 'i', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'have', 'has',
  'had', 'do', 'does', 'did', 'and', 'or', 'but', 'to', 'of', 'in', 'on',
  'at', 'for', 'with', 'by', 'from', 'as', 'this', 'that', 'these', 'those',
  'it', 'be', 'been', 'being', 'will', 'would', 'should', 'could',
]);

function selfFactKeywords(fact: string): string[] {
  return fact
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SELF_FACT_STOPWORDS.has(w));
}

/**
 * Build the full Fact[] from everything chat.ts has assembled. Order
 * matters mildly: ties in scoring are broken by insertion order, so
 * we list higher-priority tiers first.
 */
export function buildFactsFromChatContext(opts: {
  ctx: CatContext;
  diaryEntries: DiaryDigestEntry[];
  subjects: SubjectDigest[];
  selfFacts: SelfFact[];
  moodArc?: MoodArc;
  lifeEvents?: LifeEvent[];
  anticipationEvents?: AnticipationEvent[];
  /**
   * Ambient weather snapshot from `weatherContext.ts`. When present,
   * a `world_environment` fact is emitted so the cat can reference
   * today's weather naturally ("snow today, I am not pleased").
   * Null when location permission isn't granted or fetch failed.
   */
  weatherSnapshot?: { narrative: string; weather_code: number; temp_c: number } | null;
}): Fact[] {
  const facts: Fact[] = [];

  // ── Today's mood + appetite (audit 2026-05-14 round 11 cleanup) ──
  // Pre-fix: this used `mostRecentMood` while LABELLING the fact as
  // "Today's check-in:" — same leak the chat fix closed. A yesterday
  // 'off' check-in with no check-in today would still surface to the
  // fact-retrieval layer as if it were today. Now uses the
  // CheckinPattern's `todayMood`/`todayAppetite` fields which are
  // null when no check-in landed today.
  const cp = opts.ctx.checkinPatterns;
  const todayMood = cp?.todayMood ?? null;
  const todayAppetite = cp?.todayAppetite ?? null;
  if (todayMood || todayAppetite) {
    const parts: string[] = [];
    if (todayMood) parts.push(`mood ${todayMood}`);
    if (todayAppetite) parts.push(`appetite ${todayAppetite}`);
    facts.push({
      id: 'today-checkin',
      text: `Today's check-in: ${parts.join(', ')}.`,
      tier: 'today',
      keywords: ['today', 'mood', 'appetite', 'feel', 'now'],
      priority: 6,
    });
  }

  // ── Recent triage / medical (highest priority — historically dropped) ──
  for (const t of opts.ctx.recentTriage.slice(0, 2)) {
    const dayLbl =
      t.daysAgo === 0
        ? 'earlier today'
        : `${t.daysAgo} day${t.daysAgo === 1 ? '' : 's'} ago`;
    facts.push({
      id: `triage-${t.daysAgo}d`,
      text: `${dayLbl}: triage scan tier "${t.tier}" (score ${t.score}/100). Primary concern: ${t.primaryConcern}.`,
      tier: 'medical',
      keywords: [
        'sick', 'unwell', 'vomit', 'health', 'better', 'recover',
        'concern', 'worried', 'pain', t.primaryConcern.toLowerCase(),
      ],
      priority: 9,
    });
  }

  // ── Anticipation events ──
  for (const e of opts.anticipationEvents ?? []) {
    const tierKw =
      e.type === 'birthday'
        ? ['birthday', 'born', 'cake', 'party']
        : e.type === 'gotcha_day'
          ? ['anniversary', 'joined', 'gotcha', 'adopted', 'family']
          : e.type === 'vet_appointment'
            ? ['vet', 'appointment', 'place', 'doctor']
            : ['month', 'milestone'];
    facts.push({
      id: `antic-${e.type}-${e.date}`,
      text: e.label.charAt(0).toUpperCase() + e.label.slice(1) + '.',
      tier: 'anticipation',
      keywords: [...tierKw, 'coming', 'soon', 'next', 'upcoming', 'when'],
      priority: 7,
    });
  }

  // ── Mood arc ──
  if (opts.moodArc && opts.moodArc.recentMoods.length >= 3) {
    const moodLine = opts.moodArc.recentMoods.slice(0, 5).join(', ');
    const dirLine = opts.moodArc.direction
      ? ` Direction: ${opts.moodArc.direction.toUpperCase()}.`
      : '';
    facts.push({
      id: 'mood-arc',
      text: `Recent mood arc (newest first): ${moodLine}.${dirLine}`,
      tier: 'mood_arc',
      keywords: [
        'week', 'feeling', 'lately', 'past', 'mood', 'pattern',
        'how have you been', 'recently',
      ],
      priority: 6,
    });
  }

  // ── Life events ──
  for (const e of (opts.lifeEvents ?? []).slice(0, 3)) {
    facts.push({
      id: `life-${e.type}-${e.daysAgo}d`,
      text: `${e.label} (${e.daysAgo} day${e.daysAgo === 1 ? '' : 's'} ago).`,
      tier: 'life_event',
      keywords: ['remember', 'before', 'last time', 'when', 'past'],
      priority: 5,
    });
  }

  // ── Subjects (per name) ──
  for (const s of opts.subjects) {
    const days = daysSinceISO(s.lastSeen);
    const seen =
      days === 0
        ? 'today'
        : days === 1
          ? 'yesterday'
          : days < 30
            ? `${days} days ago`
            : 'over a month ago';
    const rel = s.relationship ? `, ${s.relationship}` : '';
    const vibe = s.vibe ? ` Vibe: ${s.vibe}.` : '';
    facts.push({
      id: `subject-${s.name}`,
      text: `${s.name} (${s.kind}${rel}): ${s.appearances} appearance${s.appearances === 1 ? '' : 's'} this month. Last seen ${seen}.${vibe}`,
      tier: 'subject',
      keywords: [
        s.name.toLowerCase(),
        'who', 'visit', 'around', 'people',
        ...(s.kind === 'pet' ? ['pet', 'animal'] : []),
        ...(s.relationship ? [s.relationship.toLowerCase()] : []),
      ],
      priority: 5,
    });
  }

  // ── Recent diary (top 3 newest, including today) ──
  for (const d of opts.diaryEntries.slice(0, 3)) {
    const summary = d.summary.length > 140
      ? d.summary.slice(0, 140) + '…'
      : d.summary;
    const moodPart = d.mood ? ` [mood: ${d.mood}]` : '';
    const tag = d.isEmptyDay ? ' (a quiet day)' : '';
    facts.push({
      id: `diary-${d.date}`,
      text: `${d.date}${moodPart}${tag}: "${summary}"`,
      tier: 'diary',
      keywords: ['today', 'yesterday', 'recent', 'happened', 'did', 'wrote'],
      priority: 4,
    });
  }

  // ── Self-facts ──
  for (const f of opts.selfFacts.slice(0, 6)) {
    facts.push({
      id: `self-${f.fact.slice(0, 20)}`,
      text: f.fact,
      tier: 'self_fact',
      keywords: selfFactKeywords(f.fact),
      priority: 4,
    });
  }

  // ── Vaccinations (next due + overdue + last 1) ──
  // The cat needs to know when its shots are due and which one is
  // overdue. These become pin-able when the user says "shot",
  // "vaccine", "booster", "due for".
  if (opts.ctx.vaccinations.nextDue) {
    const v = opts.ctx.vaccinations.nextDue;
    facts.push({
      id: `vacc-next-${v.vaccine}`,
      text: `Next vaccine due: ${v.vaccine} on ${v.next_due} (in ${v.daysUntil} day${v.daysUntil === 1 ? '' : 's'}).`,
      tier: 'vaccination',
      keywords: ['shot', 'vaccine', 'vaccination', 'booster', 'due', v.vaccine.toLowerCase()],
      priority: 7,
    });
  }
  for (const o of opts.ctx.vaccinations.overdue.slice(0, 2)) {
    facts.push({
      id: `vacc-overdue-${o.vaccine}`,
      text: `OVERDUE: ${o.vaccine} was due ${o.next_due} (${o.daysOverdue} day${o.daysOverdue === 1 ? '' : 's'} late).`,
      tier: 'vaccination',
      keywords: ['shot', 'vaccine', 'overdue', 'late', o.vaccine.toLowerCase()],
      priority: 9, // overdue beats next-due
    });
  }
  if (opts.ctx.vaccinations.history.length > 0) {
    const last = opts.ctx.vaccinations.history[0];
    facts.push({
      id: `vacc-last-${last.vaccine}`,
      text: `Last vaccine: ${last.vaccine} on ${last.given_on}${last.administered_by ? ` by ${last.administered_by}` : ''}.`,
      tier: 'vaccination',
      keywords: ['last shot', 'last vaccine', 'recent shot', last.vaccine.toLowerCase()],
      priority: 6,
    });
  }

  // ── Medication-dose adherence (history) ──
  // Different from profile.medications (the "I'm on X drug" list).
  // This tracks "have you taken your pill today / how many times this
  // week did you take it." Pinned when user mentions dose / pill /
  // missed / took.
  for (const m of opts.ctx.medicationDoses.perMed.slice(0, 2)) {
    const lastStr = m.lastDoseAt
      ? `last dose ${m.lastDoseAt.slice(0, 10)} ${m.lastDoseAt.slice(11, 16)}`
      : 'no doses logged';
    facts.push({
      id: `med-dose-${m.medication.slice(0, 20)}`,
      text: `${m.medication}: ${m.dosesInWindow} dose${m.dosesInWindow === 1 ? '' : 's'} logged in last ${opts.ctx.recencyWindowDays} days, ${lastStr}.`,
      tier: 'medication_log',
      keywords: [
        'dose', 'pill', 'medicine', 'medication', 'took', 'taken', 'missed',
        m.medication.toLowerCase().split(/\s+/)[0],
      ],
      priority: 6,
    });
  }

  // ── Weight history + 90-day trend ──
  if (opts.ctx.weightHistory.latest) {
    const w = opts.ctx.weightHistory.latest;
    const trend = opts.ctx.weightHistory.trend90d;
    let text = `Weight: ${w.weight_kg} kg as of ${w.measured_at.slice(0, 10)}`;
    if (w.bcs != null) text += ` (BCS ${w.bcs}/9)`;
    text += '.';
    if (trend) {
      const sign = trend.deltaKg > 0 ? '+' : '';
      const word = trend.direction === 'stable' ? 'stable' : trend.direction === 'up' ? 'gaining' : 'losing';
      text += ` 90-day trend: ${word} (${sign}${trend.deltaKg} kg, ${trend.fromKg} → ${trend.toKg} kg).`;
    }
    facts.push({
      id: 'weight-latest',
      text,
      tier: 'weight_log',
      keywords: ['weight', 'kg', 'kilos', 'heavy', 'light', 'gained', 'lost', 'trend', 'bcs'],
      priority: 6,
    });
  }

  // ── Appointments (next + last completed) ──
  if (opts.ctx.appointments.next) {
    const a = opts.ctx.appointments.next;
    const vetStr = a.vet ? ` with ${a.vet}` : '';
    const reasonStr = a.reason ? ` — ${a.reason}` : '';
    facts.push({
      id: `appt-next-${a.scheduled_for.slice(0, 10)}`,
      text: `Next vet appointment: ${a.scheduled_for.slice(0, 16).replace('T', ' ')}${vetStr}${reasonStr} (${a.title}, in ${a.daysUntil} day${a.daysUntil === 1 ? '' : 's'}).`,
      tier: 'appointment',
      keywords: ['appointment', 'vet', 'visit', 'next', 'doctor', 'place', 'soon', 'when'],
      priority: 8,
    });
  }
  if (opts.ctx.appointments.recentCompleted.length > 0) {
    const c = opts.ctx.appointments.recentCompleted[0];
    const outcomeStr = c.outcome_notes ? ` — outcome: ${c.outcome_notes.slice(0, 80)}` : '';
    facts.push({
      id: `appt-last-${c.scheduled_for.slice(0, 10)}`,
      text: `Last vet visit: ${c.title} on ${c.scheduled_for.slice(0, 10)} (${c.daysAgo} day${c.daysAgo === 1 ? '' : 's'} ago)${outcomeStr}.`,
      tier: 'appointment',
      keywords: ['last vet', 'last visit', 'last appointment', 'recent vet'],
      priority: 5,
    });
  }

  // ── Pain scores ──
  if (opts.ctx.painScores.recent.length > 0) {
    const p = opts.ctx.painScores.recent[0];
    facts.push({
      id: `pain-latest-${p.daysAgo}d`,
      text: `Most recent pain score: ${p.composite}/10 (${p.daysAgo} day${p.daysAgo === 1 ? '' : 's'} ago).`,
      tier: 'pain_score',
      keywords: ['pain', 'hurts', 'sore', 'ache', 'grimace'],
      priority: 6,
    });
  }

  // ── Profile fields — exposed as facts so the cat can answer
  // "what breed are you" / "how old" without scanning the whole profile
  // section. Each field is its own pin-able fact so the heuristic can
  // surface only the relevant ones.
  const p = opts.ctx.profile;
  if (p) {
    if (p.breed) {
      facts.push({
        id: 'profile-breed',
        text: `You are a ${p.breed}.`,
        tier: 'profile_field',
        keywords: ['breed', 'kind of cat', 'type of cat', 'race', p.breed.toLowerCase()],
        priority: 5,
      });
    }
    if (p.ageMonths != null) {
      const years = Math.floor(p.ageMonths / 12);
      const remMonths = p.ageMonths % 12;
      const ageStr =
        years > 0 && remMonths > 0
          ? `${years} years ${remMonths} months`
          : years > 0
            ? `${years} years`
            : `${p.ageMonths} months`;
      facts.push({
        id: 'profile-age',
        text: `You are ${ageStr} old (${p.ageMonths} months total).`,
        tier: 'profile_field',
        keywords: ['age', 'old', 'years', 'months'],
        priority: 5,
      });
    }
    if (p.dobIso) {
      facts.push({
        id: 'profile-dob',
        text: `Your date of birth is ${p.dobIso}.`,
        tier: 'profile_field',
        keywords: ['birthday', 'born', 'dob', 'date of birth', 'when'],
        priority: 5,
      });
    }
    if (p.weightKg != null) {
      facts.push({
        id: 'profile-weight-current',
        text: `Your current weight: ${p.weightKg} kg.`,
        tier: 'profile_field',
        keywords: ['weight', 'kg', 'heavy', 'light', 'how much'],
        priority: 4, // weight_log facts have richer signal; keep this lower
      });
    }
    if (p.sex !== 'unknown') {
      facts.push({
        id: 'profile-sex',
        text: `You are ${p.sex}.`,
        tier: 'profile_field',
        keywords: ['boy', 'girl', 'male', 'female', 'sex', 'gender'],
        priority: 4,
      });
    }
    if (p.spayedNeutered != null) {
      facts.push({
        id: 'profile-spayed',
        text: `You are ${p.spayedNeutered ? 'spayed/neutered' : 'not spayed/neutered'}.`,
        tier: 'profile_field',
        keywords: ['spayed', 'neutered', 'fixed', 'intact'],
        priority: 4,
      });
    }
    facts.push({
      id: 'profile-lifestyle',
      text: `Lifestyle: ${p.indoorOutdoor}.`,
      tier: 'profile_field',
      keywords: ['indoor', 'outdoor', 'inside', 'outside', 'lifestyle'],
      priority: 3,
    });
    if (p.emergencyVetName || p.emergencyVetPhone) {
      const vetStr = [p.emergencyVetName, p.emergencyVetPhone].filter(Boolean).join(' / ');
      facts.push({
        id: 'profile-vet-contact',
        text: `Emergency vet: ${vetStr}.`,
        tier: 'profile_field',
        keywords: ['vet', 'doctor', 'emergency', 'phone', 'call'],
        priority: 5,
      });
    }
  }

  // ── Reminders (med + weekly check-in) ──
  const rem = opts.ctx.reminders;
  if (rem.medTime) {
    facts.push({
      id: 'reminder-med',
      text: `Daily medication reminder set for ${rem.medTime} (every day, local time).`,
      tier: 'reminder',
      keywords: ['reminder', 'medicine', 'pill', 'medication', 'when', 'due', 'time'],
      priority: 6,
    });
  }
  if (rem.checkinTime && rem.checkinWeekday != null) {
    const weekdays = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = weekdays[rem.checkinWeekday] ?? `weekday-${rem.checkinWeekday}`;
    facts.push({
      id: 'reminder-checkin',
      text: `Weekly check-in reminder: ${dayName} at ${rem.checkinTime}.`,
      tier: 'reminder',
      keywords: ['reminder', 'check-in', 'checkin', 'weekly', 'when'],
      priority: 5,
    });
  }

  // ── Daily check-in streak (only if ≥3 to avoid noise) ──
  if (opts.ctx.dailyCheckinStreak >= 3) {
    facts.push({
      id: 'streak',
      text: `Daily check-in streak: ${opts.ctx.dailyCheckinStreak} days in a row.`,
      tier: 'today',
      keywords: ['streak', 'days in a row', 'check-in', 'consistent'],
      priority: 3,
    });
  }

  // ── World Memory — REAL objects, places, toys, environment ──
  // Each entry becomes its own pin-able fact. The intent patterns above
  // route relevant questions to the right tier (mention "chair" and the
  // "world_object" tier surfaces). The cat's voice rules then say:
  // reference items from MOST RELEVANT FACTS, never invent.
  for (const e of opts.ctx.worldEntries) {
    const tier: FactTier =
      e.kind === 'place' ? 'world_place' :
      e.kind === 'environment' ? 'world_environment' :
      'world_object';

    // Build a one-line fact text that captures the entry's specifics
    // so the model can reference it accurately. Order: name first,
    // then color/location/sentiment/description as available.
    const parts: string[] = [`"${e.name}"`];
    if (e.color) parts.push(e.color);
    if (e.location) parts.push(`(${e.location})`);
    if (e.sentiment) parts.push(`— you ${e.sentiment} this`);
    if (e.description) {
      const trimmed = e.description.length > 100 ? e.description.slice(0, 100) + '…' : e.description;
      parts.push(`— ${trimmed}`);
    }

    // Keywords drive retrieval. Always include the entry name's
    // significant words + the kind itself + sentiment. For a "green
    // chair", keywords = ["green", "chair", "furniture"].
    const nameWords = e.name
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !SELF_FACT_STOPWORDS.has(w));
    const keywords: string[] = [
      ...nameWords,
      e.kind,
    ];
    if (e.color) keywords.push(...e.color.toLowerCase().split(/\s+/));
    if (e.location) keywords.push(...e.location.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    if (e.sentiment) keywords.push(e.sentiment);
    // Include kind-specific synonyms for natural-language matching
    if (e.kind === 'place') {
      keywords.push('place', 'spot', 'where', 'go', 'outside', 'inside');
    } else if (e.kind === 'toy') {
      keywords.push('play', 'toy', 'plaything');
    } else if (e.kind === 'furniture') {
      keywords.push('furniture');
    } else if (e.kind === 'environment') {
      keywords.push('weather', 'today', 'outside');
    }

    facts.push({
      id: `world-${e.id}`,
      text: parts.join(' '),
      tier,
      keywords,
      // Priority scales with reference count + recency. High-touch items
      // get pinned more readily, fresh items beat stale ones.
      priority:
        4 +
        Math.min(e.reference_count / 5, 2) +
        (e.last_referenced_at ? 1 : 0),
    });
  }

  // ── Weather (environmental memory, ambient) ──
  // Single fact per call. The cat can reference real weather as a
  // grounded observation. Surfaces on intent patterns matching
  // 'weather', 'snow', 'rain', 'cold', 'outside today', etc.
  if (opts.weatherSnapshot && opts.weatherSnapshot.narrative) {
    facts.push({
      id: 'weather-today',
      text: `Today's weather: ${opts.weatherSnapshot.narrative}.`,
      tier: 'world_environment',
      keywords: [
        'weather', 'today', 'outside', 'outdoors',
        'snow', 'rain', 'sun', 'cloud', 'storm', 'cold', 'hot', 'warm',
      ],
      priority: 5,
    });
  }

  return facts;
}
