/**
 * Subjects service — vision detection + LLM summarisation for the
 * subject-tagging system.
 *
 * Two responsibilities:
 *
 * 1. `detectSubjectsForPhoto(uri)` — vision call after a photo lands
 *    in the gallery. Asks gpt-4o-mini to count people + other pets
 *    visible (i.e. NOT the cat themselves) and produce a short
 *    description of who's in the frame and what they're doing.
 *    This populates `PhotoStudioPhoto.detected_subjects`. The user
 *    isn't blocked on this — the tag-sheet UI works without it,
 *    but with it the chips can suggest "+ tag the person" when
 *    vision says one is visible. Cheap (~$0.0003 per call).
 *
 * 2. `summariseSubject(entry, recentPhotos)` — text-only LLM call
 *    that distills a directory entry's accumulated context into a
 *    short "vibe" blurb. The diary uses this as memory texture:
 *    "Bella, the small black dog who always smells like wet grass."
 *    Refreshed lazily — the People & Pets screen calls it on first
 *    view of an entry that has new appearances since the last
 *    summary. Trivial cost (~$0.0001 per call).
 *
 * Both calls are best-effort. Failures bubble back as nulls so the
 * caller can fall back to "no detection" / "no vibe" without
 * blocking the photo-add flow.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { completeJson } from '../ai/client';
import type { DirectoryEntry } from '../state/subjectDirectoryStore';

// ---------------------------------------------------------------------------
// Vision: detect subjects in a photo
// ---------------------------------------------------------------------------

/**
 * Per-person rich description — ~10 stable-ish attributes the LLM
 * extracts from a photo. Used both to render disambiguation chips
 * in the tag sheet AND to match the same person across photos
 * without needing real face recognition.
 *
 * Stability ranking (most stable first):
 *   age_band, gender_presentation, eyewear, build, skin_tone,
 *   hair_color (mostly), distinguishing_features
 * Variable across visits / days:
 *   hair_length, hair_style, facial_hair, clothing
 *
 * Matching uses the stable subset for scoring; variable attributes
 * are stored but de-emphasised in the score function.
 */
export type PersonDescription = {
  age_band: 'child' | 'teen' | 'young_adult' | 'middle_aged' | 'older' | 'elderly' | 'unknown';
  gender_presentation: 'masculine' | 'feminine' | 'androgynous' | 'unknown';
  hair_color: string;     // 'brown'|'black'|'blonde'|'gray'|'red'|'mixed'|'unknown' (free string for flexibility)
  hair_length: 'bald' | 'short' | 'medium' | 'long' | 'unknown';
  hair_style: string;      // 'straight'|'wavy'|'curly'|'tied_back'|'unknown' etc.
  facial_hair: 'none' | 'stubble' | 'mustache' | 'beard' | 'goatee' | 'unknown';
  eyewear: 'none' | 'glasses' | 'sunglasses' | 'unknown';
  build: 'slim' | 'average' | 'broad' | 'large' | 'unknown';
  skin_tone: 'very_fair' | 'fair' | 'medium' | 'olive' | 'tan' | 'dark' | 'very_dark' | 'unknown';
  distinguishing_features: string;  // free-text — "freckles", "neck tattoo", "" if none
};

/**
 * Per-pet rich description. Different attribute set since pets
 * vary on different axes than people. Same matching philosophy.
 */
export type PetDescription = {
  species: 'dog' | 'cat' | 'bird' | 'rabbit' | 'rodent' | 'reptile' | 'fish' | 'other' | 'unknown';
  size: 'tiny' | 'small' | 'medium' | 'large' | 'giant' | 'unknown';
  coat_color: string;     // 'black'|'white'|'tabby_brown'|'orange'|'tortoiseshell'|'gray'|'mixed'|'unknown'
  coat_length: 'hairless' | 'short' | 'medium' | 'long' | 'unknown';
  coat_pattern: 'solid' | 'tabby' | 'spotted' | 'patched' | 'tortoiseshell' | 'tuxedo' | 'tipped' | 'mixed' | 'unknown';
  breed_guess: string;     // free string, can be empty
  distinguishing_features: string;  // free-text
  estimated_age: 'puppy_kitten' | 'young' | 'adult' | 'senior' | 'unknown';
  collar_or_accessories: string;  // free-text — "red collar", "no collar", "bandana"
  build: 'slim' | 'average' | 'sturdy' | 'fluffy' | 'unknown';
};

export type DetectedSubjects = {
  /** One entry per person visible. Empty array if none. */
  people: PersonDescription[];
  /** One entry per non-target pet visible. Empty array if none. */
  pets: PetDescription[];
  /** Short scene description (still kept for UX chip text + diary context). */
  description: string;
  /** Local timestamp the detection landed. */
  detected_at: string;
};

/**
 * The vision system prompt. We deliberately ask the model to EXCLUDE
 * the cat's owner cat itself from the pet count — otherwise a photo
 * of just Lily would return `pets: 1` and the UX would prompt the
 * user to "tag the pet who's already named Lily."
 *
 * Per-person + per-pet attributes — the cross-photo matching
 * depends on these being stable and consistent. The prompt commits
 * the model to a fixed enum where possible (eg eyewear ∈ {none,
 * glasses, sunglasses}) and reserves free-text for genuinely
 * open-ended fields (distinguishing features, breed guesses).
 */
const SUBJECT_DETECTION_SYSTEM = `You are tagging a photo from a cat owner's gallery. The cat in the photo is named {{CAT_NAME}}; do NOT count the named cat itself in the "pets" array. People who are PARTIALLY visible (e.g., just a hand or a foot) DO NOT COUNT — they are not "people" for this purpose. Only count people whose face is visible.

Output strict JSON. For EACH visible person, produce a structured description; for EACH visible non-target pet, the same. Use "unknown" liberally — it's better to say "unknown" than guess wrong.

WHY ATTRIBUTES MATTER: these descriptions are matched across photos to recognise the same person on future captures. Be CONSISTENT — describe what you see, not what you infer. If unsure between two values, prefer the more conservative one ("medium" over "long" hair, "average" over "slim" build).

OBSERVATION RULES:
- "skin_tone" is a neutral observation about visible skin colour for matching purposes — choose the closest of the enum values without judgment.
- "distinguishing_features" is a short free-text string ("freckles", "neck tattoo", "beauty mark on cheek", "scar above eyebrow"). Empty string "" if nothing notable. ≤ 60 chars.
- "hair_style" is free text describing the style ("loose", "ponytail", "bun", "braided", "shaved sides"). ≤ 40 chars.
- "breed_guess" for pets is a best-guess breed name or "" if unsure. ≤ 40 chars.

Don't editorialise. No emoji. No commentary outside the JSON.

If only {{CAT_NAME}} is visible (no people, no other pets), return empty arrays and "alone" as the description.`;

const PERSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'age_band',
    'gender_presentation',
    'hair_color',
    'hair_length',
    'hair_style',
    'facial_hair',
    'eyewear',
    'build',
    'skin_tone',
    'distinguishing_features',
  ],
  properties: {
    age_band: { type: 'string', enum: ['child', 'teen', 'young_adult', 'middle_aged', 'older', 'elderly', 'unknown'] },
    gender_presentation: { type: 'string', enum: ['masculine', 'feminine', 'androgynous', 'unknown'] },
    hair_color: { type: 'string', maxLength: 30 },
    hair_length: { type: 'string', enum: ['bald', 'short', 'medium', 'long', 'unknown'] },
    hair_style: { type: 'string', maxLength: 40 },
    facial_hair: { type: 'string', enum: ['none', 'stubble', 'mustache', 'beard', 'goatee', 'unknown'] },
    eyewear: { type: 'string', enum: ['none', 'glasses', 'sunglasses', 'unknown'] },
    build: { type: 'string', enum: ['slim', 'average', 'broad', 'large', 'unknown'] },
    skin_tone: { type: 'string', enum: ['very_fair', 'fair', 'medium', 'olive', 'tan', 'dark', 'very_dark', 'unknown'] },
    distinguishing_features: { type: 'string', maxLength: 60 },
  },
} as const;

const PET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'species',
    'size',
    'coat_color',
    'coat_length',
    'coat_pattern',
    'breed_guess',
    'distinguishing_features',
    'estimated_age',
    'collar_or_accessories',
    'build',
  ],
  properties: {
    species: { type: 'string', enum: ['dog', 'cat', 'bird', 'rabbit', 'rodent', 'reptile', 'fish', 'other', 'unknown'] },
    size: { type: 'string', enum: ['tiny', 'small', 'medium', 'large', 'giant', 'unknown'] },
    coat_color: { type: 'string', maxLength: 30 },
    coat_length: { type: 'string', enum: ['hairless', 'short', 'medium', 'long', 'unknown'] },
    coat_pattern: { type: 'string', enum: ['solid', 'tabby', 'spotted', 'patched', 'tortoiseshell', 'tuxedo', 'tipped', 'mixed', 'unknown'] },
    breed_guess: { type: 'string', maxLength: 40 },
    distinguishing_features: { type: 'string', maxLength: 60 },
    estimated_age: { type: 'string', enum: ['puppy_kitten', 'young', 'adult', 'senior', 'unknown'] },
    collar_or_accessories: { type: 'string', maxLength: 40 },
    build: { type: 'string', enum: ['slim', 'average', 'sturdy', 'fluffy', 'unknown'] },
  },
} as const;

const SUBJECT_DETECTION_SCHEMA = {
  name: 'subject_detection_v2',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['people', 'pets', 'description'],
    properties: {
      people: { type: 'array', maxItems: 8, items: PERSON_SCHEMA },
      pets: { type: 'array', maxItems: 8, items: PET_SCHEMA },
      description: { type: 'string', maxLength: 120 },
    },
  },
} as const;

/**
 * Read a local file:// URI as base64. Returns null on any failure so
 * the caller falls back to "no detection" without blocking the photo.
 */
async function fileUriToBase64(uri: string): Promise<string | null> {
  if (!uri.startsWith('file://') && !uri.startsWith('/')) return null;
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
}

export async function detectSubjectsForPhoto(opts: {
  photoUri: string;
  catName: string;
}): Promise<DetectedSubjects | null> {
  const b64 = await fileUriToBase64(opts.photoUri);
  if (!b64) return null;

  try {
    const result = await completeJson<{
      people: PersonDescription[];
      pets: PetDescription[];
      description: string;
    }>({
      system: SUBJECT_DETECTION_SYSTEM.replace(/\{\{CAT_NAME\}\}/g, opts.catName),
      user: 'Describe each visible person and non-target pet using the schema. Match the same person across photos by being consistent.',
      activity: 'subject_detection',
      imageBase64: b64,
      // Higher detail = better attribute extraction. Cost is ~3x but
      // accuracy on hair colour, eyewear, build is meaningfully
      // better. Worth it for the matching use case.
      imageDetail: 'high',
      temperature: 0.1,
      maxTokens: 1200,
      jsonSchema: SUBJECT_DETECTION_SCHEMA as never,
    });

    return {
      people: Array.isArray(result.people) ? result.people.slice(0, 8) : [],
      pets: Array.isArray(result.pets) ? result.pets.slice(0, 8) : [],
      description: (result.description ?? '').toString().slice(0, 200),
      detected_at: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[subjects] detection failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Matching: detected subject → directory entry
// ---------------------------------------------------------------------------

/**
 * Stable attributes carry the most weight in matching — they
 * shouldn't change between photos of the same person/pet.
 * Variable attributes are scored too but with lower weight.
 */
const PERSON_STABLE_ATTRS = [
  'age_band',
  'gender_presentation',
  'eyewear',
  'build',
  'skin_tone',
  'hair_color',
] as const;
const PERSON_VARIABLE_ATTRS = [
  'hair_length',
  'facial_hair',
] as const;

const PET_STABLE_ATTRS = [
  'species',
  'size',
  'coat_color',
  'coat_length',
  'coat_pattern',
  'build',
  'breed_guess',
  'estimated_age',
] as const;

/**
 * Score how well a detected description matches a stored canonical
 * description. Returns 0-1. Higher = better match.
 *
 * - Stable attribute match: +1.0
 * - Variable attribute match: +0.5
 * - "unknown" on either side: skipped (don't penalise)
 *
 * Final score = sum of matches / max possible sum.
 */
export function scorePersonMatch(
  detected: PersonDescription,
  stored: PersonDescription,
): number {
  let score = 0;
  let max = 0;
  for (const attr of PERSON_STABLE_ATTRS) {
    const a = (detected[attr] ?? 'unknown').toString().toLowerCase().trim();
    const b = (stored[attr] ?? 'unknown').toString().toLowerCase().trim();
    if (a === 'unknown' || b === 'unknown' || !a || !b) continue;
    max += 1;
    if (a === b) score += 1;
  }
  for (const attr of PERSON_VARIABLE_ATTRS) {
    const a = (detected[attr] ?? 'unknown').toString().toLowerCase().trim();
    const b = (stored[attr] ?? 'unknown').toString().toLowerCase().trim();
    if (a === 'unknown' || b === 'unknown' || !a || !b) continue;
    max += 0.5;
    if (a === b) score += 0.5;
  }
  // Distinguishing features: substring match either way bumps score
  const detFeat = (detected.distinguishing_features ?? '').toLowerCase().trim();
  const storFeat = (stored.distinguishing_features ?? '').toLowerCase().trim();
  if (detFeat && storFeat) {
    max += 1;
    if (detFeat === storFeat || detFeat.includes(storFeat) || storFeat.includes(detFeat)) {
      score += 1;
    }
  }
  return max > 0 ? score / max : 0;
}

export function scorePetMatch(
  detected: PetDescription,
  stored: PetDescription,
): number {
  let score = 0;
  let max = 0;
  for (const attr of PET_STABLE_ATTRS) {
    const a = (detected[attr] ?? 'unknown').toString().toLowerCase().trim();
    const b = (stored[attr] ?? 'unknown').toString().toLowerCase().trim();
    if (a === 'unknown' || b === 'unknown' || !a || !b) continue;
    max += 1;
    if (a === b) score += 1;
  }
  const detFeat = (detected.distinguishing_features ?? '').toLowerCase().trim();
  const storFeat = (stored.distinguishing_features ?? '').toLowerCase().trim();
  if (detFeat && storFeat) {
    max += 1;
    if (detFeat === storFeat || detFeat.includes(storFeat) || storFeat.includes(detFeat)) {
      score += 1;
    }
  }
  return max > 0 ? score / max : 0;
}

/**
 * Given a detected description and a list of candidate directory
 * entries, return the best match above threshold (or null).
 *
 * Threshold: 0.65 — empirically chosen to balance false positives
 * (suggesting Mom when it's actually her sister) vs false negatives
 * (failing to suggest Mom when she's right there). With 6 stable
 * attributes, 0.65 = 4-of-6 must match.
 */
export type MatchCandidate = {
  subject_id: string;
  name: string;
  kind: 'person' | 'pet' | 'other';
  score: number;
};

export function matchDetectedToDirectory(opts: {
  detectedPeople: PersonDescription[];
  detectedPets: PetDescription[];
  directory: Array<{
    id: string;
    name: string;
    kind: 'person' | 'pet' | 'other';
    canonical_description?: PersonDescription | PetDescription | null;
  }>;
  threshold?: number;
}): {
  /** One per detected person — best matching directory entry or null. */
  peopleMatches: Array<MatchCandidate | null>;
  /** One per detected pet. */
  petMatches: Array<MatchCandidate | null>;
} {
  const threshold = opts.threshold ?? 0.65;

  const personEntries = opts.directory.filter(
    (e) => e.kind === 'person' && e.canonical_description,
  );
  const petEntries = opts.directory.filter(
    (e) => e.kind === 'pet' && e.canonical_description,
  );

  // Track which directory entries are already claimed (a single Mom
  // can't match two people in the same photo) so the second-place
  // person gets the second-best directory match instead of dupe.
  const claimed = new Set<string>();

  const peopleMatches: Array<MatchCandidate | null> = opts.detectedPeople.map(
    (det) => {
      const ranked = personEntries
        .filter((e) => !claimed.has(e.id))
        .map((e) => ({
          subject_id: e.id,
          name: e.name,
          kind: e.kind,
          score: scorePersonMatch(det, e.canonical_description as PersonDescription),
        }))
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      if (best && best.score >= threshold) {
        claimed.add(best.subject_id);
        return best;
      }
      return null;
    },
  );

  const petMatches: Array<MatchCandidate | null> = opts.detectedPets.map((det) => {
    const ranked = petEntries
      .filter((e) => !claimed.has(e.id))
      .map((e) => ({
        subject_id: e.id,
        name: e.name,
        kind: e.kind,
        score: scorePetMatch(det, e.canonical_description as PetDescription),
      }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (best && best.score >= threshold) {
      claimed.add(best.subject_id);
      return best;
    }
    return null;
  });

  return { peopleMatches, petMatches };
}

// ---------------------------------------------------------------------------
// LLM: summarise a directory entry's "vibe"
// ---------------------------------------------------------------------------

/**
 * Distill an accumulated set of appearance contexts into a single
 * short blurb that captures the subject's vibe relative to the cat.
 * Used by the diary as memory texture.
 *
 * Skipped when the entry has < 3 appearances (not enough material
 * for a worthwhile summary) or when the summary was refreshed
 * recently (<= 7 days ago) AND no new appearances have accumulated.
 */
export async function summariseSubject(opts: {
  catName: string;
  entry: DirectoryEntry;
}): Promise<string | null> {
  const { catName, entry } = opts;

  if (entry.total_appearances < 3) return null;

  // Pull the most-recent N contexts. Trim to keep prompt size bounded.
  const recentContexts = entry.appearances
    .map((a) => a.context)
    .filter((c): c is string => typeof c === 'string' && c.length > 0)
    .slice(0, 12);

  if (recentContexts.length === 0) return null;

  const kindLabel =
    entry.kind === 'pet'
      ? entry.species
        ? `another ${entry.species}`
        : 'another pet'
      : entry.kind === 'person'
        ? entry.relationship
          ? `${entry.relationship}, a person`
          : 'a person'
        : 'someone';

  const system = `You are writing a single-sentence "vibe" blurb that captures who a recurring subject is to a cat. Style: warm, observational, slightly literary — like a journaling cat who notices the same human every day. The blurb is fed into the cat's diary as memory texture, so it reads alongside the cat's voice.

Output JSON: {"vibe": "<single sentence, max 100 chars>"}.

Constraints:
- Refer to the subject by name. Don't repeat the cat's name.
- Anchor with one concrete detail from the appearance contexts (where they tend to be, what they do).
- Don't say "the subject" or "this person." Use the name.
- No emoji. No quotes.`;

  const user = `Cat: ${catName}
Subject name: ${entry.name}
Subject is: ${kindLabel}
Total appearances in ${catName}'s photos: ${entry.total_appearances}
Recent observed contexts (one per photo):
${recentContexts.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}

Write a single-sentence vibe describing who ${entry.name} is to ${catName}. Anchor on a recurring detail.`;

  try {
    const result = await completeJson<{ vibe: string }>({
      system,
      user,
      activity: 'subject_summary',
      temperature: 0.4,
      maxTokens: 120,
      jsonSchema: {
        name: 'subject_vibe',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['vibe'],
          properties: { vibe: { type: 'string', maxLength: 200 } },
        },
      },
    });
    const out = (result.vibe ?? '').toString().trim();
    return out.length > 0 ? out.slice(0, 200) : null;
  } catch (e) {
    console.warn('[subjects] summary failed:', e);
    return null;
  }
}

/**
 * Should we refresh this entry's vibe summary right now? Cheap check:
 * - If the entry has fewer than 3 appearances, skip (not enough material).
 * - If there's no cached vibe AND we have ≥ 3 appearances, yes.
 * - If the cached vibe is older than 14 days AND new appearances have
 *   accumulated since then, yes.
 * - Otherwise no.
 */
export function shouldRefreshVibe(entry: DirectoryEntry): boolean {
  if (entry.total_appearances < 3) return false;
  if (!entry.vibe || !entry.vibe_updated_at) return true;
  const updatedAt = new Date(entry.vibe_updated_at).getTime();
  const ageDays = (Date.now() - updatedAt) / 86400000;
  if (Number.isNaN(ageDays)) return true;
  return ageDays > 14;
}
