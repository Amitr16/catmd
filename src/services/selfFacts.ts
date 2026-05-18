/**
 * Self-facts extraction — pulls "facts about the cat" out of user
 * chat turns so the cat can remember them across sessions.
 *
 * Fired in the background after every user message that the chat
 * orchestrator processes. Cheap (~200 input tokens, ~80 output) and
 * non-blocking — if extraction fails, the chat reply is unaffected.
 *
 * Examples of what gets extracted:
 *   - "Lily, you love tuna" → {fact: "I love tuna", category: 'food'}
 *   - "she's terrified of the vacuum" → {fact: "I am afraid of the vacuum", category: 'fear'}
 *   - "you always sleep on my laptop after work" → habit
 *   - "we adopted her at 8 weeks from the shelter" → history
 *
 * Examples of what does NOT get extracted:
 *   - Generic questions ("how do I trim her nails?")
 *   - Statements about the world ("cats can see in the dark")
 *   - Statements about the human ("I'm tired today")
 *
 * The extracted facts are written to selfFactsStore via upsertFact —
 * dedup is on case-insensitive normalised text, so "Lily loves tuna"
 * mentioned five times across a month becomes one fact with high
 * assertion_count (and the diary will surface it more prominently).
 */
import { completeJson } from '../ai/client';
import {
  useSelfFactsStore,
  type SelfFactCategory,
} from '../state/selfFactsStore';

type ExtractedFact = {
  fact: string;
  category: SelfFactCategory;
  confidence: number;
};

const SYSTEM_PROMPT = `You are an extractor that pulls cat-specific facts from a sentence the user just said TO their cat. The user is talking to their cat directly — you are NOT the cat.

Your job: identify any sentence(s) where the user told the cat something about ITSELF. Convert each into a first-person sentence the cat would remember about itself.

Output a JSON object with one key: "facts" — an array of {fact, category, confidence}. Empty array if nothing extractable.

CATEGORIES:
- "food"        — foods the cat loves, hates, eats often
- "place"       — favourite spots, hated rooms, sleep places
- "fear"        — things the cat is afraid of
- "love"        — people, objects, activities the cat loves
- "habit"       — recurring behaviours
- "history"     — past events (rescued, lived elsewhere, lost a friend)
- "preference"  — softer preferences (likes warmth, prefers wet food)
- "other"       — anything else cat-specific

RULES:
- Convert to first person: "you love tuna" → "I love tuna."
- Use simple, natural sentences. Past or present tense as appropriate.
- One fact per atomic claim. "you love tuna and hate the vacuum" → TWO facts.
- ONLY extract claims about THIS cat. NOT about cats in general, NOT about the human.
- Confidence: 1.0 if user states it directly ("you love tuna"). 0.7 if they hint ("you might like wet food"). Skip below 0.5.
- If nothing in the sentence is a fact about the cat, return {"facts": []}.

EXAMPLES:

Input: "Lily, you love tuna and chicken but you hate the smell of fish oil."
Output: {"facts": [{"fact": "I love tuna.", "category": "food", "confidence": 1.0}, {"fact": "I love chicken.", "category": "food", "confidence": 1.0}, {"fact": "I hate the smell of fish oil.", "category": "food", "confidence": 0.9}]}

Input: "How do I keep her teeth clean?"
Output: {"facts": []}

Input: "She was rescued at 6 weeks from the shelter and was the runt."
Output: {"facts": [{"fact": "I was rescued at 6 weeks from a shelter.", "category": "history", "confidence": 1.0}, {"fact": "I was the runt of the litter.", "category": "history", "confidence": 1.0}]}

Input: "You always sleep on my laptop when I come home."
Output: {"facts": [{"fact": "I sleep on my human's laptop when they come home.", "category": "habit", "confidence": 1.0}]}

Input: "Cats can see better in the dark, right?"
Output: {"facts": []}`;

const RESPONSE_SCHEMA = {
  name: 'self_facts_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['facts'],
    properties: {
      facts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['fact', 'category', 'confidence'],
          properties: {
            fact: { type: 'string', maxLength: 200 },
            category: {
              type: 'string',
              enum: [
                'food',
                'place',
                'fear',
                'love',
                'habit',
                'history',
                'preference',
                'other',
              ],
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
} as const;

/**
 * Extract self-facts from a single user turn and write them to the
 * selfFactsStore. Best-effort: failures are swallowed (the chat
 * reply has already landed; this is bonus memory).
 *
 * Returns the array of newly-asserted facts (newly-created OR
 * incremented) so the chat UI can show "the cat learned: X" chips.
 */
export async function extractAndStoreSelfFacts(opts: {
  catId: string;
  catName: string;
  userMessage: string;
  /** The chat turn ID the user message came from, for traceability. */
  sourceTurnId?: string;
}): Promise<Array<{ fact: string; category: SelfFactCategory; isNew: boolean }>> {
  const { catId, catName, userMessage, sourceTurnId } = opts;

  // Cheap pre-filter: skip extraction for very short messages, or
  // questions that don't contain "you/your/she/her/he/him/<catName>".
  const lower = userMessage.toLowerCase();
  const looksFactish =
    lower.includes(catName.toLowerCase()) ||
    /\byou\b|\byour\b|\bshe\b|\bher\b|\bhe\b|\bhim\b|\bthey\b|\btheir\b/.test(lower);
  if (userMessage.trim().length < 8 || !looksFactish) {
    return [];
  }

  let extracted: ExtractedFact[];
  try {
    const result = await completeJson<{ facts: ExtractedFact[] }>({
      system: SYSTEM_PROMPT,
      user: `Cat name: ${catName}\nUser said: "${userMessage}"\n\nExtract any cat-specific facts.`,
      activity: 'self_facts_extraction',
      temperature: 0.1,
      maxTokens: 400,
      jsonSchema: RESPONSE_SCHEMA as never,
    });
    extracted = (result.facts ?? []).filter(
      (f) =>
        f &&
        typeof f.fact === 'string' &&
        f.fact.length > 3 &&
        typeof f.confidence === 'number' &&
        f.confidence >= 0.5,
    );
  } catch (e) {
    console.warn('[selfFacts] extraction failed:', e);
    return [];
  }

  if (extracted.length === 0) return [];

  const store = useSelfFactsStore.getState();
  const written: Array<{
    fact: string;
    category: SelfFactCategory;
    isNew: boolean;
  }> = [];

  // Use the semantic-similarity resolver (2026-05-14 audit fix #7) so
  // contradictions get caught: "I love tuna" followed weeks later by
  // "I hate tuna" used to both persist, making the cat inconsistent
  // over time. The resolver:
  //   - Bumps assertion_count on paraphrase duplicates (cosine ≥ 0.95)
  //   - Supersedes older facts when new ones contradict them
  //     (similarity 0.80-0.95 + opposing-verb pattern)
  //   - Inserts independent facts normally
  // Failures fall back gracefully to the store's exact-dedup path.
  const { resolveAndUpsertFact } = await import('./selfFactsResolver');
  for (const ef of extracted.slice(0, 6)) {
    try {
      const outcome = await resolveAndUpsertFact({
        catId,
        fact: ef.fact,
        category: ef.category,
        source: 'chat',
        confidence: ef.confidence,
        ...(sourceTurnId ? { sourceTurnId } : {}),
      });
      written.push({
        fact: outcome.fact.fact,
        category: outcome.fact.category,
        // 'inserted' and 'replaced' both produce a new visible fact
        // for the user; 'merged' just bumped an existing one.
        isNew: outcome.kind !== 'merged',
      });
    } catch (e) {
      console.warn('[selfFacts] resolve+upsert failed:', e);
    }
  }

  return written;
}
