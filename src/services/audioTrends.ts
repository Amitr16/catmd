/**
 * Audio trends — fetch + cache + mood-match.
 *
 * Source of truth is the Cloudflare Worker at
 * `https://catmd.pet/audio-trends.json`, refreshed every Friday by a
 * cron-fired `scheduled()` handler that calls OpenAI w/ web_search.
 *
 * Local strategy:
 *   1. Try AsyncStorage cache (24h TTL). If fresh, return it.
 *   2. Otherwise fetch the Worker endpoint. On success, write to cache.
 *   3. On any failure (network, parse, non-200), fall back to the
 *      bundled DEFAULT_AUDIO_TRENDS list.
 *
 * The fetch is best-effort and never throws to callers — the postcard
 * share screen always gets SOMETHING to show.
 *
 * Mood matching:
 *   - Postcard captioner produces a `mood_word` (free-text, single word)
 *   - Each trend has 1-3 mood tags from a controlled vocabulary
 *   - selectForMood() returns top N tracks where the mood_word matches
 *     a tag; falls back to "any energetic/playful track" when nothing
 *     matches (cold-start, model produced unusual mood word, etc).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_AUDIO_TRENDS,
  type AudioTrend,
  type AudioTrendsPayload,
} from '../data/defaultAudioTrends';

// Re-export types so the screen has a single import surface.
export type { AudioTrend, AudioTrendsPayload };

const CACHE_KEY = 'catmd-audio-trends-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Resolve the Worker JSON endpoint from the AI base URL.
 *
 * EXPO_PUBLIC_AI_BASE_URL is `https://catmd.pet/v1` — we strip `/v1` to
 * land at the Worker root where `/audio-trends.json` lives. Falls back
 * to the production URL if the env var is unset.
 */
function endpoint(): string {
  const aiBase = process.env.EXPO_PUBLIC_AI_BASE_URL ?? 'https://catmd.pet/v1';
  const root = aiBase.replace(/\/v1\/?$/, '');
  return `${root}/audio-trends.json`;
}

type CacheEntry = {
  fetched_at: number; // ms epoch
  payload: AudioTrendsPayload;
};

async function readCache(): Promise<AudioTrendsPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry?.fetched_at || !entry.payload?.trends) return null;
    if (Date.now() - entry.fetched_at > CACHE_TTL_MS) return null;
    return entry.payload;
  } catch {
    return null;
  }
}

async function writeCache(payload: AudioTrendsPayload): Promise<void> {
  try {
    const entry: CacheEntry = { fetched_at: Date.now(), payload };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Cache write failure is non-fatal — next call just refetches.
  }
}

/**
 * Fetch the latest trends. Returns the bundled fallback if every other
 * path fails. Never throws.
 *
 * Callers should treat this as cheap to call repeatedly — the cache
 * absorbs duplicate calls within a 24h window.
 */
export async function fetchAudioTrends(): Promise<AudioTrendsPayload> {
  // 1. Cache hit?
  const cached = await readCache();
  if (cached) return cached;

  // 2. Network fetch with a short timeout. Postcard share is a
  // foreground action — we don't want to make the user wait 10s
  // staring at a loader. 4s is the budget; if the Worker is slow,
  // fall back to bundled.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(endpoint(), { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`http_${resp.status}`);
    const payload = (await resp.json()) as AudioTrendsPayload;
    if (!payload?.trends || !Array.isArray(payload.trends) || payload.trends.length === 0) {
      throw new Error('malformed_payload');
    }
    void writeCache(payload);
    return payload;
  } catch {
    // 3. Bundled fallback. Also cache it (with the bundled timestamp)
    // so we don't hammer the network on every postcard open.
    void writeCache(DEFAULT_AUDIO_TRENDS);
    return DEFAULT_AUDIO_TRENDS;
  }
}

/**
 * Pick the best `count` trends for a given mood word, prioritising
 * exact matches in the trends' mood tags. Falls back to playful/
 * energetic if the mood word doesn't land — those are universally
 * shareable for cat content.
 *
 * Stable selection: when there are more matches than `count`, we
 * deterministically slice the prefix. This means the user sees the
 * same 3 suggestions each time they look at the same postcard, which
 * matches the "screenshot the suggestion" mental model.
 */
export function selectForMood(opts: {
  payload: AudioTrendsPayload;
  moodWord: string | null;
  count?: number;
}): AudioTrend[] {
  const count = opts.count ?? 3;
  const all = opts.payload.trends;
  if (all.length === 0) return [];

  const mood = (opts.moodWord ?? '').trim().toLowerCase();

  // Exact mood match — these are the headline suggestions.
  const matches: AudioTrend[] = mood
    ? all.filter((t) => t.moods.includes(mood))
    : [];

  if (matches.length >= count) return matches.slice(0, count);

  // Pad with broadly-shareable tracks. Order: tracks tagged
  // "playful" or "energetic" first (always work for cat clips), then
  // anything else not already in the result set.
  const seen = new Set(matches.map((m) => m.title));
  const fillers = all.filter(
    (t) =>
      !seen.has(t.title) &&
      (t.moods.includes('playful') || t.moods.includes('energetic')),
  );
  const rest = all.filter((t) => !seen.has(t.title) && !fillers.includes(t));

  return [...matches, ...fillers, ...rest].slice(0, count);
}
