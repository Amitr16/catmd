/**
 * Cron-fired weekly refresh of the audio-trends list.
 *
 * Flow (every Friday 16:00 UTC, see wrangler.toml [triggers]):
 *   1. Cloudflare invokes the worker's scheduled() export
 *   2. We call OpenAI Responses API with the `web_search` tool, asking
 *      for "what cat-content audio is trending RIGHT NOW on TikTok +
 *      Instagram, with sources"
 *   3. The model returns structured JSON we parse + validate
 *   4. We write the validated payload to the AUDIO_TRENDS_KV namespace
 *      under key 'current'
 *   5. /audio-trends.json reads from KV first, falls back to the bundled
 *      SEED list in audioTrends.ts if KV is empty (covers cold start +
 *      any AI failure mode)
 *
 * Why web_search (not just gpt-4o knowledge): trending audio rotates on
 * a 1-3 week cycle. The model's training data is months stale. Search
 * grounds it in this week's reality.
 *
 * Why JSON Schema constrained output: the parser is unforgiving. We'd
 * rather fail loudly on a malformed response (and keep KV's previous
 * good list) than write a half-broken structure that breaks the app
 * UI.
 *
 * Cost: ~$0.03 per fire (web_search billed at $0.03/call as of 2026-04).
 * 52 fires/year = $1.56. Trivial.
 *
 * Failure mode: if the AI call fails for any reason (rate limit,
 * timeout, malformed JSON, bad refusal), we LOG and DO NOTHING — the
 * existing KV value sticks around for another week. The endpoint
 * keeps serving last-known-good. We never overwrite KV with garbage.
 */

import type { AudioTrendsPayload, AudioTrend } from './audioTrends';

// ----- OpenAI request shape (Responses API) ---------------------------------

const SYSTEM_PROMPT = `You are a curator surfacing trending audio for cat-content social videos.

Your job: identify 12-15 audio tracks (songs / sounds / voice memes) that are CURRENTLY TRENDING — within the past 1-2 weeks — on TikTok and/or Instagram Reels, especially in cat-content niches.

Rules:
- Use the web_search tool to verify trends are CURRENT, not 6-month-old. Prefer evidence from this week.
- Mix mainstream pop hits + niche cat-coded sounds. Both have value.
- Include the platform-search query a human would type (often shorter than the full title).
- Tag each with 1-3 mood words from this controlled vocabulary ONLY:
  regal, smug, dignified, playful, calm, sleepy, mischievous, dramatic,
  cozy, curious, moody, triumphant, cheeky, dreamy, anxious, content,
  melancholy, energetic, sassy
- Keep social-proof "context" lines under 50 chars.
- Avoid: copyrighted material that platforms are stripping. Avoid: dead/declining trends. Avoid: tracks pushing political content.
- Spread mood coverage so every common cat-photo vibe (regal/playful/sleepy/cozy/mischievous/dramatic/dreamy) has at least 2 matches.

Output JSON conforming to the schema. No prose.`;

const RESPONSE_SCHEMA = {
  name: 'audio_trends_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['trends'],
    properties: {
      trends: {
        type: 'array',
        minItems: 8,
        maxItems: 18,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'search_query', 'platforms', 'moods', 'context'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 80 },
            artist: { type: 'string', maxLength: 80 },
            search_query: { type: 'string', minLength: 2, maxLength: 60 },
            platforms: {
              type: 'array',
              minItems: 1,
              maxItems: 2,
              items: { type: 'string', enum: ['tiktok', 'instagram'] },
            },
            moods: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string', maxLength: 20 },
            },
            context: { type: 'string', minLength: 1, maxLength: 60 },
          },
        },
      },
    },
  },
} as const;

// Allowed mood vocabulary — anything outside is dropped during sanitisation.
const ALLOWED_MOODS = new Set([
  'regal', 'smug', 'dignified', 'playful', 'calm', 'sleepy',
  'mischievous', 'dramatic', 'cozy', 'curious', 'moody',
  'triumphant', 'cheeky', 'dreamy', 'anxious', 'content',
  'melancholy', 'energetic', 'sassy',
]);

// ----- Public refresh entry point -------------------------------------------

export type RefreshResult =
  | { ok: true; trendCount: number }
  | { ok: false; reason: string };

/**
 * Run one refresh cycle: call AI → validate → write to KV. Throws never.
 * Returns a structured result so the caller can log it.
 */
export async function refreshAudioTrends(opts: {
  openaiApiKey: string;
  kv: KVNamespace;
}): Promise<RefreshResult> {
  if (!opts.openaiApiKey) return { ok: false, reason: 'missing_api_key' };

  let aiPayload: { trends: Array<Partial<AudioTrend>> };
  try {
    aiPayload = await callOpenAi(opts.openaiApiKey);
  } catch (e) {
    return {
      ok: false,
      reason: `ai_call_failed:${e instanceof Error ? e.message.slice(0, 80) : 'unknown'}`,
    };
  }

  const sanitised = sanitiseTrends(aiPayload.trends ?? []);
  if (sanitised.length < 6) {
    // Suspiciously thin response — refuse to overwrite a good KV value.
    return { ok: false, reason: `too_few_valid_trends:${sanitised.length}` };
  }

  const today = new Date().toISOString().slice(0, 10);
  const next = new Date();
  next.setDate(next.getDate() + 7);
  const nextDue = next.toISOString().slice(0, 10);

  const payload: AudioTrendsPayload = {
    updated_at: today,
    next_refresh_due: nextDue,
    note: `Auto-refreshed by scheduled() cron. ${sanitised.length} trends.`,
    trends: sanitised,
  };

  try {
    await opts.kv.put('current', JSON.stringify(payload), {
      // KV entries don't need TTL — the next cron fire overwrites. But
      // we set metadata so admin tooling can spot the latest write.
      metadata: { updated_at: today, count: sanitised.length },
    });
  } catch (e) {
    return {
      ok: false,
      reason: `kv_write_failed:${e instanceof Error ? e.message.slice(0, 80) : 'unknown'}`,
    };
  }

  return { ok: true, trendCount: sanitised.length };
}

// ----- Read-side helper used by the GET /audio-trends.json endpoint --------

/**
 * Return the current trends payload, preferring KV (set by cron) and
 * falling back to the bundled SEED list. The fallback path runs on:
 *   - First deploy (KV is empty)
 *   - Cron has never succeeded
 *   - KV read failure
 * Either way the endpoint returns a valid payload.
 */
export async function readCurrentTrends(opts: {
  kv: KVNamespace;
  fallback: AudioTrendsPayload;
}): Promise<AudioTrendsPayload> {
  try {
    const raw = await opts.kv.get('current');
    if (!raw) return opts.fallback;
    const parsed = JSON.parse(raw) as AudioTrendsPayload;
    // Defensive: if the KV blob is malformed, fall back rather than
    // serving garbage to the app.
    if (!parsed?.trends || !Array.isArray(parsed.trends) || parsed.trends.length === 0) {
      return opts.fallback;
    }
    return parsed;
  } catch {
    return opts.fallback;
  }
}

// ----- Internals ------------------------------------------------------------

async function callOpenAi(apiKey: string): Promise<{ trends: Array<Partial<AudioTrend>> }> {
  // Using the Responses API with web_search tool. Model: gpt-4o which
  // supports web_search and structured output simultaneously.
  // (gpt-4o-mini does NOT support web_search at time of writing.)
  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            'Find this week\'s trending audio for cat-content videos on TikTok + Instagram Reels. Search the web. Return JSON.',
        },
      ],
      tools: [{ type: 'web_search' }],
      // Force JSON-schema-constrained output.
      text: {
        format: {
          type: 'json_schema',
          ...RESPONSE_SCHEMA,
        },
      },
      // Conservative temp — we want consistent structure week to week.
      temperature: 0.4,
      max_output_tokens: 2500,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`openai_${resp.status}_${body.slice(0, 120)}`);
  }

  const data = (await resp.json()) as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  // The Responses API returns `output[]` with the final assistant
  // message in a `message`-typed item. Find the JSON text.
  const message = (data.output ?? []).find((o) => o.type === 'message');
  const text = message?.content?.find((c) => c.type === 'output_text')?.text;
  if (!text) throw new Error('no_message_in_response');

  let parsed: { trends?: Array<Partial<AudioTrend>> };
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`json_parse_failed:${e instanceof Error ? e.message : 'unknown'}`);
  }
  if (!parsed.trends) throw new Error('missing_trends_field');
  return { trends: parsed.trends };
}

/**
 * Validate + clean the AI's output before writing to KV. Drops any
 * entry missing required fields, normalises moods to the allowed
 * vocabulary, dedupes by title.
 */
function sanitiseTrends(input: Array<Partial<AudioTrend>>): AudioTrend[] {
  const seenTitles = new Set<string>();
  const out: AudioTrend[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const search_query =
      typeof raw.search_query === 'string' ? raw.search_query.trim() : '';
    const context = typeof raw.context === 'string' ? raw.context.trim() : '';
    if (!title || !search_query || !context) continue;
    const key = title.toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);

    const platforms = Array.isArray(raw.platforms)
      ? raw.platforms.filter(
          (p): p is 'tiktok' | 'instagram' =>
            p === 'tiktok' || p === 'instagram',
        )
      : [];
    if (platforms.length === 0) continue;

    const moods = Array.isArray(raw.moods)
      ? raw.moods
          .map((m) => (typeof m === 'string' ? m.trim().toLowerCase() : ''))
          .filter((m) => ALLOWED_MOODS.has(m))
          .slice(0, 3)
      : [];
    if (moods.length === 0) continue;

    out.push({
      title,
      ...(typeof raw.artist === 'string' && raw.artist.trim()
        ? { artist: raw.artist.trim() }
        : {}),
      search_query,
      platforms,
      moods,
      context,
    });
  }
  return out;
}
