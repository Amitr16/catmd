/**
 * World extraction — vision pass that pulls OBJECTS, PLACES, and
 * ENVIRONMENT markers out of a photo (or a burst of video frames)
 * silently, in the background, and feeds them into the worldStore
 * candidate pool.
 *
 * ── Why this exists ────────────────────────────────────────────────
 * The user uploads pictures of their cat. The cat shouldn't have to
 * be TOLD what's in those pictures — the vision model can already see
 * the green chair, the rug, the cat tree, the garden through the
 * window. World extraction is the silent pipeline that translates
 * "what's in the photo" into "things the cat can reference in chat
 * later" without the user lifting a finger.
 *
 * ── Pipeline ────────────────────────────────────────────────────────
 *   photo lands in gallery
 *      │
 *      ▼
 *   extractWorldFromPhoto()  ── ~$0.001-0.005 / photo (gpt-4o-mini)
 *      │
 *      ▼
 *   useWorldStore.ingestObservations()
 *      │
 *      ├─ matches an existing entry → bump evidence_count
 *      ├─ matches a candidate → add observation, maybe promote
 *      └─ brand-new → fresh candidate
 *
 * Recurrence-graduates a candidate when ≥ 2 sightings land within 30
 * days. Then the cat starts referencing the item in chat. The user
 * thinks: "wait, how does Lily know about the green chair?" — that's
 * the magic. We never ask the user to type anything.
 *
 * ── What the model extracts ─────────────────────────────────────────
 *   - objects:     furniture / toys / household items the cat could
 *                  meaningfully interact with (chair, rug, blanket,
 *                  scratching post, food bowl, water fountain, toy
 *                  mouse, cat tree). Excludes generic ambient stuff
 *                  the cat wouldn't notice (lightswitches, ceilings).
 *   - place:       the primary location the photo was taken in (the
 *                  living room, the garden, the porch, by-the-window).
 *                  Single per photo — the dominant setting.
 *   - environment: ephemeral world state visible THROUGH the scene
 *                  (snow outside, rain on window, sunny morning,
 *                  thunderstorm, autumn leaves). Optional.
 *
 * ── Cost ────────────────────────────────────────────────────────────
 * Per call: ~$0.001-0.005 with gpt-4o-mini at imageDetail='low'.
 * For a power user adding 10 photos/day that's ~$0.01-0.05/day or
 * ~$0.30-1.50/month. Acceptable. Logged via PostHog `llm_usage` event
 * (activity='world_extraction').
 *
 * ── Errors ──────────────────────────────────────────────────────────
 * Best-effort. Any failure returns null and emits the
 * world_extraction_run event with `error` populated. The photo flow
 * never blocks on this.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { completeJson } from '../ai/client';
import { track } from './analytics';
import {
  useWorldStore,
  type WorldKind,
  type WorldObservation,
} from '../state/worldStore';

/** Read a local file:// URI as base64. Returns null on any failure. */
async function fileUriToBase64(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (!uri.startsWith('file://') && !uri.startsWith('/')) return null;
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
}

// ─── System prompt ──────────────────────────────────────────────────
//
// The prompt deliberately steers AWAY from naming people / pets / the
// cat themselves — those are handled by `subjects.ts`. World
// extraction is about the STAGE, not the actors.
//
// "Verbatim" matters: the model is instructed to output object names
// the way a cat owner would naturally refer to them ("the green
// chair", not "ergonomic mid-century armchair"). Those phrases land
// directly in the cat's chat replies if the candidate graduates.

const WORLD_EXTRACTION_SYSTEM = `You are extracting a feline-relevant inventory from a photo of a cat owner's home (or wherever the cat lives). The cat in the photo is named {{CAT_NAME}}; do NOT include the cat themselves, other cats, people, or other pets in your output — only the inanimate scene around them.

OUTPUT GOAL: identify recurring physical things in the cat's actual environment so the cat can reference them later ("she padded over to the green chair"). The owner never sees this output directly — it builds a silent registry that grounds the cat's voice in REAL items, not hallucinated ones.

NAMING CONVENTION — output names the way a cat owner would naturally refer to them, with the article:
  - "the green chair" / "the cream rug" / "the cat tree by the window"
  - "the food bowl" / "the water fountain" / "the scratching post"
  - "the wand toy" / "the mouse toy" / "the radiator"
  - "the garden" / "the porch" / "the kitchen window"
  Avoid catalogue language ("ergonomic mid-century armchair"). Avoid generic abstractions ("a piece of furniture"). Avoid brand names. Pick concrete, sensory phrases a cat owner would actually use.

WHAT COUNTS AS AN OBJECT (include) — things a cat could plausibly notice, sit on, knock off, sleep against, play with, or hide under:
  - furniture: chair, sofa, bed, table, rug, blanket, cushion, throw, cat tree, shelf, basket, box, ottoman, stool
  - toys: wand, ball, mouse, kicker, laser, puzzle feeder, scratching post, scratcher, tunnel
  - cat-care fixtures: food bowl, water bowl, water fountain, litter box, carrier
  - notable household items: radiator, fireplace, fan, lamp, plant, tree (potted), houseplant, monstera, fern, candle, mirror
  - windows / doors / balcony: include only when they're a clear focal point (the window the cat watches from, the door the cat waits at)

WHAT TO EXCLUDE (ignore):
  - the cat themselves, other cats, people, dogs, other pets
  - generic ambient surfaces: ceilings, walls (unless distinctively coloured/textured), floors (unless a notable rug), light switches, electrical outlets, picture frames on walls
  - tiny background objects (mug on a far counter, books on a high shelf) unless they're clearly central to the photo
  - food packaging, branded products, anything obviously transient (dishes, mail, single-use cups)
  - clothing on a person (the person is excluded entirely)

PLACE — the dominant location the photo was taken in. ONE per photo. Examples:
  "the living room", "the bedroom", "the kitchen", "the garden",
  "the porch", "the balcony", "by the window", "the bathroom", "the office".
  Use null if you genuinely cannot tell (extreme close-up of just the cat).

ENVIRONMENT — ephemeral world state visible IN the scene. AT MOST one. Examples:
  "snow outside", "rain on the window", "sunny morning light",
  "thunderstorm", "autumn leaves", "evening / lamp-lit", "candle-lit".
  Use null if the scene is interior-neutral and shows no weather / time-of-day signal.

DESCRIPTORS — for each object, optional short hints:
  - "color": one or two colour words ("green", "cream and brown", "natural wood"). Empty string "" if not salient.
  - "location": where it sits relative to the cat / room ("by the window", "next to the sofa", "on the rug"). Empty string "" if no salient spatial relation.

KIND — classify each object into ONE of these enum values:
  - "object": generic items, household fixtures (radiator, plant, blanket, cushion, basket)
  - "furniture": chair, sofa, bed, table, rug, cat tree, shelf, ottoman
  - "toy": wand, mouse, ball, kicker, scratcher, scratching post, puzzle feeder, tunnel

For PLACE entries, the "kind" field is ALWAYS "place".
For ENVIRONMENT entries, the "kind" field is ALWAYS "environment".

CAP: at most 6 objects per photo — pick the most prominent. Quality over quantity. A photo of just the cat curled on a blanket should produce ~1 object (the blanket) and a place (e.g. "the bedroom").

SCENE CAPTION — one short sentence that captures WHAT THE PHOTO SHOWS, written as a quiet observation a cat-savvy friend would make if they walked into the room and saw the scene. ANCHORED IN WHAT IS ACTUALLY VISIBLE — do NOT invent objects, weather, time of day, or activity not present in the image. Examples:
  - "{{CAT_NAME}} on the green chair in afternoon light, half-closed eyes."
  - "{{CAT_NAME}} stretched along the windowsill, watching outside."
  - "{{CAT_NAME}} curled in a tight loaf on the cream blanket."
  - "{{CAT_NAME}} mid-yawn on the bed, one paw out."
Length: 6-16 words. ONE sentence. Period at the end. Lower-case unless naming. NEVER mention props that aren't visible. NEVER guess at the cat's mood beyond what posture clearly shows. If the photo doesn't show the cat clearly, use a literal scene phrase ("the living room, lamp-lit, no cat in frame.").

Output strict JSON. No prose outside JSON. No emoji. Use empty arrays / null when nothing fits — never invent.`;

// JSON schema for OpenAI Structured Outputs. `additionalProperties:
// false` everywhere so the model can't smuggle extra keys.
const WORLD_OBJECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'kind', 'color', 'location'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 80 },
    kind: { type: 'string', enum: ['object', 'furniture', 'toy'] },
    color: { type: 'string', maxLength: 30 },
    location: { type: 'string', maxLength: 60 },
  },
} as const;

// `place` and `environment` use `["object","null"]` so the model can
// explicitly say "no place visible" rather than make one up. Strict
// mode requires nullable fields to be expressed this way.
const NULLABLE_NAMED_SCHEMA = {
  type: ['object', 'null'],
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 80 },
  },
} as const;

const WORLD_EXTRACTION_SCHEMA = {
  name: 'world_extraction_v2',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['objects', 'place', 'environment', 'scene_caption'],
    properties: {
      objects: {
        type: 'array',
        maxItems: 6,
        items: WORLD_OBJECT_SCHEMA,
      },
      place: NULLABLE_NAMED_SCHEMA,
      environment: NULLABLE_NAMED_SCHEMA,
      // One-sentence scene caption — drives the "today's photos"
      // section in the chat / diary prompt so the cat can reference
      // visual context without the prompt needing the photo itself.
      // Strict-grounded: the prompt forbids inventing objects /
      // weather / activity not visible. Empty string when the photo
      // is unreadable or fails extraction (caller filters).
      scene_caption: { type: 'string', maxLength: 180 },
    },
  },
} as const;

export type ExtractedWorld = {
  objects: Array<{
    name: string;
    kind: WorldKind & ('object' | 'furniture' | 'toy');
    color?: string;
    location?: string;
  }>;
  place: { name: string } | null;
  environment: { name: string } | null;
  /** One-sentence grounded scene caption. Empty string = none. */
  scene_caption: string;
};

/**
 * Convert ExtractedWorld → WorldObservation[] for the store.
 * Empty-string color/location are dropped to keep the payload lean.
 */
function toObservations(
  extracted: ExtractedWorld,
  observedAt: string,
): WorldObservation[] {
  const out: WorldObservation[] = [];
  for (const o of extracted.objects) {
    out.push({
      name: o.name,
      kind: o.kind,
      color: o.color || undefined,
      location: o.location || undefined,
      observed_at: observedAt,
    });
  }
  if (extracted.place && extracted.place.name) {
    out.push({
      name: extracted.place.name,
      kind: 'place',
      observed_at: observedAt,
    });
  }
  if (extracted.environment && extracted.environment.name) {
    out.push({
      name: extracted.environment.name,
      kind: 'environment',
      observed_at: observedAt,
    });
  }
  return out;
}

// ─── Public surface ─────────────────────────────────────────────────

/**
 * Run the vision pass on a single photo, then ingest the resulting
 * observations into the world store. Best-effort: returns the count
 * of newly-promoted entries (0 if the call failed or nothing graduated
 * on this pass).
 *
 * The `observedAt` defaults to "now" but callers can pass the photo's
 * actual capture time so backfill passes don't bunch all observations
 * onto the same timestamp (which would defeat the recurrence-window
 * spread check).
 */
export async function extractWorldFromPhoto(opts: {
  catId: string;
  catName: string;
  photoUri: string;
  /** Defaults to current time. Pass the photo's added_at for backfill. */
  observedAt?: string;
  /** Telemetry source — distinguishes per-photo from backfill / video. */
  source?: 'photo' | 'behavior_observation' | 'backfill';
}): Promise<number> {
  const source = opts.source ?? 'photo';
  const observedAt = opts.observedAt ?? new Date().toISOString();

  // Pro gate (added 2026-05-12) — silent vision passes cost ~$0.005
  // each. Free users post-trial don't generate world memory; the
  // foreground gate already stops them generating new diary entries,
  // chat replies, etc. that would consume world entries anyway.
  // Cached 5 min to keep bulk photo imports cheap.
  const { getProAccessCached } = await import('./purchases');
  if (!(await getProAccessCached())) return 0;

  const b64 = await fileUriToBase64(opts.photoUri);
  if (!b64) {
    track({
      type: 'world_extraction_run',
      props: {
        source,
        objects_found: 0,
        place_found: false,
        environment_found: false,
        promoted: 0,
        error: 'unreadable_uri',
      },
    });
    return 0;
  }

  let extracted: ExtractedWorld;
  try {
    extracted = await completeJson<ExtractedWorld>({
      system: WORLD_EXTRACTION_SYSTEM.replace(/\{\{CAT_NAME\}\}/g, opts.catName),
      user: 'List the feline-relevant objects, the dominant place, and any visible environment marker in this photo. Follow the schema; use empty arrays / null when nothing fits.',
      activity: 'world_extraction',
      imageBase64: b64,
      // 'low' detail keeps cost ~$0.001 per photo. Object recognition
      // doesn't need pupil-resolution; it needs scene-level inventory,
      // which is what 'low' delivers.
      imageDetail: 'low',
      temperature: 0.2,
      maxTokens: 600,
      jsonSchema: WORLD_EXTRACTION_SCHEMA as never,
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? 'unknown';
    track({
      type: 'world_extraction_run',
      props: {
        source,
        objects_found: 0,
        place_found: false,
        environment_found: false,
        promoted: 0,
        error: msg.slice(0, 120),
      },
    });
    return 0;
  }

  const objects = Array.isArray(extracted.objects) ? extracted.objects : [];
  const observations = toObservations(
    {
      objects: objects.filter((o) => o && o.name && o.kind),
      place: extracted.place && extracted.place.name ? extracted.place : null,
      environment:
        extracted.environment && extracted.environment.name
          ? extracted.environment
          : null,
      scene_caption: extracted.scene_caption ?? '',
    },
    observedAt,
  );

  const promoted = useWorldStore
    .getState()
    .ingestObservations(opts.catId, observations);

  // Persist the one-sentence scene caption so chat / diary can surface
  // "today's photos" without re-running vision. Vision-grounded — the
  // extraction prompt forbids inventing props not in frame.
  const caption = (extracted.scene_caption ?? '').trim();
  if (caption.length > 0) {
    useWorldStore.getState().pushScene(opts.catId, {
      photo_uri: opts.photoUri,
      caption,
      observed_at: observedAt,
    });
  }

  track({
    type: 'world_extraction_run',
    props: {
      source,
      objects_found: objects.length,
      place_found: !!extracted.place && !!extracted.place.name,
      environment_found:
        !!extracted.environment && !!extracted.environment.name,
      promoted,
      error: '',
    },
  });
  return promoted;
}

/**
 * Run the vision pass on a behaviour-observation video frame burst.
 * The model sees up to 4 frames spanning the clip — same world it
 * inhabited for those few seconds — and produces a single inventory.
 *
 * We sample 4 frames (not all 8 the body-language analyzer uses) to
 * keep cost down; world extraction is run on EVERY clip so cost adds
 * up faster than per-photo.
 */
export async function extractWorldFromVideoFrames(opts: {
  catId: string;
  catName: string;
  framesBase64: string[];
  observedAt?: string;
}): Promise<number> {
  if (!opts.framesBase64 || opts.framesBase64.length === 0) return 0;
  const observedAt = opts.observedAt ?? new Date().toISOString();

  // Pro gate — parallel to extractWorldFromPhoto. The body-language
  // call that PRECEDES this is already gated at the screen level;
  // this defence-in-depth handles direct callers.
  const { getProAccessCached } = await import('./purchases');
  if (!(await getProAccessCached())) return 0;
  // Sample up to 4 frames evenly across the clip — first, middle-ish,
  // and last give the model enough scene coverage to inventory the
  // setting without paying for redundant near-duplicate frames.
  const frames = sampleFrames(opts.framesBase64, 4);

  let extracted: ExtractedWorld;
  try {
    extracted = await completeJson<ExtractedWorld>({
      system: WORLD_EXTRACTION_SYSTEM.replace(/\{\{CAT_NAME\}\}/g, opts.catName),
      user: 'These are sequential frames from a short video. List the feline-relevant objects in the scene, the dominant place, and any visible environment marker. Follow the schema; use empty arrays / null when nothing fits.',
      activity: 'world_extraction',
      imagesBase64: frames,
      imageDetail: 'low',
      temperature: 0.2,
      maxTokens: 600,
      jsonSchema: WORLD_EXTRACTION_SCHEMA as never,
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? 'unknown';
    track({
      type: 'world_extraction_run',
      props: {
        source: 'behavior_observation',
        objects_found: 0,
        place_found: false,
        environment_found: false,
        promoted: 0,
        error: msg.slice(0, 120),
      },
    });
    return 0;
  }

  const objects = Array.isArray(extracted.objects) ? extracted.objects : [];
  const observations = toObservations(
    {
      objects: objects.filter((o) => o && o.name && o.kind),
      place: extracted.place && extracted.place.name ? extracted.place : null,
      environment:
        extracted.environment && extracted.environment.name
          ? extracted.environment
          : null,
      scene_caption: extracted.scene_caption ?? '',
    },
    observedAt,
  );

  const promoted = useWorldStore
    .getState()
    .ingestObservations(opts.catId, observations);

  // Persist scene caption for the video clip too — body-language reads
  // are a primary source of "what the camera saw today" memory.
  const caption = (extracted.scene_caption ?? '').trim();
  if (caption.length > 0) {
    useWorldStore.getState().pushScene(opts.catId, {
      photo_uri: null, // video clip — no single photo to dedup against
      caption,
      observed_at: observedAt,
    });
  }

  track({
    type: 'world_extraction_run',
    props: {
      source: 'behavior_observation',
      objects_found: objects.length,
      place_found: !!extracted.place && !!extracted.place.name,
      environment_found:
        !!extracted.environment && !!extracted.environment.name,
      promoted,
      error: '',
    },
  });
  return promoted;
}

/** Pick `count` evenly-spaced items from `arr`. Returns `arr` when shorter. */
function sampleFrames<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr;
  const out: T[] = [];
  const step = (arr.length - 1) / (count - 1);
  for (let i = 0; i < count; i++) {
    out.push(arr[Math.round(i * step)]!);
  }
  return out;
}

// ─── Backfill pass ─────────────────────────────────────────────────
//
// Existing users have a gallery of photos that pre-date world
// extraction. Without backfill, they'd have to add NEW photos before
// the cat starts referencing anything. Backfill processes the existing
// gallery once, in the background, with a sane cap so we don't burn
// $5 of tokens per power user on first open.
//
// Run-once-per-cat is enforced via an AsyncStorage flag. We pick the
// most recent N photos (recency = strongest signal of "still in the
// cat's life") and run extraction sequentially with a small delay
// between calls to spread API load.

import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKFILL_FLAG_KEY = (catId: string) => `catmd-world-backfill-done:${catId}`;
const BACKFILL_MAX_PHOTOS = 25;
const BACKFILL_DELAY_MS = 250;

/**
 * One-shot backfill of world extraction across the cat's existing
 * photo log. Idempotent — flips an AsyncStorage flag once it runs;
 * subsequent calls return 0 immediately.
 *
 * Caller is expected to fire this in the background (not blocking
 * any user-visible flow). The /world screen calls it on first open;
 * could also be wired to app boot if we want eagerness.
 *
 * Returns the count of newly-promoted entries across the entire pass.
 */
export async function backfillWorldFromPhotos(opts: {
  catId: string;
  catName: string;
  photos: Array<{ uri: string; added_at: string }>;
}): Promise<number> {
  if (!opts.catId || !opts.catName) return 0;
  const flagKey = BACKFILL_FLAG_KEY(opts.catId);
  try {
    const existing = await AsyncStorage.getItem(flagKey);
    if (existing === 'done') return 0;
  } catch {
    // If we can't read the flag, fail open (run it once and let the
    // next attempt also run — small cost; better than never running).
  }

  // Most-recent N photos. We sort newest-first then take the head;
  // recency wins because old photos may show items the cat no longer
  // has (moved house, removed furniture, etc.).
  const sorted = [...opts.photos].sort((a, b) =>
    b.added_at.localeCompare(a.added_at),
  );
  const slice = sorted.slice(0, BACKFILL_MAX_PHOTOS);

  let totalPromoted = 0;
  for (const p of slice) {
    try {
      const promoted = await extractWorldFromPhoto({
        catId: opts.catId,
        catName: opts.catName,
        photoUri: p.uri,
        observedAt: p.added_at,
        source: 'backfill',
      });
      totalPromoted += promoted;
    } catch (e) {
      // Per-photo failures are already telemetered inside the call.
      console.warn('[worldExtraction] backfill photo skipped:', e);
    }
    if (BACKFILL_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, BACKFILL_DELAY_MS));
    }
  }

  // Mark done EVEN if zero photos were processed (e.g. cat has no
  // gallery yet) — the screen open shouldn't keep retrying. Adding
  // future photos will of course extract per-add via the live wiring.
  try {
    await AsyncStorage.setItem(flagKey, 'done');
  } catch {
    // Flag write failure → next open will rerun. Acceptable.
  }
  return totalPromoted;
}
