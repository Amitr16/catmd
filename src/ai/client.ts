/**
 * Provider-agnostic LLM client. Defaults to OpenAI (gpt-4o-mini) but the
 * same interface works against any OpenAI-compatible endpoint (including a
 * self-hosted Cloudflare Worker proxy set via EXPO_PUBLIC_AI_BASE_URL).
 *
 * In production you should ship an edge-proxy and leave the client-side
 * key blank — bundled keys are extractable from the APK in minutes. The
 * client falls back to the edge URL if no local key is present.
 *
 * Token / cost tracking
 * ---------------------
 * Every chat / text / embed call here emits a `llm_usage` PostHog event
 * tagged with the calling feature (`activity`). PostHog dashboards
 * aggregate by distinct_id (per-user spend) and by activity (per-feature
 * spend). Image-gen tracking is intentionally NOT done here — the proxy
 * worker captures it server-side because it sees the canonical request
 * boundary and authoritative response, and because not every install
 * uses the proxy (in dev the client hits OpenAI directly).
 *
 * Activity is REQUIRED on every call so we never get an unattributed
 * llm_usage event in PostHog — making per-feature aggregation reliable.
 */
import { trackLLMUsage, type LLMActivity, getDistinctId } from '../services/analytics';
const provider = process.env.EXPO_PUBLIC_AI_PROVIDER ?? 'openai';
const model = process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini';
const emergencyModel =
  process.env.EXPO_PUBLIC_AI_EMERGENCY_MODEL ?? 'gpt-4o-mini';
const baseUrl = process.env.EXPO_PUBLIC_AI_BASE_URL || '';
const appSecret = process.env.EXPO_PUBLIC_AI_APP_SECRET || '';
const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const anthropicKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';
const enabled =
  (process.env.EXPO_PUBLIC_ENABLE_AI ?? 'true').toLowerCase() === 'true';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type CompleteJsonArgs = {
  system: string;
  user: string;
  /**
   * Feature tag for token/cost tracking. Required so every LLM call
   * is attributable in PostHog. Add new variants to LLMActivity in
   * `services/analytics.ts` — keeping the union closed bounds PostHog
   * cardinality and gives autocomplete on call sites.
   */
  activity: LLMActivity;
  /** Optional base64-encoded image attached to the user turn (vision). */
  imageBase64?: string | null;
  imageMime?: string;              // default: image/jpeg
  /** "low" keeps cost ~$0.001/img; "high" adds ~10x tokens. */
  imageDetail?: 'low' | 'high';
  /**
   * Optional ordered array of base64 images (multi-frame vision). Used by
   * the behaviour-observation flow which sends a burst of stills so the
   * model sees motion/posture across time. If both `imageBase64` and
   * `imagesBase64` are provided, `imagesBase64` wins.
   */
  imagesBase64?: string[] | null;
  temperature?: number;
  maxTokens?: number;
  useEmergencyModel?: boolean;
  /**
   * Optional OpenAI-style Structured Outputs JSON Schema. When provided
   * we use `response_format: {type: "json_schema"}` which gives
   * guaranteed schema-conformant output on compatible models. Falls back
   * to free-form JSON when omitted.
   */
  jsonSchema?: { name: string; strict: boolean; schema: Record<string, unknown> };
};

class AiDisabledError extends Error {}

function pickEndpoint() {
  if (baseUrl) return baseUrl.replace(/\/$/, '') + '/chat/completions';
  if (provider === 'openai')
    return 'https://api.openai.com/v1/chat/completions';
  // Anthropic uses a different URL shape; support it only when the worker
  // proxy is used. Raw anthropic from client is not supported here.
  throw new Error(
    'Direct Anthropic calls from the client are not supported — use a proxy via EXPO_PUBLIC_AI_BASE_URL.',
  );
}

function authHeader(): Record<string, string> {
  if (baseUrl) {
    // Proxy attaches the real API key server-side. We optionally send a
    // shared app-secret so drive-by scrapers of the APK can't abuse it.
    return appSecret ? { 'X-CatMD-App-Secret': appSecret } : {};
  }
  if (provider === 'openai' && openaiKey)
    return { Authorization: `Bearer ${openaiKey}` };
  throw new Error(
    'No AI credentials — set EXPO_PUBLIC_OPENAI_API_KEY or EXPO_PUBLIC_AI_BASE_URL.',
  );
}

/**
 * JSON-mode completion. Returns the parsed JSON object.
 * Throws on network error, HTTP error, or invalid JSON.
 */
export async function completeJson<T = unknown>({
  system,
  user,
  activity,
  imageBase64 = null,
  imagesBase64 = null,
  imageMime = 'image/jpeg',
  imageDetail = 'low',
  temperature = 0.2,
  maxTokens = 1500,
  useEmergencyModel = false,
  jsonSchema,
}: CompleteJsonArgs): Promise<T> {
  if (!enabled) throw new AiDisabledError('AI disabled via EXPO_PUBLIC_ENABLE_AI=false');

  const chosenModel = useEmergencyModel ? emergencyModel : model;
  const startedAt = Date.now();

  // Multi-modal content array when image(s) attached. OpenAI (and
  // OpenAI-compatible proxies) accept a user message where `content` is
  // either a string or an array of {type: "text"|"image_url", ...} blocks.
  // For multi-frame (behaviour observation) we attach each frame in order;
  // the model sees them as a sequence and can reason about motion.
  let userContent: unknown = user;
  if (imagesBase64 && imagesBase64.length > 0) {
    userContent = [
      { type: 'text', text: user },
      ...imagesBase64.map((b64) => ({
        type: 'image_url',
        image_url: {
          url: `data:${imageMime};base64,${b64}`,
          detail: imageDetail,
        },
      })),
    ];
  } else if (imageBase64) {
    userContent = [
      { type: 'text', text: user },
      {
        type: 'image_url',
        image_url: {
          url: `data:${imageMime};base64,${imageBase64}`,
          detail: imageDetail,
        },
      },
    ];
  }

  const responseFormat = jsonSchema
    ? { type: 'json_schema', json_schema: jsonSchema }
    : { type: 'json_object' };

  const resp = await fetch(pickEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
    },
    body: JSON.stringify({
      model: chosenModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
      response_format: responseFormat,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`LLM HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  const payload = await resp.json();
  const content = payload?.choices?.[0]?.message?.content ?? '{}';
  // Token-usage telemetry. OpenAI returns a `usage` object on chat
  // completions with prompt/completion/total counts. We capture them
  // before parsing the content so a JSON-parse failure doesn't lose
  // the spend signal (we still paid for the tokens).
  const usage = (payload?.usage ?? {}) as {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  trackLLMUsage({
    activity,
    model: chosenModel,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    latency_ms: Date.now() - startedAt,
  });
  try {
    return JSON.parse(content) as T;
  } catch (e) {
    throw new Error(`LLM returned invalid JSON: ${(e as Error).message}`);
  }
}

/**
 * Plain-text chat completion. Takes a full conversation history (system +
 * alternating user/assistant turns) and returns the assistant's next reply
 * as a string. Used for the Chat tab — multi-turn dialogue where we want
 * natural-language responses, not structured JSON.
 *
 * Vision support: pass `imageBase64` to attach an image to the LAST user
 * turn (so the model sees the image alongside the user's text). Per-message
 * images aren't supported in this API yet — keep it simple.
 *
 * Errors throw — caller should catch and show a graceful retry CTA.
 */
export type CompleteTextArgs = {
  system: string;
  /** Alternating user/assistant turns in chronological order. */
  messages: ChatMessage[];
  /** Feature tag for token/cost tracking. See LLMActivity. */
  activity: LLMActivity;
  /** Optional base64 image attached to the LAST user turn (vision). */
  imageBase64?: string | null;
  imageMime?: string;
  imageDetail?: 'low' | 'high';
  temperature?: number;
  maxTokens?: number;
};

export async function completeText({
  system,
  messages,
  activity,
  imageBase64 = null,
  imageMime = 'image/jpeg',
  imageDetail = 'low',
  temperature = 0.7,
  maxTokens = 800,
}: CompleteTextArgs): Promise<string> {
  if (!enabled) throw new AiDisabledError('AI disabled via EXPO_PUBLIC_ENABLE_AI=false');
  const startedAt = Date.now();

  // If an image is attached, splice it into the last user turn so the
  // model sees it alongside that turn's text. We don't decorate every
  // user turn — vision-per-turn isn't a real chat use case yet.
  let outgoing: Array<{ role: 'system' | 'user' | 'assistant'; content: unknown }> = [
    { role: 'system', content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content as unknown })),
  ];
  if (imageBase64 && outgoing.length > 1) {
    // Find the last user turn, replace its content with a multimodal array
    for (let i = outgoing.length - 1; i >= 0; i--) {
      if (outgoing[i].role === 'user') {
        const text = outgoing[i].content as string;
        outgoing[i] = {
          role: 'user',
          content: [
            { type: 'text', text },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageMime};base64,${imageBase64}`,
                detail: imageDetail,
              },
            },
          ],
        };
        break;
      }
    }
  }

  const resp = await fetch(pickEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
    },
    body: JSON.stringify({
      model,
      messages: outgoing,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`LLM HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  const payload = await resp.json();
  const content = payload?.choices?.[0]?.message?.content ?? '';
  const usage = (payload?.usage ?? {}) as {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  trackLLMUsage({
    activity,
    model,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    latency_ms: Date.now() - startedAt,
  });
  if (typeof content !== 'string') return '';
  return content.trim();
}

/**
 * Image generation — used by Cat Studio for movie-poster remixes etc.
 *
 * Two paths:
 *   1. Pure prompt → image (no input cat photo). Used when we want
 *      generic art with no cat likeness preserved.
 *   2. Image-conditioned generation (input cat photo + prompt). Uses
 *      OpenAI's image-edit endpoint (gpt-image-1 or DALL-E 3) so the
 *      generated poster preserves the user's actual cat. Pass
 *      `referenceImageBase64` for this path.
 *
 * Output: base64-encoded PNG/JPEG (we request b64 directly; saves the
 * round-trip of fetching a temp URL the API would otherwise return).
 *
 * Cost: ~$0.04-0.17 per generation depending on quality + size. Vertical
 * portrait (1024×1536) is the right shape for share-card-style posters.
 *
 * Errors throw — caller should catch and show a graceful retry.
 */
export type GenerateImageArgs = {
  prompt: string;
  /** Feature tag for token/cost tracking. See LLMActivity. */
  activity: LLMActivity;
  /** Optional cat photo to condition the generation on (poster preserves likeness). */
  referenceImageBase64?: string | null;
  referenceImageMime?: string;       // default 'image/jpeg'
  /** Output dimensions. Vertical 1024x1536 is good for posters; 1024x1024 for square share-cards. */
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  /** 'low' = faster + cheaper; 'high' = slower + better. Default 'medium'. */
  quality?: 'low' | 'medium' | 'high';
};

export async function generateImage({
  prompt,
  activity,
  referenceImageBase64 = null,
  referenceImageMime = 'image/jpeg',
  size = '1024x1536',
  quality = 'medium',
}: GenerateImageArgs): Promise<string> {
  if (!enabled) throw new AiDisabledError('AI disabled via EXPO_PUBLIC_ENABLE_AI=false');
  const startedAt = Date.now();

  // Endpoint: edits when conditioned on a reference image, generations otherwise.
  // The proxy layer (when set) is expected to mirror these paths.
  const endpointPath = referenceImageBase64 ? '/images/edits' : '/images/generations';
  const url = baseUrl
    ? baseUrl.replace(/\/$/, '') + endpointPath
    : `https://api.openai.com/v1${endpointPath}`;

  // Phase 2 token tracking: when going through the proxy, send the
  // PostHog distinct_id + activity in headers so the worker can capture
  // `llm_usage` server-side. Image-gen is the one path where the proxy
  // does the tracking (not the client) — partly because the proxy sees
  // authoritative pricing inputs (size+quality), partly because the
  // single-event-per-call discipline is easier to reason about with one
  // emitter per code path. When there's no proxy (dev mode against
  // OpenAI directly), the client falls back to tracking after success.
  const distinctId = baseUrl ? await getDistinctId().catch(() => null) : null;

  // Edits endpoint expects multipart/form-data with the image file.
  // Generations endpoint expects JSON. Branch on which we're hitting.
  let body: BodyInit;
  let headers: Record<string, string> = {
    ...authHeader(),
    ...(baseUrl
      ? {
          'X-CatMD-Activity': activity,
          'X-CatMD-User-Id': distinctId ?? 'unknown',
        }
      : {}),
  };

  if (referenceImageBase64) {
    const formData = new FormData();
    formData.append('model', 'gpt-image-1');
    formData.append('prompt', prompt);
    formData.append('size', size);
    formData.append('quality', quality);
    formData.append('n', '1');
    // OpenAI's edits endpoint takes the source image as a file part.
    // React Native's FormData accepts the {uri, name, type} shape for
    // local files; for base64 input we need to wrap as a Blob. Use a
    // data URI which both RN + the OpenAI server interpret correctly.
    formData.append(
      'image',
      {
        uri: `data:${referenceImageMime};base64,${referenceImageBase64}`,
        name: 'reference.jpg',
        type: referenceImageMime,
      } as unknown as Blob,
    );
    body = formData as unknown as BodyInit;
    // FormData sets its own Content-Type with a boundary — don't override.
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size,
      quality,
      n: 1,
    });
  }

  const resp = await fetch(url, { method: 'POST', headers, body });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Image-gen HTTP ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const payload = await resp.json();
  // Track image-gen usage. When `baseUrl` is set the proxy is the
  // authoritative emitter for this activity (it sees the canonical
  // request/response and has the PostHog project key as a server-side
  // secret); we skip the client-side track to avoid duplicates. When
  // baseUrl is empty (dev mode against OpenAI directly) the client
  // tracks here so dev sessions still show up in PostHog dashboards.
  if (!baseUrl) {
    trackLLMUsage({
      activity,
      model: 'gpt-image-1',
      image_count: 1,
      latency_ms: Date.now() - startedAt,
    });
  }
  // OpenAI returns either { data: [{ b64_json }] } or { data: [{ url }] }
  const item = payload?.data?.[0];
  if (!item) throw new Error('Image-gen: empty response');
  const b64 = item.b64_json as string | undefined;
  if (b64) return b64;
  // Fallback: fetch the URL and base64-encode locally
  const fallbackUrl = item.url as string | undefined;
  if (!fallbackUrl) throw new Error('Image-gen: no b64 or url returned');
  const imgResp = await fetch(fallbackUrl);
  const buf = await imgResp.arrayBuffer();
  // Convert ArrayBuffer to base64 — RN doesn't ship Buffer; use atob path
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa exists in RN's Hermes runtime
  // eslint-disable-next-line no-undef
  return (typeof btoa !== 'undefined' ? btoa(binary) : '');
}

/**
 * One-shot embedding. Small text, single call. Used for RAG query embedding.
 * Server-side proxy recommended for production. `activity` tags the
 * caller (chat, scan_triage, etc.) so PostHog can attribute embedding
 * spend correctly.
 */
export async function embed(text: string, activity: LLMActivity): Promise<number[]> {
  if (!enabled) throw new AiDisabledError('AI disabled');
  const startedAt = Date.now();
  const url = baseUrl
    ? baseUrl.replace(/\/$/, '') + '/embeddings'
    : 'https://api.openai.com/v1/embeddings';
  const embedModel = 'text-embedding-3-small';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({
      model: embedModel,
      input: text,
      dimensions: 1536,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Embed HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  const payload = await resp.json();
  // Embedding usage object: { prompt_tokens, total_tokens } — no
  // completion side. Track for cost attribution.
  const usage = (payload?.usage ?? {}) as {
    prompt_tokens?: number;
    total_tokens?: number;
  };
  trackLLMUsage({
    activity,
    model: embedModel,
    prompt_tokens: usage.prompt_tokens,
    total_tokens: usage.total_tokens,
    latency_ms: Date.now() - startedAt,
  });
  return payload?.data?.[0]?.embedding ?? [];
}

export { AiDisabledError };
