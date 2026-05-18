/**
 * Meow Translator — multimodal cat-vocalization interpreter.
 *
 * Audio-only meow interpreters classify a meow into ~12 generic
 * categories ("Happy/Content", "Hunting", "Mating Call"). The labels
 * are identical for every cat — they read fine once but they die the
 * moment the owner tries to share one with a friend. Nobody
 * screenshots "Mating Call".
 *
 * CatMD's translator wins on three axes audio-only interpreters can't:
 *
 *   1. MULTIMODAL FUSION
 *      We capture audio AND 3-4 video frames AND cat memory in one shot.
 *      Audio-alone is ambiguous (a meow at the food bowl vs a meow at
 *      the door is the same waveform). Vision disambiguates context;
 *      memory disambiguates intent. Research backing: JL-TFMSFNet (Liu
 *      et al, Expert Systems w/ Applications 2024) shows time–frequency
 *      attention beats audio-only by 3-5 pp; ViT models (Towards
 *      Understanding Cat Vocalizations, 2024) reach 96.95% on
 *      mel-spectrograms. We don't run our own ViT — gpt-4o-mini's
 *      multimodal reasoning over Whisper transcript + frames + cat
 *      context approximates the same fusion pattern.
 *
 *   2. PERSONALISATION
 *      The output is in the OWNER'S CAT'S VOICE — using the cat's name,
 *      pronouns, archetype, recent events, and known world entries
 *      (toys, foods, people). A generic interpreter says "Happy/Content";
 *      CatMD's Lily (Skittish-Sensitive archetype, last triage = mild
 *      eye irritation 3 days ago) might say: "fine. eye stopped itching.
 *      we're not friends though." That's screenshottable.
 *
 *   3. CALIBRATED HONESTY
 *      Three-context priors from the CatMeows dataset (Ludovico et al
 *      2020 — 440 vocalisations from 21 cats across brushing, isolation,
 *      and waiting-for-food contexts). The prompt anchors on these
 *      ground-truth-validated contexts and reports confidence: "high"
 *      when frames + audio + context converge; "low" when channels
 *      disagree. Purrs are explicitly NOT translated as "happy" —
 *      research is consistent that purring is bidirectional
 *      self-soothing.
 *
 * Cost: ~$0.0013 per translation
 *   — Whisper: $0.0004 (4-sec audio @ $0.006/min)
 *   — gpt-4o-mini multimodal: ~$0.0009 (4 high-detail frames + ~600 tok
 *     prompt + ~200 tok completion)
 *
 * The service is stateless. Persistence + Supabase mirror happen in the
 * caller (app/translate.tsx writes a `meow_translation` health event).
 */
import { completeJson } from '../ai/client';
import { trackLLMUsage } from './analytics';
import { getPronounDirective } from './pronouns';
import {
  transcribeBehaviorAudio,
  NoCatDetectedError,
} from './behaviorObservation';
import { classifyPhotoFull } from '../ai/classify';
import { usePersonalityStore } from '../state/personalityStore';
import { hasEnoughDataForReveal } from './personality';
import type { CatContext } from './catContext';

// Re-export so the screen can do `instanceof NoCatDetectedError` without
// pulling behaviorObservation directly. Single import surface.
export { NoCatDetectedError } from './behaviorObservation';

/**
 * Thrown when the relevance gate detects the clip has no audible meow
 * (or any other cat vocalization). The product contract for the meow
 * translator is: you record a meow, we interpret the meow. Silent
 * clips break that contract — instead of producing a low-credibility
 * "silent body-only" translation, we surface this error and the
 * screen routes the user to /behavior (Body Language Reader, which
 * IS the silent-clip surface).
 *
 * What counts as "no meow detected":
 *   - Whisper returned null (no audio track, or transcription failed)
 *   - Whisper returned an empty / very short string after trimming
 *   - Whisper returned a known English hallucination (already filtered
 *     by transcribeBehaviorAudio, but defence-in-depth)
 */
export class NoMeowDetectedError extends Error {
  constructor() {
    super(
      'No meow detected in the clip. The Meow Translator needs an actual vocalization to interpret.',
    );
    this.name = 'NoMeowDetectedError';
  }
}

// ── Public types ───────────────────────────────────────────────────────────

/**
 * Vocalization taxonomy (CatSound dataset, Pandeya 2018, MDPI Applied
 * Sciences). 'silent' covers the (common) case where the cat didn't
 * vocalise during the clip — the visual + context channels still
 * produce a useful translation.
 */
export type VocalizationType =
  | 'meow'
  | 'trill'
  | 'chirp'
  | 'purr'
  | 'hiss'
  | 'growl'
  | 'yowl'
  | 'chatter'
  | 'silent'
  | 'other';

/**
 * Intent taxonomy. 10 high-level classes — narrow enough that the model
 * picks one cleanly, rich enough to drive different translations. The
 * UI may collapse multiple intents into a single icon but the
 * downstream catContext / cat-says greatest-hits scroll uses the
 * granular type.
 */
export type MeowIntent =
  | 'greeting'           // "Hi, you're home."
  | 'demand_food'        // "Bowl. NOW."
  | 'demand_attention'   // "Look at me."
  | 'annoyed'            // "Stop that."
  | 'playful'            // "Game on."
  | 'comfort_seeking'    // "Sit with me."
  | 'warning'            // "Back off."
  | 'distress'           // "Something's wrong." (vet flag)
  | 'curious'            // "What is that thing?"
  | 'self_soothing'      // purring while stressed; coping
  | 'other';

export type MeowConfidence = 'high' | 'moderate' | 'low';

export type MeowTranslationResult = {
  vocalization_type: VocalizationType;
  intent: MeowIntent;
  confidence: MeowConfidence;
  /**
   * The shareable line — written as the cat, in their voice, using
   * their name + archetype + recent context. 40-160 chars (one
   * screenshottable sentence).
   */
  translation: string;
  /**
   * One-sentence technical reasoning. Surfaces in a small caption
   * under the translation: "Tail-up, cheek-rub, no audio — read as
   * greeting." Helps the user trust the read.
   */
  why: string;
  /** Whether we got useful audio. Drives the "voice + body" badge in UI. */
  had_audio: boolean;
  /** Whisper transcript when present, for the "we heard:" caption. */
  audio_transcript: string | null;
  /** Which model produced this — for analytics + debugging. */
  model: string;
};

export type TranslateMeowArgs = {
  framesBase64: string[];
  context: CatContext;
  /** Local file:// URI of the source video — for Whisper. Optional. */
  videoUri?: string | null;
};

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are CatMD's Meow Translator — a multimodal feline-vocalization interpreter. You receive 3-4 short video frames + an optional audio transcript (Whisper) + the cat's profile / recent events / personality. Your job is to produce a single, screenshot-worthy translation in the CAT'S OWN VOICE.

══════════════════════════════════════════════════════════════════
THE BRAND BAR — what makes a translation good:

A translation is GOOD when the owner's first instinct is to screenshot it and send it to their best friend. That requires THREE things:

1. SPECIFIC to THIS cat. Use the name. Reference real things from the cat's recent events, world memory, archetype. Generic translations ("I'm hungry", "I love you") are FAILURES — the owner can already guess that.

2. IN THE CAT'S VOICE. Not "Lily seems hungry." Lily HERSELF speaks: "bowl. now. don't make me ask twice." First-person, present-tense, the cat's tone.

3. ONE LINE. 40-160 chars. Period at the end. No ellipses. No "...". Like a thought-bubble caption, not a paragraph.

══════════════════════════════════════════════════════════════════
TONE CALIBRATION — match the cat's archetype:

- Confident-Communicator → declarative, slightly dramatic
- Hunter-Athlete → terse, action-driven, twitchy
- Skittish-Sensitive → wary, conditional, withdrawn
- Velcro-Cat → openly affectionate, needy, soft
- Cool-Observer → ironic, detached, clipped

If no archetype is known, default to a slightly dry, observant tone — better than overshooting into purple prose.

══════════════════════════════════════════════════════════════════
THE 10 VOCALIZATION TYPES (use exactly one):

- meow      — the all-purpose request. Most adult cat-to-human calls.
- trill     — short rolled "brrrr"/"prrrt". Friendly greeting.
- chirp     — high mother-to-kitten call. Excited, friendly.
- purr      — continuous low vibration. NOT automatically "happy" —
              cats purr in distress as much as contentment. Pair
              with body channels before reading.
- hiss      — defensive, asking for space.
- growl     — sustained low warning. Distinct from purr (exhale-
              dominant, strained).
- yowl      — long mournful call. Distress / mating / cognitive
              decline in seniors.
- chatter   — rapid teeth-click at prey through window. Frustrated
              predatory state, NOT distress.
- silent    — no vocalization in the clip. Visual + context only.
- other     — when the audio is genuinely ambiguous.

══════════════════════════════════════════════════════════════════
THE 10 INTENTS (use exactly one):

- greeting          — tail-up, head-up, walking toward owner; trills/chirps.
- demand_food       — near food bowl, leg-rubbing, repeated meows toward owner.
- demand_attention  — repeated meows + eye-contact, no resource target.
- annoyed           — tail-lashing, ears sideways, pulling away from contact, brief growl.
- playful           — crouched + butt-wiggle, dilated pupils, motion blur in frames.
- comfort_seeking   — slow approach, kneading, lap-bound, soft eyes; trills.
- warning           — flat ears, defensive crouch, hiss/growl. ASKING FOR DISTANCE.
- distress          — yowling, hiding, hunched-tucked, sustained vocal pacing.
                      THIS IS A VET-FLAG — translation must NOT be cute.
- curious           — slow approach + extended neck + sniffing posture.
- self_soothing     — purring while stressed (vet, after injury, hiding).
                      Body says fear; audio says purr — read as coping.
- other             — when none fits cleanly.

══════════════════════════════════════════════════════════════════
THREE-CONTEXT PRIORS (CatMeows dataset, Ludovico 2020) — these are
the only three contexts with strong ground-truth acoustic signatures:

- BRUSHING / AFFECTION — short, mid-pitch meows, often paired with
  cheek-rubbing or rolling. Reads as comfort_seeking or greeting.
- ISOLATION / ANXIETY — longer, higher-pitched, repeated yowl-meows
  from a hiding spot. Reads as distress or comfort_seeking.
- WAITING-FOR-FOOD — repetitive demand-meows directed at the owner
  near food zones. Reads as demand_food.

If the audio + visual cues fit one of these three contexts cleanly,
confidence is "high". If channels disagree (e.g. purring while
hunched-tucked) confidence is "moderate" + read as self_soothing.
If both audio and frames are ambiguous, confidence is "low".

══════════════════════════════════════════════════════════════════
CONFIDENCE RULES:

- high      — audio + frames + context all converge on one read.
- moderate  — channels broadly agree but one channel is missing
              (e.g. silent clip, just frames + context) OR mild
              mixed signal.
- low       — channels disagree, ambiguous frames, or the clip
              shows nothing distinctive. The translation should
              be HEDGED in the cat's voice ("...probably?").

═════════════════════════════════════════════════════════════════
HARD RULES:

1. NEVER fabricate emergencies. If the body language doesn't show
   distress, don't write a distress translation just to be dramatic.

2. NEVER translate a purr as "I love you / I'm so happy" without
   visual confirmation (loafing, half-closed eyes, soft body). A
   purr alone is bidirectional self-soothing — not auto-happy.

3. USE THE CAT'S NAME. The owner is screenshotting THIS — generic
   "I" lines are forgettable. Name-anchored lines are sticky.

4. RESPECT PRONOUNS. The user message will include a pronoun directive
   ("X is male — use he/him"). Do NOT default to she/her. Never
   misgender the cat.

5. DO NOT mention "frames", "audio transcript", or "the model" in
   the translation. The owner sees a video, not implementation
   details.

6. distress intent → translation MUST be earnest, NOT cute. Owners
   take this seriously. A dramatic translation here erodes trust
   for the next 100 readings.

══════════════════════════════════════════════════════════════════
EXAMPLES OF GOOD TRANSLATIONS (for tone calibration only — never copy):

Profile: Lily, female, Skittish-Sensitive, recent: tuna for dinner yesterday.
Frames: half-loaf on rug, half-closed eyes, slow blink.
Audio: brief "mrrp".
→ vocalization_type: trill, intent: comfort_seeking, confidence: high.
→ translation: "okay. you may sit on the floor near me. don't talk."
→ why: "Slow-blink + relaxed loaf + brief trill — comfort from a guarded cat."

Profile: Hichki, male, Hunter-Athlete, recent: window-bird-watching daily.
Frames: low crouch, butt-wiggle, dilated pupils.
Audio: "ek-ek-ek" chatter.
→ vocalization_type: chatter, intent: playful, confidence: high.
→ translation: "the bird. THE bird. it's right there. let me out, human."
→ why: "Classic predatory chatter + crouch — frustrated hunter mode."

Profile: Mochi, male, Velcro-Cat, recent: scan flagged mild eye discharge 2d ago.
Frames: hunched-tucked under chair, slow blink.
Audio: continuous purr.
→ vocalization_type: purr, intent: self_soothing, confidence: moderate.
→ translation: "i'm purring but i'm not okay. eye still hurts. stay close."
→ why: "Purr + hunched-tucked + recent eye flag — coping, not contented."

══════════════════════════════════════════════════════════════════
OUTPUT — JSON ONLY, exactly the schema:

{
  "vocalization_type": "<one of the 10 types>",
  "intent": "<one of the 10 intents>",
  "confidence": "<high | moderate | low>",
  "translation": "<40-160 chars, cat's first-person voice, ends with period>",
  "why": "<one sentence, observational + technical, references the channels>"
}`;

// ── Response schema (OpenAI structured outputs) ────────────────────────────

const RESPONSE_SCHEMA = {
  name: 'MeowTranslation',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      vocalization_type: {
        type: 'string',
        enum: [
          'meow',
          'trill',
          'chirp',
          'purr',
          'hiss',
          'growl',
          'yowl',
          'chatter',
          'silent',
          'other',
        ],
      },
      intent: {
        type: 'string',
        enum: [
          'greeting',
          'demand_food',
          'demand_attention',
          'annoyed',
          'playful',
          'comfort_seeking',
          'warning',
          'distress',
          'curious',
          'self_soothing',
          'other',
        ],
      },
      confidence: { type: 'string', enum: ['high', 'moderate', 'low'] },
      translation: { type: 'string', minLength: 30, maxLength: 200 },
      why: { type: 'string', minLength: 30, maxLength: 240 },
    },
    required: ['vocalization_type', 'intent', 'confidence', 'translation', 'why'],
  },
};

// ── Internal: relevance gate ───────────────────────────────────────────────

/**
 * First-frame cat-relevance check — same gate the body-language flow
 * uses. Cheaper to fail here ($0.0001) than to send the whole burst
 * + audio call. Throws NoCatDetectedError on HIGH-confidence "no cat"
 * results; ambiguous cases fall through to the main call.
 */
async function assertCatInFrames(framesBase64: string[]): Promise<void> {
  const first = framesBase64[0];
  if (!first) return;
  const cls = await classifyPhotoFull(first);
  if (cls.mode === 'irrelevant') {
    throw new NoCatDetectedError(cls.reason);
  }
}

// ── Public entry point ─────────────────────────────────────────────────────

/**
 * Run a full meow translation against the cat-context + frames + audio.
 *
 * Throws NoCatDetectedError when the relevance gate refuses (no cat in
 * frame). Otherwise returns a MeowTranslationResult ready to render +
 * persist.
 */
export async function translateMeow(
  args: TranslateMeowArgs,
): Promise<MeowTranslationResult> {
  if (!args.framesBase64 || args.framesBase64.length === 0) {
    throw new Error('No frames provided');
  }
  const frames = args.framesBase64.slice(0, 4); // cap at 4 — short clip

  // Relevance gate — the entire translator call is wasted if there's no
  // cat in the clip. Throws if the model is HIGHLY confident there's
  // no cat; ambiguous frames are allowed through.
  await assertCatInFrames(frames);

  // Audio path — kicked off in parallel with context build. Whisper is
  // best-effort (silent clips are common and totally fine — the visual
  // + memory channels still produce a useful translation).
  const audioPromise: Promise<string | null> = args.videoUri
    ? transcribeBehaviorAudio(args.videoUri).catch(() => null)
    : Promise.resolve(null);

  const ctx = args.context;
  const profile = ctx.profile;
  const audioTranscript = await audioPromise;

  // Build the user message — same pattern as analyzeBehaviorWithContext
  // (cat profile + pronoun directive + behaviour patterns + recent
  // events + audio transcript).
  const lines: string[] = [];
  lines.push(
    `I am sending you ${frames.length} frames captured in order from a 4-second video of my cat.`,
  );
  if (profile?.name) lines.push(`The cat's name is ${profile.name}.`);

  const meta: string[] = [];
  if (profile?.ageYears != null) meta.push(`${profile.ageYears}-year-old`);
  if (profile?.sex === 'male') meta.push('male');
  else if (profile?.sex === 'female') meta.push('female');
  if (profile?.breed) meta.push(profile.breed);
  if (meta.length > 0) lines.push(`Cat profile: ${meta.join(', ')}.`);

  // Pronoun directive — overrides any she/her bias in examples. Same
  // pattern as behaviorObservation.ts. Critical for male / unknown-sex
  // cats.
  if (profile?.name) {
    lines.push(
      `Pronouns: ${getPronounDirective(profile.name, profile.sex ?? 'unknown')}`,
    );
  }

  // Archetype — drives tone calibration. The system prompt has 5
  // archetype tone rules; injecting the active one anchors the model
  // to the right voice. Pulled directly from personalityStore (same
  // pattern as chat.ts) since CatContext doesn't carry archetype.
  if (profile?.id) {
    const personalityProfile = usePersonalityStore
      .getState()
      .getProfile(profile.id);
    if (personalityProfile && hasEnoughDataForReveal(personalityProfile)) {
      lines.push(`Personality archetype: ${personalityProfile.archetype}.`);
    }
  }

  // Body self-image — derived in catContext from breed + age + weight
  // + BCS. Gives the translator a felt-sense layer (lithe young-adult
  // Bengal vs stocky senior Maine Coon) so the line lands in the
  // right body-voice. Translator is the most-shared surface in the
  // app, so getting the body register right matters more here than
  // anywhere else.
  if (ctx.bodySelf) {
    lines.push('');
    lines.push(`Body self-image: ${ctx.bodySelf.selfImage}.`);
    lines.push(ctx.bodySelf.toneDirective);
  }

  // Recent triage / health flags — bias interpretation toward the
  // self_soothing class when there's a recent physical concern (a
  // purr in a cat with a 2-day-old eye flag is coping, not happy).
  if (ctx.recentTriage.length > 0) {
    lines.push('');
    lines.push('Recent triage context (do NOT diagnose — informational):');
    for (const t of ctx.recentTriage.slice(0, 3)) {
      const tag = t.hardUrgency ? 'HARD-URGENCY ' : '';
      lines.push(`- ${tag}${t.daysAgo}d ago: ${t.tier} — ${t.primaryConcern}`);
    }
  }

  // Behaviour patterns — top tags over the recent window. Helps the
  // model match the translation to the cat's CHARACTER, not just
  // this clip.
  const tagEntries = Object.entries(ctx.behaviorTags).sort(
    (a, b) => b[1] - a[1],
  );
  if (tagEntries.length > 0) {
    const top = tagEntries
      .slice(0, 5)
      .map(([t, n]) => `${t}×${n}`)
      .join(', ');
    lines.push('');
    lines.push(
      `Recent behaviour patterns over last ${ctx.recencyWindowDays} days: ${top}.`,
    );
  }

  // Recent meow signals — once Phase B ships, this surfaces the cat's
  // vocal history so the model can match the new translation to the
  // cat's running voice. e.g. "consistent annoyed meow trio in last 3
  // days" → keep the new line in that register, don't suddenly
  // translate as comfort_seeking.
  if (ctx.recentMeowSignals.length > 0) {
    lines.push('');
    lines.push('Recent meow signals (last 14 days):');
    for (const m of ctx.recentMeowSignals.slice(0, 3)) {
      lines.push(`- ${m.daysAgo}d ago: ${m.label}`);
    }
  }

  // Daily check-in patterns — owner-reported mood. A streak of 'off'
  // mood check-ins should bias the read away from cute toward earnest.
  const cp = ctx.checkinPatterns;
  if (cp.daysLogged > 0 && cp.mood.off > 0) {
    lines.push('');
    lines.push(
      `Owner check-ins: ${cp.mood.off}× 'off' mood in last ${ctx.recencyWindowDays} days. Calibrate translation toward earnest, not playful.`,
    );
  }

  // Audio — the headline channel for THIS surface. Unlike the body-
  // language reader (which embraces silent clips), the meow translator
  // REQUIRES an audible vocalization. Producing a "silent body-only"
  // translation here erodes credibility — the product contract is "you
  // record a meow, we interpret the meow". Silent clips belong on
  // /behavior; we throw and the screen routes the user there.
  const trimmedAudio = (audioTranscript ?? '').trim();
  if (trimmedAudio.length === 0) {
    throw new NoMeowDetectedError();
  }
  lines.push('');
  lines.push(`audio_transcript: """${trimmedAudio}"""`);
  lines.push(
    'Note: Whisper transcribes cat sounds approximately ("mrr", "mew", "prrt"). Read these as the model heard them; do not assume English.',
  );

  lines.push('');
  lines.push(
    `Produce a SINGLE translation in ${profile?.name ?? 'the cat'}'s own voice. Use their name. Match their archetype tone. Reference real recent context where it fits naturally — never invent. ONE LINE, 40-160 chars, ends with a period. The "why" line is technical — name the body channels and the audio cue you weighted.`,
  );

  const result = await completeJson<{
    vocalization_type: VocalizationType;
    intent: MeowIntent;
    confidence: MeowConfidence;
    translation: string;
    why: string;
  }>({
    activity: 'meow_translation',
    system: SYSTEM_PROMPT,
    user: lines.join('\n'),
    imagesBase64: frames,
    // High detail — the model needs to read pupil, ear position,
    // posture from the frames. Cost on gpt-4o-mini stays ~$0.0009.
    imageDetail: 'high',
    // 0.6 — slightly higher than body-language because the brand bar
    // is "screenshottable / quotable", which rewards a touch more
    // creative latitude. Anchored hard to the schema so the structure
    // never drifts.
    temperature: 0.6,
    // 350 tokens is plenty for one translation + schema fields. We
    // don't want long-form prose — the brand wall is "one line".
    maxTokens: 350,
    jsonSchema: RESPONSE_SCHEMA,
  });

  // Defensive: clean stray quotes / wrapping the model occasionally
  // emits despite the schema. Trim to the spec.
  const cleanedTranslation = sanitizeTranslation(result.translation);
  const cleanedWhy = result.why.trim();

  // Telemetry — one llm_usage event for the multimodal call. Whisper
  // already tracked itself inside transcribeBehaviorAudio.
  trackLLMUsage({
    activity: 'meow_translation',
    model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini',
    image_count: frames.length,
  });

  return {
    vocalization_type: result.vocalization_type,
    intent: result.intent,
    confidence: result.confidence,
    translation: cleanedTranslation,
    why: cleanedWhy,
    // After the no-meow gate above, trimmedAudio is guaranteed non-
    // empty — kept as constants for clarity. If we ever loosen the
    // gate (e.g. accept silent clips in a "Pro" tier), flip these.
    had_audio: true,
    audio_transcript: trimmedAudio,
    model: process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini',
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Strip stray surrounding quotes / wrapping characters that the model
 * occasionally adds despite structured output. The translation is the
 * MOST visible field in the entire feature — keep it pristine. We
 * don't fix punctuation aggressively (the model is allowed to use
 * ellipses, lowercase starts, etc., as voice features); we only
 * remove obvious wrappers.
 */
export function sanitizeTranslation(s: string): string {
  let out = s.trim();
  // Strip pairs of surrounding quotes (single, double, smart) — once.
  const QUOTES: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'], // smart double
    ['‘', '’'], // smart single
  ];
  for (const [open, close] of QUOTES) {
    if (out.startsWith(open) && out.endsWith(close) && out.length > 2) {
      out = out.slice(open.length, out.length - close.length).trim();
      break;
    }
  }
  return out;
}

/**
 * Compact label suitable for catContext.recentMeowSignals.label and the
 * cat-says greatest-hits scroll. Combines vocalization + intent into a
 * single readable string — "trill / comfort_seeking" reads better than
 * two columns in a UI tile.
 */
export function meowSignalLabel(r: {
  vocalization_type: VocalizationType;
  intent: MeowIntent;
}): string {
  const v = r.vocalization_type === 'silent' ? 'silent body-read' : r.vocalization_type;
  const i = r.intent.replace(/_/g, ' ');
  return `${v} / ${i}`;
}
