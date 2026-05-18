/**
 * Pronoun helper — keeps the cat's gender consistent across LLM
 * prompts and user-facing copy.
 *
 * ── Why this exists ────────────────────────────────────────────────
 * Real bug 2026-05-09: a tester set their cat's `sex` as male, but
 * the diary, push copy, and other surfaces kept referring to the cat
 * as "she". Two compounding causes:
 *
 *   1. Prompt examples are saturated with "she/her" (chat.ts FIELD_
 *      UPDATE samples, behaviorObservation.ts SYSTEM_PROMPT
 *      examples). The model imitates these regardless of what the
 *      profile says.
 *   2. UI surfaces (weekly-reading, scan placeholder, share card,
 *      daily check-in) hardcode "she/her" in fixed copy.
 *
 * Fix has two layers:
 *   - LLM side: inject an explicit "use he/she/they pronouns for
 *     ${catName}" directive into every prompt that names the cat.
 *     This overrides the examples.
 *   - UI side: route hardcoded strings through `getPronouns()` /
 *     `cName` so they adapt per cat.
 *
 * ── Pronoun convention ─────────────────────────────────────────────
 *   - Male:    he / him / his / his
 *   - Female:  she / her / her / hers
 *   - Unknown: they / them / their / theirs (singular they)
 *
 * "Unknown" maps to singular-they so the UI never has to omit a
 * sentence on that branch — it just reads as gender-neutral.
 */

export type CatSex = 'male' | 'female' | 'unknown';

export type Pronouns = {
  /** Subject — "he", "she", "they". */
  subject: string;
  /** Object — "him", "her", "them". */
  object: string;
  /** Possessive determiner — "his", "her", "their" (used before a noun). */
  possessive: string;
  /** Possessive pronoun — "his", "hers", "theirs" (used standalone). */
  possessivePronoun: string;
  /** Reflexive — "himself", "herself", "themselves". */
  reflexive: string;
  /** Capitalised subject for sentence-start use ("He noticed.") */
  Subject: string;
  /** Capitalised possessive ("Her noticing.") */
  Possessive: string;
  /** Whether this cat uses singular-they (sex unknown). Useful when the
   *  caller wants to phrase as "the cat" instead of "they/them" to
   *  avoid singular-they-as-plural confusion. */
  isUnknown: boolean;
};

/**
 * Compute pronouns for a cat. `sex` may be passed as our internal
 * type ('male' | 'female' | 'unknown') OR as null/undefined for
 * defensiveness — both unknown branches map to singular-they.
 */
export function getPronouns(sex: CatSex | null | undefined): Pronouns {
  if (sex === 'male') {
    return {
      subject: 'he',
      object: 'him',
      possessive: 'his',
      possessivePronoun: 'his',
      reflexive: 'himself',
      Subject: 'He',
      Possessive: 'His',
      isUnknown: false,
    };
  }
  if (sex === 'female') {
    return {
      subject: 'she',
      object: 'her',
      possessive: 'her',
      possessivePronoun: 'hers',
      reflexive: 'herself',
      Subject: 'She',
      Possessive: 'Her',
      isUnknown: false,
    };
  }
  return {
    subject: 'they',
    object: 'them',
    possessive: 'their',
    possessivePronoun: 'theirs',
    reflexive: 'themselves',
    Subject: 'They',
    Possessive: 'Their',
    isUnknown: true,
  };
}

/**
 * Build the system-prompt directive that tells the LLM which
 * pronouns to use for THIS cat. Inject this near the "Your name"
 * block in chat / diary / behaviour-observation prompts so it
 * overrides any "she/her" defaults baked into the prompt examples.
 *
 * Output examples:
 *   getPronounDirective("Hichki", "male")
 *     → "Hichki is male. When referring to Hichki in the third
 *        person, use he/him/his pronouns. Never use 'she/her' for
 *        Hichki — the human has explicitly set Hichki's sex as
 *        male."
 *
 *   getPronounDirective("Lily", "unknown")
 *     → "Lily's sex hasn't been specified. Use they/them/their
 *        pronouns when referring to Lily in the third person, OR
 *        use Lily's name. Do NOT default to 'she/her'."
 */
export function getPronounDirective(
  catName: string,
  sex: CatSex | null | undefined,
): string {
  const p = getPronouns(sex);
  if (p.isUnknown) {
    return [
      `${catName}'s sex hasn't been specified.`,
      `When referring to ${catName} in the third person, use they/them/their pronouns OR use ${catName}'s name.`,
      `Do NOT default to "she/her" or "he/him" — the human hasn't told us.`,
    ].join(' ');
  }
  const wrong = sex === 'male' ? 'she/her' : 'he/him';
  return [
    `${catName} is ${sex}.`,
    `When referring to ${catName} in the third person, use ${p.subject}/${p.object}/${p.possessive} pronouns.`,
    `NEVER use "${wrong}" for ${catName} — the human has explicitly set ${catName}'s sex as ${sex}.`,
  ].join(' ');
}
