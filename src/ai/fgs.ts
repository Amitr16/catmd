/**
 * Feline Grimace Scale (FGS) — vision-assisted pain scoring.
 *
 * Clinical basis: Evangelista et al. (University of Montreal, 2019)
 * validated a 5-action-unit facial pain scale for cats that performs
 * as well as vet-observed behavioural scales. Each action unit scores
 * 0, 1, or 2; the composite ranges 0–10. Scores ≥ 4/10 indicate a cat
 * likely in enough pain to warrant analgesia.
 *
 *   • AU1 — Ear position
 *   • AU2 — Orbital tightening (eye squint)
 *   • AU3 — Muzzle tension
 *   • AU4 — Whisker change
 *   • AU5 — Head position
 *
 * We pass a face photo to a vision model with a strict JSON schema and
 * ask for each AU score plus a short textual rationale. The rationale
 * is shown to the owner next to each score so they can sanity-check
 * what the model saw.
 */
import { completeJson } from './client';

export type FGSUnit = 0 | 1 | 2;

export type FGSResult = {
  ear_position: FGSUnit;
  orbital_tightening: FGSUnit;
  muzzle_tension: FGSUnit;
  whisker_change: FGSUnit;
  head_position: FGSUnit;
  composite: number;          // 0-10 sum of the five AUs
  confidence: 'high' | 'moderate' | 'low';
  rationale: {
    ear_position: string;
    orbital_tightening: string;
    muzzle_tension: string;
    whisker_change: string;
    head_position: string;
  };
  photo_quality_ok: boolean;  // false when model can't score the face (blur, angle, no cat)
  photo_quality_notes: string | null;
};

const SYSTEM = `You are a veterinary assistant scoring facial-expression pain signs in a cat photo using the validated Feline Grimace Scale (Evangelista et al., 2019). You score exactly five action units from the photo. Each action unit scores 0, 1, or 2. Return JSON only.

AU1 — Ear position
  0 = ears forward or neutral upright
  1 = ears slightly rotated outward, flattened a bit
  2 = ears flattened, rotated outward ("airplane ears"), or held apart

AU2 — Orbital tightening (eye squint)
  0 = eyes fully open, normal round
  1 = eyes partly squinted
  2 = eyes mostly or fully closed / strongly squinted

AU3 — Muzzle tension
  0 = muzzle relaxed, round, lips soft
  1 = muzzle slightly tense, more elliptical
  2 = muzzle clearly tense, elongated, elliptical

AU4 — Whisker change
  0 = whiskers loose / in natural forward or neutral position
  1 = whiskers slightly tense, slightly curved
  2 = whiskers clearly pulled back or held straight and tense

AU5 — Head position
  0 = head above shoulder line, alert
  1 = head at shoulder line
  2 = head below shoulder line or tilted downward, resting on surface

Scoring rules:
- If the photo is blurry, side-angle, or does not clearly show the face, set photo_quality_ok=false and explain.
- Never invent a score when the feature is not visible; pick the most likely from what is visible.
- Confidence reflects how certain you are about the composite score, not about any single AU.
- Rationale for each AU is ONE short sentence (≤ 15 words).`;

const SCHEMA = {
  name: 'fgs_score',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'ear_position',
      'orbital_tightening',
      'muzzle_tension',
      'whisker_change',
      'head_position',
      'composite',
      'confidence',
      'rationale',
      'photo_quality_ok',
      'photo_quality_notes',
    ],
    properties: {
      ear_position: { type: 'integer', enum: [0, 1, 2] },
      orbital_tightening: { type: 'integer', enum: [0, 1, 2] },
      muzzle_tension: { type: 'integer', enum: [0, 1, 2] },
      whisker_change: { type: 'integer', enum: [0, 1, 2] },
      head_position: { type: 'integer', enum: [0, 1, 2] },
      composite: { type: 'integer', minimum: 0, maximum: 10 },
      confidence: { type: 'string', enum: ['high', 'moderate', 'low'] },
      rationale: {
        type: 'object',
        additionalProperties: false,
        required: [
          'ear_position',
          'orbital_tightening',
          'muzzle_tension',
          'whisker_change',
          'head_position',
        ],
        properties: {
          ear_position: { type: 'string' },
          orbital_tightening: { type: 'string' },
          muzzle_tension: { type: 'string' },
          whisker_change: { type: 'string' },
          head_position: { type: 'string' },
        },
      },
      photo_quality_ok: { type: 'boolean' },
      // OpenAI strict mode requires anyOf for nullable scalars;
      // `type: ['string', 'null']` is rejected by the Structured Outputs validator.
      photo_quality_notes: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    },
  },
} as const;

export async function scorePainFromPhoto(opts: {
  imageBase64: string;
  catName?: string | null;
}): Promise<FGSResult> {
  const userPrompt =
    `Score the five FGS action units for this cat photo${
      opts.catName ? ` (${opts.catName})` : ''
    }. Return JSON matching the schema exactly.`;

  return completeJson<FGSResult>({
    activity: 'pain_score',
    system: SYSTEM,
    user: userPrompt,
    imageBase64: opts.imageBase64,
    imageDetail: 'high',
    temperature: 0,
    jsonSchema: SCHEMA as any,
  });
}
