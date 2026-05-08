/**
 * Personality service — Litchfield Feline Five → archetype.
 *
 * Pure-function algorithm. Takes the cat's breed, the owner's optional
 * 4-question quiz answers, recent daily check-ins, and recent behaviour
 * observations, and computes:
 *   - 5 trait scores (skittishness, outgoingness, dominance,
 *     spontaneity, friendliness — each 0-100)
 *   - the closest of 9 archetypes
 *   - a confidence score (0-1) reflecting how much real data went in
 *
 * No side effects, no async, no I/O — call this from the store / a hook
 * and cache the result. Re-run when inputs change.
 *
 * Framework reference: Litchfield et al., "The 'Feline Five': An Examination
 * of Personality in the Domestic Cat" (PLoS One, 2017). Archetype profiles
 * are derived from our own personality knowledge cards in the corpus
 * (cards_phase2_*.jsonl), which document the breed-personality and
 * archetype trait profiles.
 *
 * Algorithm overview:
 *   1. Build a weighted aggregate vector from up to 4 input layers:
 *      - breed prior         (0.25 weight if breed known)
 *      - quiz answers        (0.25 weight if quiz taken)
 *      - check-in patterns   (0.30 weight, scales with checkin count)
 *      - behaviour obs tags  (0.20 weight, scales with obs count)
 *   2. Each layer contributes a 5-trait delta vector centred at 50.
 *   3. Normalise final vector to 0-100 per trait.
 *   4. Match to nearest archetype by Euclidean distance in 5D space.
 *   5. Confidence = how many input layers contributed real data.
 */
import type { CatProfile } from '../state/catStore';
import type { HealthEvent } from '../state/healthStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The five Litchfield traits. 0-100 each. 50 = breed-typical / neutral.
 * Higher values = more of the trait, lower = less.
 */
export type FelineFiveScore = {
  skittishness: number;   // 0-100, higher = more anxious / startle-prone
  outgoingness: number;   // 0-100, higher = more sociable / extroverted
  dominance: number;      // 0-100, higher = more assertive / resource-guarding
  spontaneity: number;    // 0-100, higher = more impulsive / unpredictable
  friendliness: number;   // 0-100, higher = more affectionate
};

export type PersonalityArchetype =
  | 'confident_sociable'
  | 'curious_introvert'
  | 'anxious_sensitive'
  | 'hunter_athlete'
  | 'affectionate_lap'
  | 'velcro_cat'
  | 'skittish_sensitive'
  | 'cool_observer'
  | 'goofball_playful';

/**
 * Display metadata for each archetype — name, one-liner, longer body.
 * Single source of truth for the personality screen and the Bond tile.
 */
export type ArchetypeMeta = {
  id: PersonalityArchetype;
  name: string;
  oneLiner: string;
  body: string;          // 3-4 sentence longer description
  careHint: string;      // 1-paragraph "what this means for your cat"
  emoji: string;         // small visual marker for the card
};

export type PersonalityQuizAnswers = {
  strangers: 'hides' | 'watches' | 'approaches';
  novel_object: 'ignores' | 'watches' | 'plays_immediately';
  handling: 'squirms' | 'tolerates' | 'settles';
  night_pattern: 'asleep' | 'quiet' | 'vocalising';
  answered_at: string;
};

export type PersonalityProfile = {
  cat_id: string;
  scores: FelineFiveScore;
  archetype: PersonalityArchetype;
  /** 0-1. <0.4 = low, 0.4-0.7 = building, ≥0.7 = stable. */
  confidence: number;
  inputs_used: {
    breed_prior: boolean;
    quiz_answered: boolean;
    checkin_count: number;
    behavior_obs_count: number;
    /**
     * Number of diary entries in the last 30 days that contributed to
     * the profile. Optional — older cached profiles (pre-v2 layer)
     * won't have this field; UI tolerates absent/0.
     */
    diary_entry_count?: number;
  };
  computed_at: string;
};

// ---------------------------------------------------------------------------
// Archetype reference data
// ---------------------------------------------------------------------------

/**
 * Target trait vectors per archetype. These come straight from our
 * Phase-2 personality knowledge cards — each archetype card describes
 * its expected trait profile, and we encode that here as a numeric target.
 *
 * Distance to each target → closest = matched archetype.
 */
const ARCHETYPE_TARGETS: Record<PersonalityArchetype, FelineFiveScore> = {
  confident_sociable: {
    skittishness: 18,
    outgoingness: 85,
    dominance: 55,
    spontaneity: 60,
    friendliness: 80,
  },
  curious_introvert: {
    skittishness: 38,
    outgoingness: 35,
    dominance: 35,
    spontaneity: 45,
    friendliness: 65,
  },
  anxious_sensitive: {
    skittishness: 80,
    outgoingness: 22,
    dominance: 25,
    spontaneity: 45,
    friendliness: 55,
  },
  hunter_athlete: {
    skittishness: 22,
    outgoingness: 70,
    dominance: 65,
    spontaneity: 88,
    friendliness: 55,
  },
  affectionate_lap: {
    skittishness: 28,
    outgoingness: 70,
    dominance: 25,
    spontaneity: 38,
    friendliness: 92,
  },
  velcro_cat: {
    skittishness: 35,
    outgoingness: 88,
    dominance: 30,
    spontaneity: 55,
    friendliness: 92,
  },
  skittish_sensitive: {
    skittishness: 78,
    outgoingness: 28,
    dominance: 22,
    spontaneity: 40,
    friendliness: 65,
  },
  cool_observer: {
    skittishness: 25,
    outgoingness: 30,
    dominance: 50,
    spontaneity: 28,
    friendliness: 50,
  },
  goofball_playful: {
    skittishness: 25,
    outgoingness: 80,
    dominance: 38,
    spontaneity: 90,
    friendliness: 75,
  },
};

export const ARCHETYPE_META: Record<PersonalityArchetype, ArchetypeMeta> = {
  confident_sociable: {
    id: 'confident_sociable',
    name: 'Confident-Sociable',
    oneLiner: 'The cat that meets every visitor at the door.',
    body: 'Adapts well to new environments, multi-cat homes, and travel. Sees humans as friends until proven otherwise. Common in Sphynx, Bengals, and well-socialised Maine Coons.',
    careHint: 'Confident-Sociable cats need daily interaction and do poorly when left alone for long workdays. They thrive with a feline companion or a midday human visitor. Lots of structured wand-toy play and access to vertical territory keep them engaged.',
    emoji: '🦁',
  },
  curious_introvert: {
    id: 'curious_introvert',
    name: 'Curious-Introvert',
    oneLiner: 'Quietly curious, deeply bonded with one or two people.',
    body: 'Confident in their own home but reserved with strangers. Routine-loving, slow to trust new people, intensely affectionate once trust is built. Common in Russian Blues.',
    careHint: 'Thrive on schedule. Provide a designated safe room they can retreat to during gatherings. Don’t force introductions — let them come to visitors. Multi-pet works only with calm, similarly-introverted companions.',
    emoji: '🌙',
  },
  anxious_sensitive: {
    id: 'anxious_sensitive',
    name: 'Anxious-Sensitive',
    oneLiner: 'Easily overwhelmed, deeply rewarding once trust builds.',
    body: 'Takes weeks to settle into new environments. Often the result of inadequate kitten socialisation, but also genetic. With patience, they become extraordinarily bonded.',
    careHint: 'Stable schedules, predictable handling, environmental enrichment focused on hiding spots and elevated perches. Avoid loud households and forceful introductions. Pheromone diffusers (Feliway) help. Bond-building is measured in months, not days.',
    emoji: '🌿',
  },
  hunter_athlete: {
    id: 'hunter_athlete',
    name: 'Hunter-Athlete',
    oneLiner: 'Athletic, focused, prey-driven. Wand toys are non-negotiable.',
    body: 'Prey-drive runs the show. Spend daily energy in 15-20 minutes of structured play or they will redirect it onto your furniture. Common in Bengals, Abyssinians, Savannahs.',
    careHint: 'Daily wand-toy sessions (10-15 min) ending in a "catch + small meal" to mimic the natural hunt-eat cycle. Food puzzles. Vertical territory with multiple platforms. A catio or harness-walk option transforms them.',
    emoji: '🏹',
  },
  affectionate_lap: {
    id: 'affectionate_lap',
    name: 'Affectionate-Lap',
    oneLiner: 'The classic lap cat — purrs at the slightest touch.',
    body: 'Seeks physical contact, sleeps on the bed, follows you to the bathroom. Common in Ragdolls, Birmans, Scottish Folds.',
    careHint: 'Thrive on close human contact. Do badly with long alone time — consider a feline companion or a midday human visit. Excellent with gentle children. Watch for over-grooming if stressed.',
    emoji: '💛',
  },
  velcro_cat: {
    id: 'velcro_cat',
    name: 'Velcro-Cat',
    oneLiner: 'Will follow you to the bathroom. Every time.',
    body: 'Extreme attachment to bonded humans. Often vocal. Separation distress is real — alone-time is hard for them. Common in Sphynx and Oriental breeds.',
    careHint: 'A second cat (often another of the same breed) is frequently the right answer. Predictable schedules. Minimise sudden absences. They will sleep on your face if you let them — and sometimes if you don’t.',
    emoji: '🧲',
  },
  skittish_sensitive: {
    id: 'skittish_sensitive',
    name: 'Skittish-Sensitive',
    oneLiner: 'Slow to trust, deeply bonded once trust forms.',
    body: 'Hides from strangers, startles at noises, takes 6-12 months to fully settle into a new home. The reward at the end is one of the most loyal bonds a cat can form.',
    careHint: 'Respect their pace. Never force interaction. Provide multiple elevated hides, a quiet refuge room, and let them initiate every approach. Skip group-handling — one calm human at a time, indefinitely.',
    emoji: '🍃',
  },
  cool_observer: {
    id: 'cool_observer',
    name: 'Cool-Observer',
    oneLiner: 'Watches everything, reacts to little. Affection on their terms.',
    body: 'The cat-shaped equivalent of a long-time housemate who likes you very much but doesn’t want to be picked up. Common in British Shorthairs.',
    careHint: 'Don’t take their reserve personally. They prefer to sit near rather than on. Most dislike being lifted; better to crouch and pet at their level. Moderate activity, good for working professionals.',
    emoji: '🪨',
  },
  goofball_playful: {
    id: 'goofball_playful',
    name: 'Goofball-Playful',
    oneLiner: 'The class clown. Knocks things off tables. On purpose.',
    body: 'High energy, high humour, low malice. Plays fetch, gets into harmless mischief, befriends most pets. Common in Domestic Shorthairs.',
    careHint: 'Enrichment is crucial — bored Goofballs become destructive Goofballs. Toy rotation, puzzle feeders, daily wand-toy play. They are the easiest type to train tricks; lean into it.',
    emoji: '🎪',
  },
};

// ---------------------------------------------------------------------------
// Breed priors
// ---------------------------------------------------------------------------

/**
 * Per-breed baseline trait vector. Sourced from our breed-personality
 * cards in the Phase-2 corpus. Each breed nudges the cat toward its
 * statistical centre; individual data refines from there.
 *
 * Match is case-insensitive substring on `cat.breed`. Unknown / DSH
 * defaults to a neutral 50-50-50-50-50 vector.
 */
const BREED_PRIORS: Array<{ match: RegExp; vector: FelineFiveScore }> = [
  // High-outgoing, high-friendliness breeds
  { match: /sphynx/i,                          vector: { skittishness: 18, outgoingness: 88, dominance: 35, spontaneity: 65, friendliness: 90 } },
  { match: /bengal/i,                          vector: { skittishness: 25, outgoingness: 75, dominance: 65, spontaneity: 88, friendliness: 60 } },
  { match: /siamese|oriental/i,                vector: { skittishness: 30, outgoingness: 85, dominance: 50, spontaneity: 70, friendliness: 80 } },
  { match: /burmese/i,                         vector: { skittishness: 22, outgoingness: 88, dominance: 35, spontaneity: 65, friendliness: 88 } },
  { match: /tonkinese/i,                       vector: { skittishness: 25, outgoingness: 82, dominance: 40, spontaneity: 70, friendliness: 82 } },
  { match: /devon\s*rex|cornish\s*rex/i,       vector: { skittishness: 22, outgoingness: 80, dominance: 35, spontaneity: 88, friendliness: 78 } },
  { match: /abyssinian|somali/i,               vector: { skittishness: 28, outgoingness: 78, dominance: 55, spontaneity: 85, friendliness: 65 } },
  // Lap / affectionate breeds
  { match: /ragdoll/i,                         vector: { skittishness: 22, outgoingness: 70, dominance: 25, spontaneity: 38, friendliness: 92 } },
  { match: /birman/i,                          vector: { skittishness: 28, outgoingness: 60, dominance: 30, spontaneity: 38, friendliness: 85 } },
  { match: /maine\s*coon/i,                    vector: { skittishness: 25, outgoingness: 70, dominance: 50, spontaneity: 55, friendliness: 78 } },
  { match: /norwegian\s*forest/i,              vector: { skittishness: 32, outgoingness: 55, dominance: 50, spontaneity: 50, friendliness: 70 } },
  // Reserved / cool breeds
  { match: /russian\s*blue/i,                  vector: { skittishness: 55, outgoingness: 35, dominance: 30, spontaneity: 40, friendliness: 70 } },
  { match: /british\s*shorthair/i,             vector: { skittishness: 28, outgoingness: 38, dominance: 45, spontaneity: 30, friendliness: 60 } },
  { match: /persian|exotic/i,                  vector: { skittishness: 38, outgoingness: 38, dominance: 28, spontaneity: 30, friendliness: 70 } },
  { match: /scottish\s*fold/i,                 vector: { skittishness: 30, outgoingness: 55, dominance: 30, spontaneity: 38, friendliness: 80 } },
  { match: /chartreux/i,                       vector: { skittishness: 30, outgoingness: 45, dominance: 40, spontaneity: 38, friendliness: 65 } },
  // Default / no breed
  // (handled separately as NEUTRAL_VECTOR)
];

const NEUTRAL_VECTOR: FelineFiveScore = {
  skittishness: 50,
  outgoingness: 50,
  dominance: 50,
  spontaneity: 50,
  friendliness: 50,
};

function breedPrior(breed: string | null | undefined): FelineFiveScore {
  if (!breed) return NEUTRAL_VECTOR;
  for (const { match, vector } of BREED_PRIORS) {
    if (match.test(breed)) return vector;
  }
  return NEUTRAL_VECTOR;
}

// ---------------------------------------------------------------------------
// Quiz-answer → trait deltas
// ---------------------------------------------------------------------------

/**
 * Convert the 4 quiz answers to a trait vector. Each answer nudges 1-2
 * traits up or down vs the neutral 50 baseline.
 */
function quizVector(quiz: PersonalityQuizAnswers): FelineFiveScore {
  const v: FelineFiveScore = { ...NEUTRAL_VECTOR };

  // Q1: when a stranger visits
  switch (quiz.strangers) {
    case 'hides':
      v.skittishness = 80;
      v.outgoingness = 20;
      break;
    case 'watches':
      v.skittishness = 50;
      v.outgoingness = 45;
      break;
    case 'approaches':
      v.skittishness = 20;
      v.outgoingness = 85;
      v.friendliness = 75;
      break;
  }

  // Q2: with a novel object
  switch (quiz.novel_object) {
    case 'ignores':
      v.spontaneity = Math.min(100, (v.spontaneity + 30) / 2);
      break;
    case 'watches':
      v.spontaneity = Math.min(100, (v.spontaneity + 50) / 2);
      break;
    case 'plays_immediately':
      v.spontaneity = Math.min(100, (v.spontaneity + 90) / 2);
      v.outgoingness = Math.min(100, v.outgoingness + 10);
      break;
  }

  // Q3: when picked up
  switch (quiz.handling) {
    case 'squirms':
      v.dominance = Math.min(100, (v.dominance + 65) / 2);
      v.friendliness = Math.max(0, v.friendliness - 10);
      break;
    case 'tolerates':
      // neutral — no change
      break;
    case 'settles':
      v.friendliness = Math.min(100, v.friendliness + 15);
      v.dominance = Math.max(0, v.dominance - 10);
      break;
  }

  // Q4: night pattern
  switch (quiz.night_pattern) {
    case 'asleep':
      v.spontaneity = Math.max(0, v.spontaneity - 15);
      break;
    case 'quiet':
      // neutral
      break;
    case 'vocalising':
      v.spontaneity = Math.min(100, v.spontaneity + 15);
      v.outgoingness = Math.min(100, v.outgoingness + 10);
      break;
  }

  return v;
}

// ---------------------------------------------------------------------------
// Check-in patterns → trait deltas
// ---------------------------------------------------------------------------

/**
 * Aggregate daily-checkin events for a cat over the last `days` and
 * derive trait nudges from the patterns. Mood "off" frequency raises
 * skittishness; "bright" frequency raises friendliness/outgoingness;
 * appetite/litter abnormality raises skittishness slightly.
 */
function checkinPatternVector(
  events: HealthEvent[],
  catId: string,
  days = 28,
): { vector: FelineFiveScore; count: number } {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const checkins = events.filter(
    (e) =>
      e.cat_id === catId &&
      e.type === 'daily_checkin' &&
      new Date(e.ts).getTime() >= cutoff,
  );
  const count = checkins.length;
  if (count === 0) {
    return { vector: { ...NEUTRAL_VECTOR }, count: 0 };
  }

  let bright = 0;
  let off = 0;
  let appetiteLow = 0;
  let litterAbnormal = 0;
  for (const e of checkins) {
    const p = e.payload as {
      mood?: string;
      appetite?: string;
      litter?: string;
    };
    if (p.mood === 'bright') bright++;
    if (p.mood === 'off') off++;
    if (p.appetite === 'partial' || p.appetite === 'none') appetiteLow++;
    if (p.litter === 'abnormal') litterAbnormal++;
  }
  const brightRate = bright / count;
  const offRate = off / count;
  const appetiteRate = appetiteLow / count;
  const litterRate = litterAbnormal / count;

  const v: FelineFiveScore = { ...NEUTRAL_VECTOR };
  // High off-rate → more skittish; high bright-rate → more friendly + outgoing
  v.skittishness = clamp(50 + offRate * 60 + appetiteRate * 20 + litterRate * 15);
  v.friendliness = clamp(50 + brightRate * 35 - offRate * 15);
  v.outgoingness = clamp(50 + brightRate * 25 - offRate * 20);
  // Appetite + litter mostly health signals; small effect on traits.
  // Spontaneity + dominance have weak signal from check-ins; stay near 50.
  return { vector: v, count };
}

// ---------------------------------------------------------------------------
// Behaviour observation tags → trait deltas
// ---------------------------------------------------------------------------

/**
 * Tags from Read-[cat] behaviour observations carry strong trait signal.
 * Each tag contributes a small delta to relevant traits; we aggregate
 * across observations and clamp to 0-100.
 */
const TAG_DELTAS: Record<string, Partial<FelineFiveScore>> = {
  // positive arousal / engagement
  confident:   { skittishness: -15, outgoingness: 12, friendliness: 8 },
  playful:     { spontaneity: 18, outgoingness: 10, friendliness: 6 },
  hunting:     { spontaneity: 15, dominance: 8 },
  soliciting:  { friendliness: 18, outgoingness: 12 },
  affectionate:{ friendliness: 18, outgoingness: 8 },
  relaxed:     { skittishness: -12, friendliness: 5 },
  alert:       { spontaneity: 6, outgoingness: 4 },
  curious:     { spontaneity: 12, outgoingness: 8 },
  sociable:    { friendliness: 14, outgoingness: 12 },
  greeting:    { friendliness: 14, outgoingness: 10 },
  content:     { skittishness: -10, friendliness: 4 },
  aroused:     { spontaneity: 10, outgoingness: 4 },     // arousal-positive (play / hunt energy without state lock-in)
  focused:     { spontaneity: 4, dominance: 4 },          // prey-drive cousin of "hunting"
  investigating:{ spontaneity: 8, outgoingness: 6 },
  hungry:      { friendliness: 6, outgoingness: 4 },      // mild solicitation signal
  tracking:    { spontaneity: 6, outgoingness: 4 },       // engagement / monitoring without anxiety

  // negative arousal / withdrawal
  fearful:     { skittishness: 22, outgoingness: -15, friendliness: -8 },
  cautious:    { skittishness: 10, outgoingness: -5 },
  defensive:   { skittishness: 15, dominance: 8 },
  withdrawn:   { skittishness: 12, outgoingness: -12 },
  annoyed:     { dominance: 10, friendliness: -8 },
  irritated:   { dominance: 8, friendliness: -6 },
  overstimulated:{ skittishness: 8, dominance: 6, friendliness: -6 },
  bored:       { outgoingness: -8, spontaneity: -4, friendliness: -3 },
  monitoring:  { spontaneity: 3 },                        // mild engagement; near-neutral
  'winding-down':{ skittishness: -8, friendliness: 3 },   // sleepy/relaxed cousin

  // sleep states — mild-positive valence (calm cat = lower skittishness)
  sleepy:      { skittishness: -8, friendliness: 3 },
};

// ---------------------------------------------------------------------------
// Diary mood-word → trait deltas
// ---------------------------------------------------------------------------
//
// Diary entries land a `mood_word` per day. Aggregating those over the
// last ~30 days surfaces subtle drift the other layers miss — a cat
// that's been "anxious" in 8 of the last 14 entries shouldn't read as
// "Confident-Sociable" just because their breed prior is sage-Siamese.
//
// Each mood word maps to small trait deltas. The aggregator normalises
// per-entry so a long-running user doesn't get pinned to extremes; the
// final layer weight is capped (see computePersonalityProfile).
//
// Vocabulary reflects what the diary captioner actually emits — drawn
// from observed mood_words across test runs + the few-shot examples.

const DIARY_MOOD_DELTAS: Record<string, Partial<FelineFiveScore>> = {
  // Regal / dignified / composed family
  regal:        { dominance: 14, skittishness: -8 },
  imperious:    { dominance: 16, friendliness: -4 },
  dignified:    { dominance: 10, skittishness: -6 },
  aristocratic: { dominance: 12, skittishness: -6 },
  observant:    { dominance: 6, skittishness: -8 },
  watchful:     { dominance: 6, skittishness: -6 },

  // Affectionate / warm family
  affectionate: { friendliness: 18, outgoingness: 8 },
  warm:         { friendliness: 12, outgoingness: 4 },
  snuggly:      { friendliness: 16, outgoingness: 6 },
  loving:       { friendliness: 14, outgoingness: 4 },
  content:      { friendliness: 8, skittishness: -8 },
  satisfied:    { friendliness: 6, skittishness: -10 },
  serene:       { friendliness: 4, skittishness: -10 },
  calm:         { skittishness: -10, friendliness: 4 },

  // Playful / spontaneous family
  playful:     { spontaneity: 16, outgoingness: 10, friendliness: 4 },
  mischievous: { spontaneity: 14, dominance: 6 },
  spirited:    { spontaneity: 12, outgoingness: 8 },
  curious:     { spontaneity: 12, outgoingness: 6 },
  inquisitive: { spontaneity: 10, outgoingness: 4 },
  exploring:   { spontaneity: 10, outgoingness: 6 },

  // Anxious / vigilant / withdrawn family
  anxious:    { skittishness: 18, outgoingness: -8 },
  restless:   { skittishness: 12, spontaneity: 6 },
  vigilant:   { skittishness: 10, dominance: 4 },
  wary:       { skittishness: 12, outgoingness: -6 },
  withdrawn:  { skittishness: 14, outgoingness: -12 },
  hidden:     { skittishness: 12, outgoingness: -8 },

  // Annoyed / grumpy family (slight dominance, slight friendliness drop)
  grumpy:    { dominance: 10, friendliness: -10 },
  irritable: { dominance: 8, friendliness: -8 },
  annoyed:   { dominance: 8, friendliness: -6 },

  // Low-arousal family
  bored:     { spontaneity: -10 },
  lazy:      { spontaneity: -8, friendliness: 4 },
  indolent:  { spontaneity: -10, dominance: 4 },
  sleepy:    { spontaneity: -8 },
};

/**
 * Aggregate diary mood_words into a Feline Five vector. The store
 * passes mood_words from the last 30 days; we sum deltas, normalise
 * per-entry, and clamp.
 */
function diaryMoodVector(
  moodWords: string[],
): { vector: FelineFiveScore; count: number } {
  const count = moodWords.length;
  if (count === 0) {
    return { vector: { ...NEUTRAL_VECTOR }, count: 0 };
  }
  const sum: FelineFiveScore = { ...NEUTRAL_VECTOR };
  for (const raw of moodWords) {
    const norm = raw.toLowerCase().trim();
    const delta = DIARY_MOOD_DELTAS[norm];
    if (!delta) continue;
    for (const k of Object.keys(delta) as Array<keyof FelineFiveScore>) {
      sum[k] = (sum[k] ?? 50) + (delta[k] ?? 0) / count;
    }
  }
  return {
    vector: {
      skittishness: clamp(sum.skittishness),
      outgoingness: clamp(sum.outgoingness),
      dominance: clamp(sum.dominance),
      spontaneity: clamp(sum.spontaneity),
      friendliness: clamp(sum.friendliness),
    },
    count,
  };
}

function behaviorObsVector(
  events: HealthEvent[],
  catId: string,
): { vector: FelineFiveScore; count: number } {
  const obs = events.filter(
    (e) => e.cat_id === catId && e.type === 'behavior_observation',
  );
  const count = obs.length;
  if (count === 0) {
    return { vector: { ...NEUTRAL_VECTOR }, count: 0 };
  }

  // Sum tag deltas, then normalise per-observation so a cat with 100
  // observations doesn't pin every score to the extremes.
  const sum: FelineFiveScore = { ...NEUTRAL_VECTOR };
  for (const e of obs) {
    const p = e.payload as { tags?: string[] };
    const tags = p.tags ?? [];
    for (const tag of tags) {
      const norm = tag.toLowerCase().trim();
      const delta = TAG_DELTAS[norm];
      if (!delta) continue;
      for (const k of Object.keys(delta) as Array<keyof FelineFiveScore>) {
        sum[k] = (sum[k] ?? 50) + (delta[k] ?? 0) / count;
      }
    }
  }
  // Clamp final
  return {
    vector: {
      skittishness: clamp(sum.skittishness),
      outgoingness: clamp(sum.outgoingness),
      dominance: clamp(sum.dominance),
      spontaneity: clamp(sum.spontaneity),
      friendliness: clamp(sum.friendliness),
    },
    count,
  };
}

// ---------------------------------------------------------------------------
// Aggregator + matcher
// ---------------------------------------------------------------------------

function clamp(x: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

function weightedAverage(
  layers: Array<{ vector: FelineFiveScore; weight: number }>,
): FelineFiveScore {
  const totalWeight = layers.reduce((s, l) => s + l.weight, 0);
  if (totalWeight === 0) return { ...NEUTRAL_VECTOR };

  const out: FelineFiveScore = {
    skittishness: 0,
    outgoingness: 0,
    dominance: 0,
    spontaneity: 0,
    friendliness: 0,
  };
  for (const { vector, weight } of layers) {
    out.skittishness += vector.skittishness * (weight / totalWeight);
    out.outgoingness += vector.outgoingness * (weight / totalWeight);
    out.dominance += vector.dominance * (weight / totalWeight);
    out.spontaneity += vector.spontaneity * (weight / totalWeight);
    out.friendliness += vector.friendliness * (weight / totalWeight);
  }
  return {
    skittishness: clamp(Math.round(out.skittishness)),
    outgoingness: clamp(Math.round(out.outgoingness)),
    dominance: clamp(Math.round(out.dominance)),
    spontaneity: clamp(Math.round(out.spontaneity)),
    friendliness: clamp(Math.round(out.friendliness)),
  };
}

function euclidean(a: FelineFiveScore, b: FelineFiveScore): number {
  return Math.sqrt(
    (a.skittishness - b.skittishness) ** 2 +
      (a.outgoingness - b.outgoingness) ** 2 +
      (a.dominance - b.dominance) ** 2 +
      (a.spontaneity - b.spontaneity) ** 2 +
      (a.friendliness - b.friendliness) ** 2,
  );
}

function nearestArchetype(scores: FelineFiveScore): PersonalityArchetype {
  let bestId: PersonalityArchetype = 'cool_observer';
  let bestDist = Infinity;
  for (const [id, target] of Object.entries(ARCHETYPE_TARGETS) as Array<[
    PersonalityArchetype,
    FelineFiveScore,
  ]>) {
    const d = euclidean(scores, target);
    if (d < bestDist) {
      bestDist = d;
      bestId = id;
    }
  }
  return bestId;
}

/**
 * Confidence formula. Each input layer contributes a fraction of total
 * possible confidence:
 *   - breed prior:  0.13
 *   - quiz answers: 0.18
 *   - check-ins:    up to 0.34 (scales with count, capped at 28)
 *   - behaviour obs: up to 0.20 (scales with count, capped at 5)
 *   - diary moods:  up to 0.15 (scales with count, capped at 14)
 * Sum is in [0, 1]. (Diary v2 layer added 2026-05-02; previous formula
 * is preserved as the floor for cats with no diary entries — the
 * checkins + obs + breed + quiz alone still yields the previous max
 * of ~0.85.)
 */
function computeConfidence(opts: {
  hasBreed: boolean;
  hasQuiz: boolean;
  checkinCount: number;
  obsCount: number;
  diaryCount: number;
}): number {
  const breed = opts.hasBreed ? 0.13 : 0;
  const quiz = opts.hasQuiz ? 0.18 : 0;
  const checkins = Math.min(opts.checkinCount / 28, 1) * 0.34;
  const obs = Math.min(opts.obsCount / 5, 1) * 0.2;
  const diary = Math.min(opts.diaryCount / 14, 1) * 0.15;
  return Math.round((breed + quiz + checkins + obs + diary) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a full personality profile for a cat from current data. Pure
 * function — no I/O, no async. Cache the result in personalityStore.
 */
export function computePersonalityProfile(opts: {
  cat: CatProfile;
  events: HealthEvent[];
  quiz: PersonalityQuizAnswers | null;
  /**
   * Mood-word strings from the most recent N (typically 30) diary
   * entries for this cat. Optional — when omitted, the diary layer
   * contributes nothing and confidence falls back to the v1 ceiling.
   */
  diaryMoodWords?: string[];
}): PersonalityProfile {
  const { cat, events, quiz, diaryMoodWords = [] } = opts;

  const layers: Array<{ vector: FelineFiveScore; weight: number }> = [];

  // Breed prior — always include, even for unknown (neutral vector)
  const hasBreed = !!cat.breed && cat.breed.trim().length > 0;
  layers.push({ vector: breedPrior(cat.breed), weight: hasBreed ? 0.25 : 0.1 });

  // Quiz — only if answered
  if (quiz) {
    layers.push({ vector: quizVector(quiz), weight: 0.25 });
  }

  // Check-in patterns — weight scales with count, capped
  const checkin = checkinPatternVector(events, cat.id);
  if (checkin.count > 0) {
    const w = 0.3 * Math.min(checkin.count / 14, 1);
    layers.push({ vector: checkin.vector, weight: w });
  }

  // Behaviour observations — weight scales with count, capped
  const behavior = behaviorObsVector(events, cat.id);
  if (behavior.count > 0) {
    const w = 0.2 * Math.min(behavior.count / 5, 1);
    layers.push({ vector: behavior.vector, weight: w });
  }

  // Diary mood words (v2 layer) — weight scales with count, capped at 14
  // entries (i.e. 2 weeks of daily diaries). Lower weight than quiz +
  // checkins because mood words are noisier signal — diary captioner
  // produces the same word in many shapes ("regal" vs "stately"), and
  // we only map a controlled vocabulary. Anything outside the map is
  // ignored at the aggregator level.
  const diary = diaryMoodVector(diaryMoodWords);
  if (diary.count > 0) {
    const w = 0.15 * Math.min(diary.count / 14, 1);
    layers.push({ vector: diary.vector, weight: w });
  }

  const scores = weightedAverage(layers);
  const archetype = nearestArchetype(scores);
  const confidence = computeConfidence({
    hasBreed,
    hasQuiz: !!quiz,
    checkinCount: checkin.count,
    obsCount: behavior.count,
    diaryCount: diary.count,
  });

  return {
    cat_id: cat.id,
    scores,
    archetype,
    confidence,
    inputs_used: {
      breed_prior: hasBreed,
      quiz_answered: !!quiz,
      checkin_count: checkin.count,
      behavior_obs_count: behavior.count,
      diary_entry_count: diary.count,
    },
    computed_at: new Date().toISOString(),
  };
}

/** Map a confidence number to a human label. */
export function confidenceLabel(c: number): 'low' | 'building' | 'stable' {
  if (c < 0.4) return 'low';
  if (c < 0.7) return 'building';
  return 'stable';
}

/**
 * Minimum input thresholds before we'll show an archetype at all. Below
 * this, the Bond tile prompts the user to take the quiz / log more data.
 *
 * Specifically: we require EITHER (a) the quiz answered, OR (b) at least
 * 3 check-ins + 1 behaviour observation. Without either, the cat doesn't
 * yet have enough signal beyond the breed prior.
 */
export function hasEnoughDataForReveal(profile: PersonalityProfile): boolean {
  const { quiz_answered, checkin_count, behavior_obs_count } = profile.inputs_used;
  if (quiz_answered) return true;
  if (checkin_count >= 3 && behavior_obs_count >= 1) return true;
  return false;
}
