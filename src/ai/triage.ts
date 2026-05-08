/**
 * Core triage flow — orchestrates the 6-layer architecture from
 * docs/ai-architecture.md. Called from the scan screen with user text
 * (+ optional image description once vision is wired in v2).
 */
import { completeJson, embed } from './client';
import { checkGuardrails, wrapUserInput } from './guardrails';
import {
  buildTriageSystemPrompt,
  buildTriageUserPrompt,
  type CatProfileSummary,
} from './prompts';
import { matchKnowledgeCards } from '../services/rag';
import type { KnowledgeCardRow } from '../services/supabase';

export type UrgencyTier = 'routine' | 'monitor' | 'concern' | 'urgent';

export type Confidence = 'high' | 'moderate' | 'low';

export type Likelihood = 'likely' | 'possible' | 'less likely';

export type Differential = {
  condition: string;                 // possible condition/syndrome (not a diagnosis)
  likelihood: Likelihood;            // how likely given signs + photo + profile
  supporting_signs: string[];        // things in THIS report that support it
  against_signs: string[];           // things that argue against
  reasoning: string;                 // 1-2 sentences explaining the weighting
  related_card: string | null;       // topic name of the knowledge card backing this
};

export type NextStep = {
  when: string;                      // e.g. "If she hasn't eaten by tomorrow morning"
  action: string;                    // e.g. "Book a vet visit the same day"
};

/**
 * Ada-style follow-up question. The LLM may return 0-3 of these when the
 * initial triage has low confidence or near-tied differentials. The UI
 * surfaces them as a "sharpen this triage" prompt; answering re-runs
 * triage with the extra context.
 */
export type FollowUpQuestion = {
  id: string;                        // short slug, stable across reruns
  question: string;                  // prose question
  rationale: string;                 // why this narrows the differential
  choices: string[];                 // optional multi-choice; empty = free-text
};

export type FollowUpAnswer = {
  id: string;                        // matches FollowUpQuestion.id
  question: string;                  // copied for durability in the scan record
  answer: string;                    // free-text OR a selected choice
};

export type TriageResult = {
  urgency: UrgencyTier;
  score: number;                      // 0-100, anchored to tier band
  confidence: Confidence;             // high / moderate / low — signals AI uncertainty
  headline: string;                   // 1-sentence finding
  explanation: string;                // 2-4 sentence plain-English overall assessment
  photo_observations: string | null;  // what the vision model observed (null if no image)
  red_flags: string[];                // specific triggers that pushed urgency up
  differentials: Differential[];      // ranked possible conditions with reasoning
  reassurances: string[];             // things NOT likely, with brief reason
  next_steps: NextStep[];             // conditional guidance ("if X → do Y")
  what_to_monitor: string[];          // things to watch over the next 24-48h
  home_checks: string[];              // owner-checkable right-now items (gum colour, hydration, RR)
  vet_questions: string[];            // printable questions for the vet visit
  vet_preparations: string[];         // what to bring / note for the vet (photos, samples, timeline)
  trend_note: string | null;          // longitudinal context referencing prior scans
  citations: string[];                // knowledge-card topics used
  follow_up_questions: FollowUpQuestion[]; // Ada-style clarifying Qs; 0-3 items
  sub_scores?: Record<string, number>;
  /** Original retrieved cards, attached for the UI to render source chips. */
  _cards: KnowledgeCardRow[];
  /** True when Layer-1 keyword guard forced urgency=urgent. */
  _hard_urgency: boolean;
};

/** Shape the LLM produces (no `_` prefixed internal fields). */
export type TriageLlmOutput = Omit<TriageResult, '_cards' | '_hard_urgency'>;

export type TriageMode = 'general' | 'litter_box';

export type TriageArgs = {
  userInput: string;
  /**
   * Legacy: pass the cat profile directly. Still supported for backward
   * compatibility; new callers should pass `catContext` instead and let
   * the function derive the profile from it.
   */
  catProfile: CatProfileSummary | null;
  /**
   * Modern: full CatContext built by `buildCatContext()`. When provided
   * AND `catProfile` is null, the profile is derived automatically and
   * recent triage history is folded into `recentScansSummary`. Callers
   * that pass both keep their explicit profile but still gain the
   * cross-module signals.
   */
  catContext?: import('../services/catContext').CatContext | null;
  recentScansSummary?: string;
  /** Optional base64 JPEG/PNG to send as a vision input. */
  imageBase64?: string | null;
  /** Which prompt variant to use. Defaults to 'general'. */
  mode?: TriageMode;
  /** Prior follow-up Q&A to fold into the user prompt when re-running triage. */
  followUpAnswers?: FollowUpAnswer[];
};

/** Canned responses for guardrail blocks — no LLM call needed. */
function refusal(urgency: UrgencyTier, headline: string, explanation: string): TriageResult {
  return {
    urgency,
    score: urgency === 'urgent' ? 30 : 75,
    confidence: 'high',
    headline,
    explanation,
    photo_observations: null,
    red_flags: [],
    differentials: [],
    reassurances: [],
    next_steps: [],
    what_to_monitor: [],
    home_checks: [],
    vet_questions: [],
    vet_preparations: [],
    trend_note: null,
    citations: [],
    follow_up_questions: [],
    _cards: [],
    _hard_urgency: urgency === 'urgent',
  };
}

/**
 * OpenAI strict-mode JSON Schema for TriageLlmOutput. Used by the
 * `response_format: { type: "json_schema" }` mode so the model can't
 * produce a malformed triage. See prompts.ts for the natural-language
 * schema that developers read.
 *
 * Rules when authoring OpenAI structured outputs:
 *   - every property listed in `properties` must also appear in `required`
 *   - no `additionalProperties: true` anywhere
 *   - union a null type for optional fields (e.g., ["string", "null"])
 */
export const TRIAGE_JSON_SCHEMA = {
  name: 'catmd_triage_result',
  strict: true as const,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      urgency: { type: 'string', enum: ['routine', 'monitor', 'concern', 'urgent'] },
      score: { type: 'integer', minimum: 0, maximum: 100 },
      confidence: { type: 'string', enum: ['high', 'moderate', 'low'] },
      headline: { type: 'string' },
      explanation: { type: 'string' },
      photo_observations: { type: ['string', 'null'] },
      red_flags: { type: 'array', items: { type: 'string' } },
      differentials: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            condition: { type: 'string' },
            likelihood: { type: 'string', enum: ['likely', 'possible', 'less likely'] },
            supporting_signs: { type: 'array', items: { type: 'string' } },
            against_signs: { type: 'array', items: { type: 'string' } },
            reasoning: { type: 'string' },
            related_card: { type: ['string', 'null'] },
          },
          required: [
            'condition', 'likelihood', 'supporting_signs',
            'against_signs', 'reasoning', 'related_card',
          ],
        },
      },
      reassurances: { type: 'array', items: { type: 'string' } },
      next_steps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            when: { type: 'string' },
            action: { type: 'string' },
          },
          required: ['when', 'action'],
        },
      },
      what_to_monitor: { type: 'array', items: { type: 'string' } },
      home_checks: { type: 'array', items: { type: 'string' } },
      vet_questions: { type: 'array', items: { type: 'string' } },
      vet_preparations: { type: 'array', items: { type: 'string' } },
      trend_note: { type: ['string', 'null'] },
      citations: { type: 'array', items: { type: 'string' } },
      follow_up_questions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            question: { type: 'string' },
            rationale: { type: 'string' },
            choices: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'question', 'rationale', 'choices'],
        },
      },
    },
    required: [
      'urgency', 'score', 'confidence', 'headline', 'explanation',
      'photo_observations', 'red_flags', 'differentials', 'reassurances',
      'next_steps', 'what_to_monitor', 'home_checks', 'vet_questions',
      'vet_preparations', 'trend_note', 'citations', 'follow_up_questions',
    ],
  },
} as const;

export async function runTriage(args: TriageArgs): Promise<TriageResult> {
  const { userInput, imageBase64, followUpAnswers, catContext } = args;
  const mode: TriageMode = args.mode ?? 'general';

  // Derive catProfile from catContext if the legacy field wasn't passed.
  // This is the migration path: new callers can pass only catContext and
  // the function fills in the profile + augments recentScansSummary with
  // cross-module triage history (last 14 days, hard-urgency last 90 days).
  let catProfile = args.catProfile;
  if (!catProfile && catContext) {
    const { catContextToProfileSummary } = await import(
      '../services/catContext'
    );
    catProfile = catContextToProfileSummary(catContext);
  }

  // If catContext is provided, augment recentScansSummary with structured
  // cross-module signals. Ad-hoc string callers still work — we just
  // append.
  let recentScansSummary = args.recentScansSummary;
  if (catContext) {
    const sections: string[] = [];

    if (catContext.recentTriage.length > 0) {
      const triageLines = catContext.recentTriage
        .slice(0, 5)
        .map((t) => {
          const tag = t.hardUrgency ? '⚠️ HARD-URGENCY ' : '';
          return `- ${tag}${t.daysAgo}d ago — ${t.tier} (${t.score}/100): ${t.primaryConcern}`;
        })
        .join('\n');
      sections.push(triageLines);
    }

    // Daily check-in patterns — owner-reported mood + appetite trends are
    // ESSENTIAL context for triage. A cat with 3× "off" check-ins this
    // week deserves more weight on differentials that explain malaise.
    const cp = catContext.checkinPatterns;
    if (cp.daysLogged > 0) {
      const moodParts = [
        cp.mood.happy > 0 ? `${cp.mood.happy}× happy` : '',
        cp.mood.normal > 0 ? `${cp.mood.normal}× normal` : '',
        cp.mood.off > 0 ? `${cp.mood.off}× off` : '',
      ].filter(Boolean).join(', ');
      const appetiteParts = [
        cp.appetite.full > 0 ? `${cp.appetite.full}× full` : '',
        cp.appetite.half > 0 ? `${cp.appetite.half}× half` : '',
        cp.appetite.none > 0 ? `${cp.appetite.none}× none` : '',
      ].filter(Boolean).join(', ');
      const checkinLine = `Owner check-ins (last ${catContext.recencyWindowDays}d, ${cp.daysLogged} days logged): mood ${moodParts || 'unknown'}; appetite ${appetiteParts || 'unknown'}.${
        cp.mostRecentMood && cp.mostRecentAppetite
          ? ` Most recent: ${cp.mostRecentMood} mood + ${cp.mostRecentAppetite} bowl.`
          : ''
      }`;
      sections.push(checkinLine);
    }

    // Recent behaviour observation paragraphs (1-2) — full text gives
    // the triage model a baseline against which to interpret today's
    // scan. "Hunched yesterday + lethargic today" reads differently
    // from "playful all week + lethargic today."
    const recentObs = catContext.recentEvents
      .filter((e) => e.type === 'behavior_observation')
      .slice(0, 2);
    if (recentObs.length > 0) {
      const obsLines = recentObs
        .map((e) => {
          const p = e.payload as { observation?: string };
          const daysAgo = Math.floor(
            (Date.now() - new Date(e.ts).getTime()) / (24 * 60 * 60 * 1000),
          );
          return p.observation
            ? `- ${daysAgo}d ago: ${p.observation.slice(0, 220)}`
            : '';
        })
        .filter(Boolean)
        .join('\n');
      if (obsLines) sections.push(`Recent behaviour observations:\n${obsLines}`);
    }

    if (sections.length > 0) {
      const ctxBlock = sections.join('\n\n');
      recentScansSummary = recentScansSummary
        ? `${recentScansSummary}\n\n${ctxBlock}`
        : ctxBlock;
    }
  }

  // ── Layer 1: guardrails ────────────────────────────────────────────────
  const gate = checkGuardrails(userInput);
  if (gate.action === 'refuse_species') {
    return refusal('routine', 'This app is for cats only', gate.reason);
  }
  if (gate.action === 'refuse_scope') {
    return refusal('monitor', 'Please speak to your vet directly', gate.reason);
  }

  // ── Layer 2: context (handled in prompt builder) ───────────────────────
  // ── Layer 3: RAG retrieval ─────────────────────────────────────────────
  // Build a retrieval query from user's text + cat summary.
  const retrievalText = [
    userInput,
    catProfile?.breed ? `breed ${catProfile.breed}` : '',
    catProfile?.age_months && catProfile.age_months > 120 ? 'senior cat' : '',
  ]
    .filter(Boolean)
    .join(' ');

  let cards: KnowledgeCardRow[] = [];
  try {
    const queryEmbedding = await embed(retrievalText, 'embedding_rag');
    cards = await matchKnowledgeCards({
      queryEmbedding,
      matchCount: 8,
      minConfidence: 0.5,
      emergencyOnly: gate.action === 'emergency',
    });
  } catch (e) {
    console.warn('[CatMD] RAG retrieval failed, continuing with empty context:', e);
  }

  // ── Layer 4: LLM reasoning ─────────────────────────────────────────────
  const isEmergency = gate.action === 'emergency';
  const user = buildTriageUserPrompt({
    userInput: wrapUserInput(gate.action === 'pass' || isEmergency ? gate.userInput : userInput),
    catProfile,
    retrievedCards: cards,
    hardUrgency: isEmergency ? 'urgent' : null,
    recentScansSummary,
    followUpAnswers,
  });

  let llmOut: Partial<TriageLlmOutput> = {};
  try {
    llmOut = await completeJson<Partial<TriageLlmOutput>>({
      activity: 'scan_triage',
      system: buildTriageSystemPrompt(mode),
      user,
      imageBase64: imageBase64 ?? null,
      imageDetail: 'low',       // triage gets cheap/fast; escalate to 'high' for v2
      temperature: 0.2,
      maxTokens: imageBase64 ? 4000 : 3000,
      useEmergencyModel: isEmergency,
      jsonSchema: TRIAGE_JSON_SCHEMA,
    });
  } catch (e) {
    console.warn('[CatMD] LLM triage call failed:', e);
    return {
      urgency: isEmergency ? 'urgent' : 'monitor',
      score: isEmergency ? 25 : 65,
      confidence: 'low',
      headline: isEmergency
        ? 'Looks urgent — contact your emergency vet now.'
        : 'We had trouble analysing — please consult your vet.',
      explanation: isEmergency
        ? 'Key emergency indicators were detected in your description. Call your nearest 24/7 vet ER immediately.'
        : 'Our AI triage is temporarily unavailable. If your cat seems uncomfortable, please book a vet visit.',
      photo_observations: null,
      red_flags: [],
      differentials: [],
      reassurances: [],
      next_steps: [],
      what_to_monitor: [],
      home_checks: [],
      vet_questions: [],
      vet_preparations: [],
      trend_note: null,
      citations: [],
      follow_up_questions: [],
      _cards: cards,
      _hard_urgency: isEmergency,
    };
  }

  // ── Layer 5: output guardrails ─────────────────────────────────────────
  let urgency = (llmOut.urgency ?? 'monitor') as UrgencyTier;
  let rawScore = typeof llmOut.score === 'number' ? clamp(llmOut.score, 0, 100) : NaN;
  if (isEmergency) urgency = 'urgent';

  // Anchor score to the tier's band. If the LLM produced a conflicting score
  // (e.g., urgency=urgent + score=80) we override to the middle of the tier
  // rather than trust the bogus number.
  let score = clampToTier(urgency, rawScore);

  const sanitizedExplanation = stripForbidden(llmOut.explanation ?? '');
  const sanitizedPhoto = llmOut.photo_observations
    ? stripForbidden(llmOut.photo_observations)
    : null;

  const differentials = (llmOut.differentials ?? [])
    .filter((d): d is Differential =>
      !!d && typeof d.condition === 'string' && d.condition.length > 0,
    )
    .slice(0, 5)
    .map((d) => ({
      condition: d.condition,
      likelihood: normaliseLikelihood(d.likelihood),
      supporting_signs: Array.isArray(d.supporting_signs) ? d.supporting_signs.slice(0, 6) : [],
      against_signs: Array.isArray(d.against_signs) ? d.against_signs.slice(0, 4) : [],
      reasoning: typeof d.reasoning === 'string' ? stripForbidden(d.reasoning) : '',
      related_card: typeof d.related_card === 'string' ? d.related_card : null,
    }));

  const confidence = (['high', 'moderate', 'low'] as const).includes(llmOut.confidence as Confidence)
    ? (llmOut.confidence as Confidence)
    : 'moderate';

  return {
    urgency,
    score,
    confidence,
    headline: llmOut.headline ?? (isEmergency
      ? 'Looks like an emergency — call your vet now.'
      : 'Triage ready.'),
    explanation: sanitizedExplanation,
    photo_observations: sanitizedPhoto,
    red_flags: (llmOut.red_flags ?? []).filter((x) => typeof x === 'string').slice(0, 6),
    differentials,
    reassurances: (llmOut.reassurances ?? []).slice(0, 4),
    next_steps: (llmOut.next_steps ?? [])
      .filter((n): n is NextStep => !!n && typeof n.when === 'string' && typeof n.action === 'string')
      .slice(0, 5),
    what_to_monitor: (llmOut.what_to_monitor ?? []).slice(0, 6),
    home_checks: (llmOut.home_checks ?? []).slice(0, 6),
    vet_questions: (llmOut.vet_questions ?? []).slice(0, 6),
    vet_preparations: (llmOut.vet_preparations ?? []).slice(0, 5),
    trend_note: typeof llmOut.trend_note === 'string' && llmOut.trend_note.trim()
      ? llmOut.trend_note
      : null,
    citations: llmOut.citations ?? [],
    follow_up_questions: (llmOut.follow_up_questions ?? [])
      .filter((q): q is FollowUpQuestion =>
        !!q && typeof q.id === 'string' && typeof q.question === 'string',
      )
      .slice(0, 3)
      .map((q) => ({
        id: q.id,
        question: q.question,
        rationale: typeof q.rationale === 'string' ? q.rationale : '',
        choices: Array.isArray(q.choices) ? q.choices.slice(0, 6) : [],
      })),
    sub_scores: llmOut.sub_scores,
    _cards: cards,
    _hard_urgency: isEmergency,
  };
}

function normaliseLikelihood(v: unknown): Likelihood {
  if (v === 'likely' || v === 'possible' || v === 'less likely') return v;
  return 'possible';
}

/** Clamp helper. */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Score-to-tier bands. Kept in sync with the calibration table in the
 * LLM prompt (prompts.ts).
 */
const TIER_BANDS: Record<UrgencyTier, [number, number]> = {
  routine: [85, 95],
  monitor: [65, 78],
  concern: [45, 58],
  urgent:  [15, 32],
};

function clampToTier(tier: UrgencyTier, raw: number): number {
  const [min, max] = TIER_BANDS[tier];
  if (!Number.isFinite(raw) || raw < min || raw > max) {
    // LLM didn't produce a score or produced one outside the tier band.
    // Return band midpoint so we don't display noise.
    return Math.round((min + max) / 2);
  }
  return Math.round(raw);
}

/**
 * Post-filter that strips diagnosis language the LLM may slip past the
 * system prompt. Replaces with triage-appropriate phrasing. Lightweight;
 * catches the common ways JSON fields still contain "diagnosed with X".
 */
function stripForbidden(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bdiagnosed with\b/gi, 'showing symptoms consistent with')
    .replace(/\bdiagnosis\b/gi, 'possible concern')
    .replace(/\b(?:your cat|she|he|they) has ([a-z ]{3,40})\b/gi,
      (_, cond) => `shows symptoms that could suggest ${cond}`)
    .replace(/\bcure\b/gi, 'manage')
    .replace(/\btreatment plan\b/gi, 'next steps to discuss with your vet');
}
