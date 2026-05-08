/**
 * Photo classifier — routes the scan flow to the right specialized
 * triage prompt without asking the user which mode to pick, AND acts
 * as a relevance gate so the AI doesn't pretend to triage random
 * non-cat photos (gardens, food, scenery, etc.).
 *
 * Categories (matched to the app's ScanMode union + a relevance signal):
 *   - 'litter_box' → urine/stool/litter box photos. Triggers the
 *     urethral-obstruction + Bristol-stool framework.
 *   - 'general'    → cat-related photo (body, face, skin, eye, mouth,
 *     coat, injury). Triggers the standard triage prompt.
 *   - 'irrelevant' → photo isn't cat-related (the model is confident).
 *     The scan flow refuses to triage in this case rather than emitting
 *     hallucinated commentary on a garden / pizza / random object.
 *
 * Called once per scan right before the main triage call. Uses a small
 * fast vision model with a tiny JSON schema so cost is negligible
 * (~$0.0001/call on gpt-4o-mini) and latency is ~1-2s. If the call
 * fails we fall back to 'general' — the general prompt still handles
 * urinary/GI content reasonably; safer to allow than to reject when
 * uncertain.
 *
 * Confidence rule for irrelevance:
 *   - HIGH confidence "other" → return 'irrelevant' (caller must reject)
 *   - MODERATE / LOW confidence "other" → return 'general' (let through;
 *     the triage prompt will hedge on a low-quality photo on its own)
 *   This avoids over-rejecting genuinely-ambiguous photos like a
 *   close-up of cat fur that the classifier can't be sure about.
 */
import { completeJson } from './client';

export type ImageMode = 'litter_box' | 'general' | 'irrelevant';

/** Backward-compat shorthand: triage prompt mode. Excludes 'irrelevant'. */
export type ImageKind = 'litter_box' | 'general';

export type ClassifyResult = {
  mode: ImageMode;
  /** Raw kind from the model — useful for telemetry + nuanced UI copy. */
  kind: 'cat_body' | 'cat_face' | 'litter_box' | 'stool' | 'urine' | 'other';
  confidence: 'high' | 'moderate' | 'low';
  /** One-sentence description of what the model saw. Used in the rejection UI. */
  reason: string;
};

const SYSTEM = `You are an image classifier for a cat health app. Classify the photo into ONE of:
- "cat_body"   — a cat's body, posture, gait, limb, coat, or skin
- "cat_face"   — a cat's face, eyes, ears, nose, mouth, or teeth
- "litter_box" — a litter tray with visible waste / clumps
- "stool"      — a close-up of cat feces (on any surface)
- "urine"      — a close-up of urine, wet patch, or wet clump
- "other"      — anything that is NOT a cat or cat-related material
                 (gardens, food, people, dogs, scenery, indoor objects,
                  blurry/black photos, etc.)

For "other", be confident only when the photo clearly contains no cat
or cat-related content. If the photo is dim, blurry, or might contain a
cat partially visible, prefer "cat_body" or "cat_face" with low
confidence — over-rejecting a real cat photo is worse than letting an
ambiguous one through.

Return JSON only. The reason should be one sentence describing what
you actually see.`;

const SCHEMA = {
  name: 'image_classification',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'confidence', 'reason'],
    properties: {
      kind: {
        type: 'string',
        enum: ['cat_body', 'cat_face', 'litter_box', 'stool', 'urine', 'other'],
      },
      confidence: { type: 'string', enum: ['high', 'moderate', 'low'] },
      reason: { type: 'string' },
    },
  },
} as const;

/**
 * Full classification result — exposes the relevance signal so callers
 * can distinguish "run general triage" from "this isn't a cat, refuse."
 *
 * If `imageBase64` is null/empty we skip the call and return 'general' —
 * text-only scans don't need photo classification.
 */
export async function classifyPhotoFull(
  imageBase64: string | null,
): Promise<ClassifyResult> {
  if (!imageBase64) {
    return {
      mode: 'general',
      kind: 'other',
      confidence: 'low',
      reason: 'No photo attached.',
    };
  }
  try {
    const result = await completeJson<{
      kind: ClassifyResult['kind'];
      confidence: ClassifyResult['confidence'];
      reason: string;
    }>({
      activity: 'scan_classify',
      system: SYSTEM,
      user: 'Classify this photo.',
      imageBase64,
      imageDetail: 'low',
      temperature: 0,
      maxTokens: 140,
      jsonSchema: SCHEMA as any,
    });
    return {
      mode: deriveMode(result.kind, result.confidence),
      kind: result.kind,
      confidence: result.confidence,
      reason: result.reason,
    };
  } catch (e) {
    console.warn('[CatMD] classifyPhoto failed:', e);
    // Soft-fail open — better to let a real cat photo through than to
    // reject the user because of a transient AI / network blip.
    return {
      mode: 'general',
      kind: 'other',
      confidence: 'low',
      reason: 'Classifier unavailable.',
    };
  }
}

/**
 * Backward-compat wrapper — returns just the triage prompt mode.
 * Prefers the older two-mode contract so existing callers keep working.
 * NEW callers should use `classifyPhotoFull` to get the relevance signal.
 */
export async function classifyPhoto(imageBase64: string | null): Promise<ImageKind> {
  const result = await classifyPhotoFull(imageBase64);
  if (result.mode === 'litter_box') return 'litter_box';
  // Both 'general' and 'irrelevant' fold to 'general' for legacy callers.
  return 'general';
}

/**
 * Decision rule from raw classifier kind+confidence to scan mode.
 * Pulled out as a pure function so we can unit-test the gate behaviour
 * independent of the LLM call.
 */
function deriveMode(
  kind: ClassifyResult['kind'],
  confidence: ClassifyResult['confidence'],
): ImageMode {
  if (kind === 'litter_box' || kind === 'stool' || kind === 'urine') {
    return 'litter_box';
  }
  if (kind === 'other') {
    // Only reject when the model is HIGH confidence the photo isn't
    // cat-related. Moderate / low → let through to the general prompt
    // which will hedge on a poor photo gracefully.
    return confidence === 'high' ? 'irrelevant' : 'general';
  }
  // cat_body, cat_face → standard general triage prompt
  return 'general';
}
