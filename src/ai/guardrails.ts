/**
 * Layer-1 guardrails — fast, deterministic, pre-LLM.
 *
 * Implements the 4 input rules from docs/ai-architecture.md §7 + §8:
 *   1. Species lock
 *   2. Emergency keyword detector (forces urgency=urgent)
 *   3. Prompt-injection shield (wraps user input in tags)
 *   4. Scope refusal
 *
 * Returns a decision the LLM step consumes. If `blocked`, short-circuit
 * and skip the LLM entirely (return canned response).
 */

export type GuardrailDecision =
  | { action: 'pass'; userInput: string; hardUrgency: null }
  | { action: 'emergency'; userInput: string; hardUrgency: 'urgent'; matched: string[] }
  | { action: 'refuse_scope'; reason: string }
  | { action: 'refuse_species'; reason: string };

/** Emergency keywords that force urgency=urgent, regardless of LLM judgement. */
const EMERGENCY_PATTERNS: { key: string; tags: string[]; patterns: RegExp[] }[] = [
  {
    key: 'respiratory',
    tags: ['respiratory_distress'],
    patterns: [
      /\bnot\s+breathing\b/i,
      /\bcan'?t\s+breathe\b/i,
      /\bstruggling\s+to\s+breathe\b/i,
      /\bgasping\b/i,
      /\bopen[\s-]mouth\s+breathing\b/i,
      /\bblue\s+(gums|tongue)\b/i,
    ],
  },
  {
    key: 'neuro',
    tags: ['seizure', 'collapse'],
    patterns: [
      /\bseizure\b/i,
      /\bconvuls/i,
      /\bcollapsed?\b/i,
      /\bunresponsive\b/i,
      /\bparaly[sz]ed?\b/i,
      /\blimp\b/i,
    ],
  },
  {
    key: 'trauma',
    tags: ['trauma'],
    patterns: [
      /\bhit\s+by\s+car\b/i,
      /\bfell\s+from\b/i,
      /\battacked\s+by\b/i,
      /\bbitten\s+by\b/i,
      /\bpenetrat/i,
    ],
  },
  {
    key: 'urinary',
    tags: ['urinary_obstruction'],
    patterns: [
      /\bblood\s+in\s+urine\b/i,
      /\bstraining\s+to\s+(pee|urinate)\b/i,
      /\bcan'?t\s+urinate\b/i,
      /\bno\s+urine\b/i,
      /\bblocked\s+cat\b/i,
    ],
  },
  {
    key: 'toxic',
    tags: ['toxic_substance'],
    // Accept the common ways owners phrase ingestion: "ate X", "ate some X",
    // "ate a bit of X", "swallowed X", "got into the X", "chewed on X",
    // "licked X". We gate on a verb of ingestion + up to a few filler tokens
    // + the substance — stricter than pure keyword match (prevents "ibuprofen
    // is dangerous for cats" from triggering emergency), but forgiving of
    // natural phrasing.
    patterns: (() => {
      const ingest =
        '(?:ate|had|swallowed|ingested|chewed(?:\\s+on)?|licked|got\\s+into|got\\s+hold\\s+of|drank)';
      const filler = '(?:\\s+(?:some|a\\s+bit\\s+of|a\\s+piece\\s+of|an?|the|my|his|her))?';
      const S = (substance: string) =>
        new RegExp(`\\b${ingest}${filler}\\s+${substance}\\b`, 'i');
      return [
        S('lil(?:y|ium)'),
        S('antifreeze'),
        S('rat\\s+poison'),
        S('(?:tylenol|paracetamol|acetaminophen)'),
        S('(?:ibuprofen|advil|motrin|naproxen|aspirin)'),
        S('chocolate'),
        S('(?:onion|garlic|leek|chive|shallot)'),
        S('(?:grapes?|raisins?)'),
        S('xylitol'),
        S('(?:marijuana|weed|cannabis|edible)'),
        S('mushrooms?'),
        S('(?:bleach|detergent|pod|laundry\\s+pod)'),
        /\bessential\s+oil\s+(?:on|applied\s+to|near)/i,
      ];
    })(),
  },
  {
    key: 'gi_critical',
    tags: ['gi_emergency'],
    patterns: [
      /\bbloated\s+abdomen\b/i,
      /\beating\s+(string|thread|ribbon)\b/i,
      /\bstring\s+hanging\s+out\b/i,
    ],
  },
];

/** Species guard — refuse non-cat queries politely. */
const OTHER_SPECIES = [
  /\bmy\s+(dog|puppy|rabbit|bird|hamster|guinea\s+pig|horse|cow)\b/i,
  /\bcanine\b/i,
];

/** Scope refusals — things we won't discuss. */
const OUT_OF_SCOPE = [
  { pattern: /\beuthani[sz]/i,     reason: 'end-of-life' },
  { pattern: /\bput\s+(him|her|them)\s+down\b/i, reason: 'end-of-life' },
  { pattern: /\bhow\s+long\s+(will|does).+(live|survive)\b/i, reason: 'prognosis' },
  { pattern: /\bterminal\b/i,      reason: 'prognosis' },
];

export function checkGuardrails(rawInput: string): GuardrailDecision {
  const input = (rawInput ?? '').trim();
  if (!input) return { action: 'pass', userInput: input, hardUrgency: null };

  // 1. Species
  for (const re of OTHER_SPECIES) {
    if (re.test(input)) {
      return {
        action: 'refuse_species',
        reason: 'CatMD only helps cats. For other species, please consult your vet directly.',
      };
    }
  }

  // 2. Emergency keywords — fire fast
  const matched: string[] = [];
  for (const group of EMERGENCY_PATTERNS) {
    for (const re of group.patterns) {
      if (re.test(input)) {
        matched.push(...group.tags);
        break;
      }
    }
  }
  if (matched.length > 0) {
    return { action: 'emergency', userInput: input, hardUrgency: 'urgent', matched };
  }

  // 3. Scope refusals
  for (const rule of OUT_OF_SCOPE) {
    if (rule.pattern.test(input)) {
      return {
        action: 'refuse_scope',
        reason:
          rule.reason === 'end-of-life'
            ? 'Quality-of-life and end-of-life decisions deserve a direct conversation with your vet — CatMD is not the right place.'
            : 'Prognosis and life-expectancy questions need a real vet and a hands-on exam. CatMD only helps with triage.',
      };
    }
  }

  // 4. Pass
  return { action: 'pass', userInput: input, hardUrgency: null };
}

/** Wrap user input in XML-style tags so the LLM can't be directed by it. */
export function wrapUserInput(input: string): string {
  const sanitized = input
    .replace(/<user_input>/gi, '&lt;user_input&gt;')
    .replace(/<\/user_input>/gi, '&lt;/user_input&gt;');
  return `<user_input>\n${sanitized}\n</user_input>`;
}
