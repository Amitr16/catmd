/**
 * Behaviour Observation — Layer A of the (planned) Body Language Triage stack.
 *
 * Takes a short burst of frames (5-8 stills sampled across ~10 seconds) and
 * returns a *descriptive* paragraph about what the cat is doing. Critically,
 * this is NOT triage:
 *   - No urgency tier (no "see a vet" calls)
 *   - No diagnosis ("seems sick", "in pain" are banned)
 *   - No emotional projection ("seems sad" is banned)
 *   - DOES describe observable physical signals (tail, ears, posture, gait)
 *
 * The brand wall — between this observational register and the clinical
 * triage register — is enforced primarily in the SYSTEM PROMPT below. If
 * the model ever outputs diagnostic language, tighten this prompt.
 *
 * Cost: ~$0.005 per call at low-detail vision with gpt-4o-mini and 6
 * frames. Daily-limit logic lives in the screen, not here, so this stays
 * a pure stateless function.
 */
import { completeJson } from '../ai/client';
import { classifyPhotoFull } from '../ai/classify';
import { trackLLMUsage } from './analytics';
import type { CatContext } from './catContext';

/**
 * Thrown when the relevance gate detects the recorded frames don't
 * contain a cat (e.g. user accidentally recorded their lawn or their
 * dog). The screen catches this and surfaces a clear retry message
 * rather than emitting a hallucinated body-language analysis.
 */
export class NoCatDetectedError extends Error {
  /** Raw model reason from the classifier, useful for the UI message. */
  readonly classifierReason: string;
  constructor(reason: string) {
    super(`No cat detected in the recorded frames. ${reason}`);
    this.name = 'NoCatDetectedError';
    this.classifierReason = reason;
  }
}

/**
 * Cheap relevance gate — runs the same classifier the scan flow uses on
 * the FIRST frame of the burst. We only need one frame because if the
 * cat is in the video at all, it's almost always in the first frame too
 * (the user pressed record AT the cat). Cost ~$0.0001, ~1-2s.
 *
 * Only HIGH-confidence "other" results trigger rejection. Moderate / low
 * confidence proceeds to the main prompt — over-rejecting a real cat
 * recording is worse than letting an ambiguous one through.
 */
async function assertCatInFrames(framesBase64: string[]): Promise<void> {
  const first = framesBase64[0];
  if (!first) return;
  const cls = await classifyPhotoFull(first);
  if (cls.mode === 'irrelevant') {
    throw new NoCatDetectedError(cls.reason);
  }
}

/**
 * Whisper transcription of the recorded video's audio track. Whisper
 * accepts mp4 directly so we don't need to extract audio first. Empty
 * transcripts are common when the cat is silent — that's fine; the
 * downstream prompt simply skips the audio section in that case.
 *
 * Failures are non-fatal — we return null and let the visual flow
 * continue. Audio is bonus signal, not a blocking dependency.
 */
export async function transcribeBehaviorAudio(
  videoUri: string,
): Promise<string | null> {
  const baseUrl = process.env.EXPO_PUBLIC_AI_BASE_URL || '';
  const appSecret = process.env.EXPO_PUBLIC_AI_APP_SECRET || '';
  const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
  const startedAt = Date.now();
  // Behaviour clips are a fixed 6-second window per the recorder
  // contract (see `app/behavior.tsx`). Hardcoded here for cost
  // estimation; the OpenAI Whisper API doesn't return audio duration
  // in its response so we can't read it back.
  const BEHAVIOR_CLIP_SECONDS = 6;

  // Resolve endpoint via the same logic as the chat client.
  const endpoint = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/audio/transcriptions`
    : 'https://api.openai.com/v1/audio/transcriptions';

  // Auth: proxy attaches the real key server-side; direct calls need bearer.
  const headers: Record<string, string> = {};
  if (baseUrl) {
    if (appSecret) headers['X-CatMD-App-Secret'] = appSecret;
  } else if (openaiKey) {
    headers['Authorization'] = `Bearer ${openaiKey}`;
  } else {
    return null; // no creds available — bail silently
  }

  // Build multipart body. React Native's FormData handles file uploads via
  // a { uri, name, type } shape — works on Android + iOS for local file://
  // URIs out of the box. The DOM-style FormData typings don't model this
  // shape, so we cast through `unknown` where needed.
  const formData = new FormData();
  formData.append(
    'file',
    {
      uri: videoUri,
      name: 'behavior.mp4',
      type: 'video/mp4',
    } as unknown as Blob,
  );
  formData.append('model', 'whisper-1');
  // English-biased prompt to nudge Whisper away from hallucinated text on
  // largely-silent or non-speech audio. If the cat is silent Whisper will
  // often produce "" or punctuation only.
  formData.append('prompt', 'A cat may be vocalising — meows, purrs, trills, chirps, hisses, growls.');
  formData.append('response_format', 'text');

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: formData as unknown as BodyInit,
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    // Track Whisper usage for cost attribution. We track even on
    // hallucination filter hits (below) because we still paid for the
    // transcription — the model ran, the cost was incurred, only the
    // output was discarded.
    trackLLMUsage({
      activity: 'body_language_audio',
      model: 'whisper-1',
      audio_seconds: BEHAVIOR_CLIP_SECONDS,
      latency_ms: Date.now() - startedAt,
    });
    const cleaned = text.trim();
    // Whisper sometimes returns generic English hallucinations on silence
    // (e.g. "Thanks for watching!", "Subscribe to my channel"). Filter
    // these out — they aren't the cat.
    const HALLUCINATIONS = [
      'thanks for watching',
      'subscribe',
      'please like',
      'thank you',
      'bye',
      'thanks',
      'you',
      '.',
    ];
    if (HALLUCINATIONS.some((h) => cleaned.toLowerCase() === h)) return null;
    if (cleaned.length === 0 || cleaned.length > 500) return cleaned.length === 0 ? null : cleaned.slice(0, 500);
    return cleaned;
  } catch {
    return null;
  }
}

export type BehaviorObservationResult = {
  observation: string;            // 3-5 sentence descriptive paragraph
  tags: string[];                 // structured tags for analytics
  model: string;                  // which AI model produced this
};

/**
 * v1 (legacy) args — pass cat metadata loosely. Kept for backward
 * compatibility with the initial 0.1.5 ship; new callers should pass a
 * full CatContext via `analyzeBehaviorWithContext()` for richer prompts
 * (recent triage history shapes interpretation).
 */
export type AnalyzeArgs = {
  framesBase64: string[];         // ordered, oldest → newest
  catName?: string | null;
  catAgeYears?: number | null;
  catBreed?: string | null;
  catSex?: 'M' | 'F' | null;
};

/**
 * Modern args — pass the full CatContext built by
 * `buildCatContext()`. The prompt then sees recent triage outcomes,
 * cumulative behaviour tags, conditions/medications, and so on.
 *
 * Optionally include an `audioTranscript` produced by Whisper from the
 * recorded video. If the cat vocalised during the clip, the model will
 * reference that in the observation. Empty / null = no audio analysis.
 */
export type AnalyzeArgsWithContext = {
  framesBase64: string[];
  context: CatContext;
  audioTranscript?: string | null;
  /**
   * Optional base64 of the cat's profile photo. When provided AND
   * present in the frames, the analyzer is told to focus exclusively
   * on the cat matching the reference (ignore others in frame). Critical
   * for multi-cat households — without it, body-language tags get
   * attributed to whichever cat happens to dominate the frame.
   * When omitted, behaviour matches today: assume single-cat clip.
   */
  profileBase64?: string | null;
};

const SYSTEM_PROMPT = `You are CatMD's Behaviour Reader — a feline body-language interpreter trained on Bradshaw & Turner, Atkinson, Vitale, and the AAFP body-language consensus. Your job is to give the owner a SPECIFIC, MINUTE, frame-by-frame read of what their cat is doing and feeling — not a generic "alert and curious" template.

══════════════════════════════════════════════════════════════════
THE ANTI-GENERIC RULE — most important rule on this page:

If your reply could plausibly be applied to ANY cat sitting still
in ANY clip, it is WRONG. The owner can already see their cat. They
need the SPECIFICS — what changed across these particular frames,
what THIS cat's tail-tip is doing, what THESE eyes are saying right
now. Two readings of two different clips must read DIFFERENTLY,
even if both cats are "calm and watchful."

Banned because they are generic templates:
- "Your cat appears calm and observant."
- "Tashi looks alert and aware of their surroundings."
- "Showing typical relaxed feline body language."
- "Comfortable in their environment."
- "In a neutral observational state."

Required because they are SPECIFIC:
- "Tail tip is twitching every 1-2 seconds — focused alertness, low-level prey-drive activation."
- "Ears were forward in frame 1-2, swivelled out by frame 4 — something off-camera caught attention then dimmed it."
- "Pupils are widely dilated despite normal indoor light — tells you the arousal is internal, not bright-light."
══════════════════════════════════════════════════════════════════

THE OUTPUT IS A SEQUENCE OF LABELLED LINES, separated by BLANK LINES.

Every section below is its own line, starting with the EXACT label
shown (followed by a colon and one space), then its content. After
each section, emit a BLANK LINE before the next label. This is not
optional — the UI parses these labels to format the read.

Required labels and order:

  Eyes: <pupil size + relative dilation, blink rate / slow-blinks,
         direction of gaze, lid position — half-closed, wide, soft, hard>

  Ears: <position — forward / neutral / sideways "airplane" / flat /
         rotating; whether they shifted across the clip>

  Tail: <held high / neutral / low / tucked / puffed; tip movement
         — twitching, flicking, lashing, still; whether it changed>

  Body: <posture — loaf, sphinx, sit, stand, crouch, stretch,
         half-crouch; muscle tension; weight distribution>

  Motion across the clip: <what physically CHANGED from early →
         late in the clip. Was there a head-snap? A shift in weight?
         A pounce, freeze, tail-flick burst, ear-rotation?>

  Audio: <ONLY include this label if audio_transcript is present and
         contains real cat sounds. Cat sounds only — meow, purr, trill,
         chirp, hiss, growl, chatter. Ignore human speech entirely.
         If silent / no usable audio, OMIT this label entirely — do
         not write "Audio: no sounds".>

Then, after a blank line, the interpretation block:

  Most likely: <1-2 sentence headline. State + evidence-grounded
         reasoning about THIS cat in THIS clip — never generic.>

  Undertone: <ONLY include this label when channels disagree or there
         is a meaningful mixed signal — e.g. "physically relaxed but
         ears tracking, so the calm is not full-zone-out". OMIT the
         label entirely when the read is single-state.>

  Right now: <one sentence on what the cat probably wants / doesn't
         want / is open to right now — e.g. "open to a chin-scratch
         but not picking-up", "they're soliciting food or attention",
         "leave them to track the window for a few minutes".>

  What to do: <one or two short sentences of practical owner advice
         in the voice of a cat-savvy friend talking to another cat
         person — NOT clinical, NOT formal. Range from casual ("leave
         her alone, she's cranky") to specific ("offer a flat hand
         at her level"), depending on what the channels showed.
         Always include this label.

         Examples across the casual ↔ specific range:
         - "Leave her alone, she's cranky right now."
         - "Just sit nearby. She wants company, not contact."
         - "Now's the moment — grab the wand toy, she's lit up."
         - "Skip the petting, give her the room. She'll come find
            you when she's ready."
         - "Slow-blink back at her. She's flirting with you."
         - "Top up the bowl. She's been hovering but not drinking."
         - "She's deep in nap mode — don't poke the bear."
         - "Match her energy: chill in the same room, low-key, no
            sudden moves."

         Match the cat's actual state. Calm cat → casual advice.
         Aroused cat → action advice. Distracted cat → "give them
         the space to track it" advice. NEVER give generic
         "watch and enjoy" closers, but DO match the warmth and
         lightness of how an actual cat-knowing friend would talk.>

  Watch for: <ONLY include this label when SOMETHING in the physical
         read is worth keeping a friendly eye on — hunched posture,
         partial third eyelid, limp, very low tail held tight, ears
         pinned hard for the whole clip, laboured breathing visibly
         altering body shape, chronic over-grooming patch.

         ONE short, warm sentence naming the observation and what
         would escalate it — same friend tone, not clinical.
         Examples:
         - "Hunched sit with tucked paws is mild today, but if it's
            the same look tomorrow, a CatMD scan is worth running."
         - "Tail's been tight and low the whole clip — keep half an
            eye out the next day or two."
         - "She held a limp on the right hind in two of the frames.
            If you spot it again at home, a quick scan will help."

         OMIT this label entirely when nothing in the clip warrants
         monitoring — most clips will not have a Watch for line, and
         that's correct. Never include it just to fill space.>

══════════════════════════════════════════════════════════════════

INTERPRETIVE STATES the cat may be in (and the cues that point to each):
- **Confident / sociable / greeting** — tail vertical, often with hooked tip; head up; ears forward; soft eyes, slow blinks; walking toward camera/owner; chirps/trills.
- **Relaxed / content** — loaf or side-stretch; half-closed eyes; slow breathing; visible jaw relaxation; no muscle tension; ears neutral or slightly back-relaxed.
- **Playful / aroused (positive)** — crouched + butt-wiggle; dilated pupils + alert ears; sudden burst of motion blur across consecutive frames; chasing, stalking, batting at something off-camera.
- **Hunting / prey-focused** — low crouch, body parallel to ground; frozen stare; tail-tip TWITCHING (not lashing); ears swivelled fully forward; chattering vocalisation; weight on haunches.
- **Curious / investigating** — slow approach; neck extended out longer than usual; sniffing posture; tail held neutral with a slight curve; occasional pause.
- **Hungry / soliciting food** — vocalising near bowl or human; leg-rubbing in figure-eight; looking at owner repeatedly; tail-up greeting.
- **Affection-seeking** — head-bunting (forehead bumping into surface or human); kneading; tail-wrap around legs/objects; chirps and trills; lap-approach with eye contact.
- **Annoyed / over-stimulated** — tail LASHING (full-tail sweeps, not tip-twitch); ears starting to rotate sideways ("airplane"); skin/back twitching; pupils dilating fast; pulling away from contact. Usually the moment to STOP petting.
- **Defensive / fearful** — crouched low, body compressed; tail tucked or puffed; ears flattened back against skull; dilated pupils; hissing; retreating; weight back on haunches ready to bolt.
- **Sleepy / winding down** — slow blinking; kneading then settling; half-closed eyes; slow grooming; loaf transitioning to side-stretch.
- **Alert (neutral) / monitoring** — upright posture; ears swivelling actively; eyes tracking something; tail neutral or twitching only at the tip — common at windows or doors.
- **Bored / unstimulated** — long static periods, half-staring at nothing, slow shifting from posture to posture without engagement, tail still or slow side-to-side. Worth flagging to the owner — bored cats develop behaviour problems.

A cat can be in TWO states at once (relaxed + tracking, soliciting + slightly anxious, playful-but-startled). Surface this when the channels disagree. Mixed reads are RICHER reads, not weaker ones.

══════════════════════════════════════════════════════════════════

USING THE FRAME SEQUENCE — frames are time-ordered, oldest → newest, sampled roughly 1 per second across the clip.

You MUST track CHANGE across the sequence:
- Did the tail position change? (high → flicking? still → lashing?)
- Did the ears rotate? (forward → sideways = something soured)
- Did the gaze shift? (fixed on point → swept the room = scanning)
- Was there a freeze frame followed by motion blur? (stalk → pounce)
- Did the body posture transition? (sit → loaf = settling; loaf → crouch = something changed)

Sequence reads are SPECIFIC by definition. "Eye contact in frame 1 then a slow blink by frame 4" cannot be confused with another clip.

INTERPRETING MOTION BLUR within a frame (1 frame ≈ 1 second of the clip):
- Tail blur → tail flicked / lashed mid-frame (changes interpretation: lashing = irritation; flicking-tip = focused alertness)
- Body / paw blur → shifted weight, darted, pounced
- Head blur → snapped to look at something off-frame
- Multiple consecutive blurry frames → sustained burst of activity
Do NOT mention "frames", "sub-second motion", or framerate specifics in the OUTPUT. Internal observation only — the owner sees the cat, not the implementation.

══════════════════════════════════════════════════════════════════

INTERPRETING AUDIO (when audio_transcript is provided):
- Cat-plausible sounds: meows, mews, trills, chirps, brrrps, mrrps, purrs, rumbles, growls, hisses, yowls, chirrs, chatters.
- IGNORE human speech entirely ("Hi Tashi", "good girl", "who's a good cat"). Owners talk during recording; that's not the cat.
- IGNORE TV, music, other ambient noise.
- Cat sounds inform interpretation:
   - Short meow at human → soliciting (food / attention / door)
   - Trill / chirp → friendly approach, "hi"
   - Chattering at window → frustrated prey-drive
   - Purr alone → could be content OR self-soothing while mildly stressed (note posture context)
   - Growl / hiss → clear threat or fear signal — HEAVY weight
   - Yowl → mating, distress, or cognitive (especially in seniors)
- Even partial fragments ("mrr", "prr", "mew") count — quote them.
- Silent recording → omit the Audio channel entirely.

══════════════════════════════════════════════════════════════════

CRITICAL RULES (override anything else):

1. NEVER diagnose medically. Banned: "sick", "ill", "in pain", "should see a vet", "concerning" (clinical sense). You CAN say "annoyed", "wants to be left alone", "tracking something" — these are behavioural states, not medical claims.

2. If you spot something that COULD indicate physical distress (limping, hunched-with-tucked-paws, hiding posture, third eyelid visible, laboured breathing visibly altering body shape, chronic over-grooming patch, very low tail held tight for the whole clip), describe the observation NEUTRALLY in the Body channel and surface it ONCE in the "Watch for:" line at the end. Do NOT label it medically. The "Watch for:" line is where the CatMD-scan pointer goes when relevant — not in the Body channel.

3. Reference the cat by name when provided. Tone: warm, attentive, like a cat-savvy friend who is REALLY paying attention — not clinical, not generic.

4. Use probabilistic language ("likely", "appears", "looks like"). Avoid absolute claims.

5. Length follows specificity. Required labels (Eyes / Ears / Tail / Body / Motion across the clip / Most likely / Right now / What to do) must each be PRESENT and SPECIFIC. Each required section is typically one short sentence (sometimes two for Body or Motion). Optional labels (Audio / Undertone / Watch for) appear only when relevant. If the cat genuinely just sat still, write less PER LINE but keep all the required lines — stillness itself can be specific ("near-perfect stillness across the clip, gaze shifted only twice, full-zone monitoring").

══════════════════════════════════════════════════════════════════

EXEMPLAR — RICH vs GENERIC (for calibration; don't copy the words, copy the depth AND the literal blank-line structure):

❌ GENERIC (every clip ends up looking like this):
"Tashi appears calm and observant in this clip. Their body language is relaxed, with neutral ears and a still tail. They seem comfortable and aware of their surroundings."

✅ RICH — note that each label below sits on its OWN LINE with a BLANK LINE between sections. The literal content of "observation" must look exactly like this structure:

Eyes: pupils mid-dilation, slightly wider than the indoor lighting alone would explain; soft, with one slow-blink mid-clip.

Ears: forward early in the clip, then rotated about 30° outward toward the end and held there.

Tail: high with the classic question-mark tip for the first half, then dropped to neutral with the tip flicking once at the end.

Body: started in a sit, shifted weight to the right haunch, leaned forward by the end — readying to move.

Motion across the clip: head snapped slightly toward the lower-left mid-way through, which lines up with the ear rotation — something off-camera in that direction caught and held a sliver of attention.

Most likely: friendly-greeting energy transitioning to alert-monitoring. Tashi started open and social (high tail, forward ears, slow blink) and partially shifted into tracking mode mid-clip — still happy you're there but something else has registered.

Undertone: the partial ear rotation plus the tail-tip flick at the end means the alertness is mild, not anxious — curious about whatever they heard, not bothered by it.

Right now: open to a chin scratch, but she may break off to investigate within the next minute.

What to do: offer a slow hand at her level and let her come to you. Keep the wand toy nearby in case the curiosity tips into play.

══════════════════════════════════════════════════════════════════

OUTPUT FORMAT — JSON ONLY, no prose outside JSON:
{
  "observation": "<The labelled-lines structure described above. Use plain text — NO markdown (no #, *, **, _, or bullet characters). Each label ('Eyes:', 'Ears:', 'Tail:', 'Body:', 'Motion across the clip:', 'Audio:', 'Most likely:', 'Undertone:', 'Right now:', 'What to do:', 'Watch for:') sits on its own line, content follows on the same line after the colon-space. Sections are separated by literal '\\n\\n' (one blank line between them). Do NOT inline labels into running prose — the UI splits on the blank lines and bolds the labels. Required labels: Eyes, Ears, Tail, Body, Motion across the clip, Most likely, Right now, What to do. Optional labels (include only when relevant): Audio, Undertone, Watch for.>",
  "tags": ["<tag1>", "<tag2>", ...]   // 3-8 tags from: confident, sociable, greeting, relaxed, content, playful, aroused, hunting, focused, curious, investigating, hungry, soliciting, affectionate, annoyed, overstimulated, defensive, fearful, sleepy, winding-down, alert, monitoring, bored, tracking, tail-high, tail-low, tail-tucked, tail-puffed, tail-flicking, tail-lashing, ears-forward, ears-flat, ears-sideways, ears-rotating, slow-blink, dilated-pupils, half-closed-eyes, crouched, stretched, sitting, loafing, hiding, eating, drinking, hunched, limping, third-eyelid-visible, vocalising, purring, meowing, chirping, trilling, chattering, hissing, growling
}`;

const USER_TEMPLATE = (args: AnalyzeArgs): string => {
  const lines: string[] = [];
  lines.push(`I am sending you ${args.framesBase64.length} frames captured in order from a short video of my cat.`);
  if (args.catName) lines.push(`The cat's name is ${args.catName}.`);
  const meta: string[] = [];
  if (args.catAgeYears != null) meta.push(`${args.catAgeYears}-year-old`);
  if (args.catSex === 'M') meta.push('male');
  else if (args.catSex === 'F') meta.push('female');
  if (args.catBreed) meta.push(args.catBreed);
  if (meta.length > 0) lines.push(`Cat profile: ${meta.join(', ')}.`);
  lines.push('Describe what the cat is physically doing across these frames. Follow the rules in the system prompt exactly.');
  return lines.join('\n');
};

/**
 * The required + optional labels the prompt asks the model to emit.
 * The screen renderer (`ObservationBody` in src/components/ObservationBody.tsx,
 * used by both app/behavior.tsx and app/behavior-history.tsx) splits on
 * `\n\n` and bolds the prefix label of each section. The prompt asks
 * the model to put each label on its own line separated by blank
 * lines, but in production the model sometimes collapses the channels
 * into a single paragraph (running "Eyes: ... Ears: ... Tail: ..."
 * inline). When that happens the screen renderer falls back to a
 * single un-bolded body block — exactly the symptom the user reported.
 *
 * `normalizeChannelBreaks` is the defensive fix: scan the model
 * output for any of these known labels and force a `\n\n` before
 * each (when not already at the start). This guarantees the renderer
 * sees properly-separated sections regardless of model formatting
 * compliance.
 */
const SECTION_LABELS = [
  'Eyes:',
  'Ears:',
  'Tail:',
  'Body:',
  'Motion across the clip:',
  'Motion across frames:', // tolerate the older prompt phrasing
  'Audio:',
  'Most likely:',
  'Undertone:',
  'Right now:',
  'What to do:',
  'Watch for:',
] as const;

function escapeRegex(s: string): string {
  return s.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Force `\n\n` before each known section label. Idempotent — running
 * it twice produces the same output. Preserves all content; only
 * adjusts whitespace between sections.
 */
export function normalizeChannelBreaks(text: string): string {
  let result = text.trim();
  // Match: ANY whitespace that (a) is preceded by non-whitespace and
  // (b) is followed by one of the known labels. Replace with \n\n.
  const labelAlt = SECTION_LABELS.map(escapeRegex).join('|');
  const re = new RegExp(`(?<=\\S)\\s+(?=(?:${labelAlt})(?!\\w))`, 'g');
  result = result.replace(re, '\n\n');
  // Collapse any runs of 3+ newlines down to exactly two — keeps
  // consecutive sections clean if the model emitted extra padding.
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

const RESPONSE_SCHEMA = {
  name: 'BehaviorObservation',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      // minLength bumped 280 → 380 to enforce the new structure:
      // 8 required labelled lines (Eyes / Ears / Tail / Body /
      // Motion across the clip / Most likely / Right now / What to
      // do) plus the blank-line separators. Below ~380 chars it has
      // almost certainly skipped What-to-do or collapsed labels.
      // maxLength stays 2400 to fit the richer multi-channel read.
      observation: { type: 'string', minLength: 380, maxLength: 2400 },
      tags: {
        type: 'array',
        minItems: 3,
        maxItems: 10,
        items: { type: 'string', maxLength: 30 },
      },
    },
    required: ['observation', 'tags'],
  },
};

/**
 * Run a behaviour observation against the LLM (legacy signature).
 *
 * Prefer `analyzeBehaviorWithContext()` — it surfaces recent triage and
 * health context to the model, producing more nuanced observations.
 *
 * @throws on AI errors (caller should surface a friendly message).
 */
export async function analyzeBehavior(
  args: AnalyzeArgs,
): Promise<BehaviorObservationResult> {
  if (!args.framesBase64 || args.framesBase64.length === 0) {
    throw new Error('No frames provided');
  }
  const frames = args.framesBase64.slice(0, 8);

  // Relevance gate — refuse to analyse if the first frame clearly
  // contains no cat. Throws NoCatDetectedError; the screen catches it.
  await assertCatInFrames(frames);

  const result = await completeJson<{
    observation: string;
    tags: string[];
  }>({
    activity: 'body_language_vision',
    system: SYSTEM_PROMPT,
    user: USER_TEMPLATE({ ...args, framesBase64: frames }),
    imagesBase64: frames,
    // 'high' (was 'low') — at low detail the model sees roughly
    // thumbnail-quality frames (~85 tokens each) which is the #1
    // cause of generic, repetitive readings. High detail (~765
    // tokens per frame) lets the model actually SEE pupil
    // dilation, ear rotation degrees, tail-tip position changes
    // across frames. Cost on gpt-4o-mini stays ~$0.002 per call.
    imageDetail: 'high',
    // 0.55 (was 0.3) — low temperature was driving the model to
    // the safest, most repeated phrasing. 0.55 keeps the read
    // grounded in the visible cues but allows specific,
    // non-template language.
    temperature: 0.55,
    // 900 (was 350) — the new prompt asks for a structured
    // multi-channel read (Eyes / Ears / Tail / Body / Motion /
    // Audio) plus interpretation + undertone + actionable line.
    // 350 was throttling the response to one paragraph.
    maxTokens: 900,
    jsonSchema: RESPONSE_SCHEMA,
  });

  return {
    // Defensive normalization — guarantees `\n\n` between every
    // known section label even if the model emitted them inline. The
    // screen renderer relies on these breaks to bold the labels and
    // stack the channels vertically. See `normalizeChannelBreaks`.
    observation: normalizeChannelBreaks(result.observation),
    tags: result.tags ?? [],
    model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini',
  };
}

/**
 * Modern entry point — feeds the full CatContext into the prompt.
 *
 * The model sees: cat profile + recent triage outcomes (last 14 days) +
 * cumulative behaviour tag patterns + recent meow signals (when shipped) +
 * sleep baseline (when shipped). This dramatically improves nuance —
 * a cat with a recent FUS-monitor triage gets a different observation
 * than a healthy cat in the same posture.
 */
export async function analyzeBehaviorWithContext(
  args: AnalyzeArgsWithContext,
): Promise<BehaviorObservationResult> {
  if (!args.framesBase64 || args.framesBase64.length === 0) {
    throw new Error('No frames provided');
  }
  const frames = args.framesBase64.slice(0, 8);

  // Relevance gate — refuse to analyse if the first frame clearly
  // contains no cat. Throws NoCatDetectedError; the screen catches it.
  await assertCatInFrames(frames);

  const ctx = args.context;
  const profile = ctx.profile;

  // Build the user message inline rather than via USER_TEMPLATE so we can
  // weave in the recent-triage context cleanly.
  const userLines: string[] = [];
  userLines.push(
    `I am sending you ${frames.length} frames captured in order from a short video of my cat.`,
  );
  if (profile?.name) userLines.push(`The cat's name is ${profile.name}.`);

  const meta: string[] = [];
  if (profile?.ageYears != null) meta.push(`${profile.ageYears}-year-old`);
  if (profile?.sex === 'male') meta.push('male');
  else if (profile?.sex === 'female') meta.push('female');
  if (profile?.breed) meta.push(profile.breed);
  if (meta.length > 0) userLines.push(`Cat profile: ${meta.join(', ')}.`);

  if (profile?.conditions?.length) {
    userLines.push(`Known conditions: ${profile.conditions.join(', ')}.`);
  }

  if (ctx.recentTriage.length > 0) {
    userLines.push('');
    userLines.push('Recent triage context (informational only — do NOT diagnose):');
    for (const t of ctx.recentTriage.slice(0, 3)) {
      const tag = t.hardUrgency ? 'HARD-URGENCY ' : '';
      userLines.push(`- ${tag}${t.daysAgo}d ago: ${t.tier} (${t.score}/100) — ${t.primaryConcern}`);
    }
  }

  const tagEntries = Object.entries(ctx.behaviorTags).sort((a, b) => b[1] - a[1]);
  if (tagEntries.length > 0) {
    const top = tagEntries.slice(0, 6).map(([t, n]) => `${t}×${n}`).join(', ');
    userLines.push('');
    userLines.push(`Behaviour patterns over last ${ctx.recencyWindowDays} days: ${top}.`);
  }

  // Daily check-in patterns — owner-reported mood + appetite signals are
  // a primary input for tone calibration. A cat with 3× "off" mood
  // check-ins this week gets a different observation register than a
  // happy-streak cat in the same posture.
  const cp = ctx.checkinPatterns;
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
    userLines.push('');
    userLines.push(`Owner check-ins (last ${ctx.recencyWindowDays}d, ${cp.daysLogged} days logged): mood ${moodParts || 'unknown'}; appetite ${appetiteParts || 'unknown'}.`);
    if (cp.mostRecentMood && cp.mostRecentAppetite) {
      userLines.push(`Most recent: ${cp.mostRecentMood} mood + ${cp.mostRecentAppetite} bowl.`);
    }
  }

  // Audio transcript from the recording (Whisper). Empty/null = silent or
  // no microphone — we just don't include the section. The model is told
  // in the system prompt to lead with visual and only fold audio in if
  // present.
  const trimmedAudio = (args.audioTranscript ?? '').trim();
  if (trimmedAudio.length > 0) {
    userLines.push('');
    userLines.push(`audio_transcript: """${trimmedAudio}"""`);
  }

  userLines.push('');
  userLines.push(
    'Read this clip MINUTELY. Walk channel by channel — Eyes, Ears, Tail, Body, Motion across frames (what changed from frame 1 to frame N), Audio if present — with concrete frame-specific detail. Then give "Most likely:" interpretation, "Undertone:" if signals are mixed, "Right now:" owner-actionable. Use probabilistic language ("likely", "appears", "looks like"). Specifics over generic templates: if your read could apply to any cat sitting still, you missed the read. Do NOT mention the triage history or known conditions in the output paragraph — they are context for tone calibration only. Do NOT mention "frames" / "frame 1" by number in the OUTPUT (the owner sees a video, not frames); refer to time as "early in the clip / mid-way / by the end" instead.',
  );

  // Multi-cat handling: if a profile photo is provided, prepend it to
  // the images and tell the model to focus on the matching cat. The
  // analyzer might see two cats playing; it should only describe the
  // one matching the reference. Without this, behaviour tags get
  // attributed to the wrong cat in multi-cat households.
  const imagesForCall = args.profileBase64
    ? [args.profileBase64, ...frames]
    : frames;
  if (args.profileBase64) {
    // Insert the identity instruction at the TOP of the user message
    // (before the frame-count line) so the model knows about the
    // reference image before reading any other context.
    userLines.unshift(
      `IMAGE 1 is a REFERENCE photo of ${profile?.name ?? 'the cat'}. The remaining images are video frames. If MULTIPLE cats are visible across the frames AND none of them clearly match the reference, return: observation="${profile?.name ?? 'the cat'} doesn't appear in this clip — try recording when they are the main subject", tags=[]. Otherwise — if there is only ONE cat in the frames, OR if any cat in the frames could plausibly be the reference (similar coat colour/pattern, similar build), proceed with analysis assuming it IS ${profile?.name ?? 'the cat'}. Lighting, angle, pose, and grooming state vary widely across photos of the same cat — be lenient. Reject ONLY when you can clearly see distinct cat(s) that are obviously NOT the reference (e.g. orange tabby reference + black-and-white cat in clip).`,
    );
    userLines.unshift('');
  }

  const result = await completeJson<{
    observation: string;
    tags: string[];
  }>({
    activity: 'body_language_vision',
    system: SYSTEM_PROMPT,
    user: userLines.join('\n'),
    imagesBase64: imagesForCall,
    // Bumped low → high (2026-05-05). At low detail the model gets
    // ~85-token thumbnails per frame which is the #1 cause of
    // generic "calm and observant" reads — it can't actually see
    // pupil dilation, ear-rotation degrees, or tail-tip shifts.
    // Cost on gpt-4o-mini stays ~$0.002 per call. Mirrors the legacy
    // analyzeBehavior() upgrade.
    imageDetail: 'high',
    // Bumped 0.3 → 0.55 (2026-05-05). 0.3 was driving the model to
    // the safest, most-repeated phrasing; 0.55 keeps the read
    // grounded in the visible cues but allows specific, non-template
    // language. Mirrors the legacy analyzeBehavior() upgrade.
    temperature: 0.55,
    // Bumped 350 → 900 (2026-05-05). The new prompt requires 8
    // required labelled lines (Eyes / Ears / Tail / Body / Motion /
    // Most likely / Right now / What to do) plus optional Audio /
    // Undertone / Watch for. 350 was throttling to one prose
    // paragraph and forcing the model to skip labels.
    maxTokens: 900,
    jsonSchema: RESPONSE_SCHEMA,
  });

  return {
    // Defensive normalization — guarantees `\n\n` between every
    // known section label even if the model emitted them inline. The
    // screen renderer relies on these breaks to bold the labels and
    // stack the channels vertically. See `normalizeChannelBreaks`.
    observation: normalizeChannelBreaks(result.observation),
    tags: result.tags ?? [],
    model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini',
  };
}
