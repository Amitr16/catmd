/**
 * Identity matching — figure out which cat (if any) in a candidate
 * image matches the active cat's profile photo.
 *
 * Why this exists: multi-cat households post photos with multiple cats
 * in frame. Without identity matching, the postcard / body-language /
 * personality signals all get attributed to whichever cat happens to
 * dominate the frame — often the wrong one. This service answers two
 * related questions in one call:
 *
 *   1. How many cats are in the candidate image?
 *   2. (If a profile photo is provided) Does the target cat appear,
 *      and where?
 *
 * Architecture:
 *   - One vision call to gpt-4o-mini per candidate (~$0.001-0.003)
 *   - Two images attached: profile (when known) + candidate
 *   - JSON-Schema-strict output for safe parsing
 *   - Best-effort: errors return a graceful "unknown" result so the
 *     caller can fall back to "assume single cat" behaviour
 *
 * The caller (photoStudioStore.addPhoto) fires this AFTER the photo is
 * saved to the gallery and updates the photo record async. Photo save
 * is fast; identity check happens in the background and the UI
 * re-renders pills/warnings when the result lands.
 *
 * Profile-photo bootstrap: when no profile photo exists AND the
 * candidate has only one cat, the caller can use the candidate as
 * the profile (silent auto-set). When multi-cat with no profile,
 * the UI surfaces a "set Lily's profile photo for accurate tracking"
 * hint instead.
 */
import { completeJson } from '../ai/client';

export type CatPosition =
  | 'only'          // single cat in frame
  | 'left'
  | 'right'
  | 'center'
  | 'top'
  | 'bottom'
  | 'foreground'
  | 'background'
  | 'none';         // target not visible

export type IdentityMatchResult = {
  /** Total cats detected in the candidate image. 0 if no cat at all. */
  catCount: number;
  /**
   * Whether the target (profile) cat was detected in the candidate.
   * Always false when no profile was provided.
   */
  targetPresent: boolean;
  /**
   * Where in the frame the target appears. 'only' when single cat.
   * 'none' when not detected.
   */
  targetPosition: CatPosition;
  /**
   * Model's confidence in the target match (0–1). 0 when no profile
   * was provided OR when the target was not detected. Use a
   * threshold (e.g. 0.6) to decide whether to silently accept vs
   * surface a "verify?" UX.
   */
  targetConfidence: number;
  /**
   * One-line plain-text reason for the match (e.g. "matched on white
   * coat + amber eyes"). Surfaced in dev tools / analytics; not shown
   * to the user.
   */
  reasoning: string;
  /**
   * True when the call failed (network / parse / refusal). Caller
   * should treat this as "unknown" and fall back to assume-single-cat
   * behaviour. Never crashes the host flow.
   */
  failed: boolean;
};

const SYSTEM_PROMPT = `You are a feline-identity verifier. You receive 1 or 2 images and must decide:

1. How many cats are visible in the FINAL image (the candidate).
2. If a REFERENCE image is provided (the first image), whether the cat from the reference appears in the candidate, and where.

Identity matching cues — use ALL of these to reason:
- coat colour + pattern (solid, tabby, tuxedo, calico, points, bicolor, etc.)
- eye colour
- ear shape + tufts
- breed signals (Sphynx hairless, Maine Coon size, Persian flat-face, Siamese points)
- distinguishing marks (chest spot, sock-pattern, tail tip)
- approximate size + build

You are conservative. When two cats look similar (e.g. two black cats, two tabbies of similar age), set targetPresent=false unless you can name a specific distinguishing feature. Confidence reflects the strength of distinguishing cues, NOT just visual similarity.

Position vocabulary (controlled set):
- "only" — exactly one cat in candidate
- "left" / "right" / "center" — multi-cat, target on that side
- "top" / "bottom" — vertical placement
- "foreground" / "background" — depth
- "none" — target not present

Cat counting:
- 0 = no cat at all (humans / dogs / objects only)
- 1, 2, 3, 4+ = count of distinct cats. If unsure between two close numbers, pick the higher.

Output JSON only.`;

const RESPONSE_SCHEMA = {
  name: 'cat_identity_match',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'catCount',
      'targetPresent',
      'targetPosition',
      'targetConfidence',
      'reasoning',
    ],
    properties: {
      catCount: { type: 'integer', minimum: 0, maximum: 12 },
      targetPresent: { type: 'boolean' },
      targetPosition: {
        type: 'string',
        enum: [
          'only',
          'left',
          'right',
          'center',
          'top',
          'bottom',
          'foreground',
          'background',
          'none',
        ],
      },
      targetConfidence: { type: 'number', minimum: 0, maximum: 1 },
      reasoning: { type: 'string', maxLength: 200 },
    },
  },
} as const;

/**
 * Run identity matching on a candidate image, optionally against a
 * profile reference. Returns a structured result; never throws.
 *
 * Skip rules (caller side, not enforced here): when a single-cat
 * household has a profile photo, this call is wasted cost — the answer
 * is always "yes, that's Lily." Caller should gate this on multi-cat
 * detection or no-profile state.
 */
export async function analyzeCats(opts: {
  /** Base64 of the candidate image (the new photo or video frame). */
  candidateBase64: string;
  /**
   * Base64 of the cat's profile photo. When omitted, the call still
   * returns `catCount` but `targetPresent` is always false and
   * `targetPosition` is 'none'.
   */
  profileBase64?: string | null;
  /** Display hint for the prompt. Optional. */
  catName?: string;
}): Promise<IdentityMatchResult> {
  const hasProfile = !!opts.profileBase64;
  const catName = opts.catName ?? 'the cat';

  // Build the image array. When profile is present it goes FIRST so
  // the model treats it as the reference; the prompt explicitly
  // anchors on this ordering.
  const images: string[] = [];
  if (opts.profileBase64) images.push(opts.profileBase64);
  images.push(opts.candidateBase64);

  const userPrompt = hasProfile
    ? `Image 1 is the REFERENCE photo of ${catName}.\nImage 2 is the CANDIDATE — count cats and decide whether ${catName} (from image 1) appears, and where.\n\nReturn JSON.`
    : `The single image is the CANDIDATE. Count cats only — no reference provided, so set targetPresent=false and targetPosition="none".\n\nReturn JSON.`;

  try {
    const result = await completeJson<{
      catCount: number;
      targetPresent: boolean;
      targetPosition: CatPosition;
      targetConfidence: number;
      reasoning: string;
    }>({
      activity: 'identity_match',
      system: SYSTEM_PROMPT,
      user: userPrompt,
      imagesBase64: images,
      imageDetail: 'low',
      temperature: 0.1,    // deterministic — same photo should produce same answer across runs
      maxTokens: 200,
      jsonSchema: RESPONSE_SCHEMA,
    });

    return {
      catCount: result.catCount,
      targetPresent: !!result.targetPresent,
      targetPosition: result.targetPosition,
      targetConfidence: hasProfile ? result.targetConfidence : 0,
      reasoning: result.reasoning,
      failed: false,
    };
  } catch (e) {
    // Failure mode: caller falls back to "assume single cat" by
    // treating catCount=1 / targetPresent=true. Keeps the host flow
    // unbroken. Logging + analytics handled at the call site.
    console.warn('[identityMatch] analyzeCats failed:', e);
    return {
      catCount: 1,             // optimistic fallback — most photos are single-cat
      targetPresent: hasProfile, // optimistic — assume the user pointed the camera at their cat
      targetPosition: 'only',
      targetConfidence: 0,     // 0 confidence so UI can detect the failure
      reasoning: e instanceof Error ? `failed: ${e.message.slice(0, 80)}` : 'failed',
      failed: true,
    };
  }
}

/**
 * Confidence threshold for treating a match as "definitely Lily" (silent
 * pass) vs surfacing a verification UI. Tuned conservatively — 0.6 is
 * the floor below which we ask the user to confirm rather than silently
 * attribute behaviour to the wrong cat.
 */
export const IDENTITY_CONFIDENCE_FLOOR = 0.6;
