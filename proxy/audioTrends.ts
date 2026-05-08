/**
 * Audio trends — curated list of currently-trending audio for cat content
 * across TikTok + Instagram Reels.
 *
 * The app fetches this list at postcard share time and surfaces 2-3
 * tracks matched against the postcard's `mood_word`. Users get a
 * "search this in IG/TikTok audio picker" prompt + copy-to-clipboard.
 *
 * Why a Worker endpoint (not bundled in the app):
 *   - Trending audio rotates on a 2-6 week cycle. A bundled list goes
 *     stale fast and can only refresh on app release.
 *   - Serving from the existing proxy.catmd.pet Worker means we can push
 *     a new list weekly with `wrangler deploy` — 30 seconds, no app
 *     update, no app-store review.
 *   - The app falls back to its own bundled list if the fetch fails;
 *     this endpoint is a soft enhancement, not a hard dependency.
 *
 * Update procedure (do this Friday morning, before weekend posting peak):
 *   1. Check TikTok Creative Center → Inspiration → Music → Pets/Animals
 *      filter — note the top ~10 sounds with highest weekly view counts.
 *   2. Cross-check Instagram Reels native audio picker — anything with
 *      the up-arrow trending icon for cat-adjacent niches.
 *   3. Edit the SEED list below. Keep ~12-15 entries; cap moods per track
 *      at 3 so the matcher returns a tight set of suggestions.
 *   4. `cd proxy && npx wrangler deploy` — done.
 *
 * The first month of test phase, update by hand. Once we see whether
 * users engage (analytics: postcard_audio_suggestion_copied), automate
 * via a Cloudflare Cron Trigger that runs an OpenAI web_search query
 * weekly and writes to KV. Cost: ~$0.02/month. See checkpoint §10 for
 * the deferred plan.
 *
 * IMPORTANT: never lower-case the search_query string. TikTok + IG
 * search is case-insensitive but power users expect track titles
 * spelled correctly.
 */

export type AudioTrend = {
  /** Display title — what the user sees in the suggestion card. */
  title: string;
  /** Artist for context; not surfaced in the primary suggestion line. */
  artist?: string;
  /**
   * What the user types/pastes into IG or TikTok's audio picker.
   * Often shorter than the full title to match the platform's search UX
   * (e.g. "where the wild things" matches better than the full name).
   */
  search_query: string;
  /** Platforms where this is currently trending. */
  platforms: Array<'tiktok' | 'instagram'>;
  /**
   * Mood tags. Match against postcard's `mood_word`. Lowercase, no
   * punctuation. Keep to 1-3 per track so matches stay tight.
   * Vocabulary: regal, smug, dignified, playful, calm, sleepy,
   * mischievous, dramatic, cozy, curious, moody, triumphant, cheeky,
   * dreamy, anxious, content, melancholy, energetic, sassy.
   */
  moods: string[];
  /**
   * Social-proof line shown in the suggestion card. Keeps the suggestion
   * feeling alive vs generic. Phrase as "used in Xk cat videos this
   * week" when you have data; otherwise editorial framing is fine.
   * Cap at ~50 chars so it fits in tile UI.
   */
  context: string;
};

export type AudioTrendsPayload = {
  /** ISO date — when this list was last reviewed/updated. */
  updated_at: string;
  /** ISO date — when the next review is due. Surface in admin tooling. */
  next_refresh_due: string;
  /** Editor's note — optional, surfaced in dev/admin tools. */
  note?: string;
  /** The trend list. */
  trends: AudioTrend[];
};

// =============================================================================
// SEED LIST — replace weekly with actually-current trends.
// =============================================================================
//
// As of 2026-05-02. These are best-guess current trends drawn from cat
// content I've observed; the FIRST refresh after deploy should validate
// against TikTok Creative Center + IG Reels picker. After that, refresh
// every Friday.
//
// Mood spread: aim for at least 2-3 tracks per common mood_word value
// produced by the postcard captioner. The current spread covers regal,
// smug, playful, calm, sleepy, mischievous, dramatic, cozy, dreamy.
// Add more entries when the postcard mood_word corpus reveals gaps.

const SEED: AudioTrend[] = [
  // ── Regal / dramatic / dignified ──────────────────────────────────────
  {
    title: 'Where the Wild Things Are',
    artist: 'Karol G',
    search_query: 'where the wild things are',
    platforms: ['tiktok', 'instagram'],
    moods: ['regal', 'dramatic', 'smug'],
    context: 'Cat-as-main-character edits',
  },
  {
    title: "Murder on the Dancefloor",
    artist: 'Sophie Ellis-Bextor',
    search_query: 'murder on the dancefloor saltburn',
    platforms: ['tiktok', 'instagram'],
    moods: ['regal', 'smug', 'dramatic'],
    context: 'Strut-energy edits',
  },
  {
    title: 'Birds of a Feather',
    artist: 'Billie Eilish',
    search_query: 'birds of a feather',
    platforms: ['tiktok', 'instagram'],
    moods: ['dreamy', 'calm', 'cozy'],
    context: 'Bonding moments',
  },

  // ── Playful / mischievous / cheeky ────────────────────────────────────
  {
    title: 'Espresso',
    artist: 'Sabrina Carpenter',
    search_query: 'espresso sabrina',
    platforms: ['tiktok', 'instagram'],
    moods: ['playful', 'sassy', 'energetic'],
    context: 'Zoomies + cat energy',
  },
  {
    title: 'Paint The Town Red',
    artist: 'Doja Cat',
    search_query: 'paint the town red',
    platforms: ['tiktok', 'instagram'],
    moods: ['mischievous', 'cheeky', 'sassy'],
    context: 'Trouble-maker cat edits',
  },
  {
    title: 'Cooking by the Book',
    artist: 'LazyTown / 1nonly remix',
    search_query: 'cooking by the book lil jon',
    platforms: ['tiktok'],
    moods: ['playful', 'cheeky', 'mischievous'],
    context: 'Kitten chaos clips',
  },

  // ── Sleepy / calm / cozy ──────────────────────────────────────────────
  {
    title: 'Until I Found You',
    artist: 'Stephen Sanchez',
    search_query: 'until i found you',
    platforms: ['tiktok', 'instagram'],
    moods: ['cozy', 'dreamy', 'calm', 'content'],
    context: 'Slow-mo cuddle clips',
  },
  {
    title: 'Cozy Lo-fi Cat',
    artist: 'lofi instrumental',
    search_query: 'lofi cat sleep',
    platforms: ['tiktok', 'instagram'],
    moods: ['sleepy', 'calm', 'cozy', 'dreamy'],
    context: 'Sleeping / sunbeam content',
  },

  // ── Triumphant / hero / epic ──────────────────────────────────────────
  {
    title: 'Greatest',
    artist: 'Sia',
    search_query: 'sia greatest',
    platforms: ['tiktok', 'instagram'],
    moods: ['triumphant', 'energetic', 'playful'],
    context: 'Cat doing impossible feats',
  },
  {
    title: 'Anti-Hero',
    artist: 'Taylor Swift',
    search_query: 'anti hero taylor swift',
    platforms: ['tiktok', 'instagram'],
    moods: ['moody', 'smug', 'cheeky'],
    context: '"It\'s me, hi" cat POV edits',
  },

  // ── Curious / exploring / inquisitive ─────────────────────────────────
  {
    title: 'Chihiro',
    artist: 'Billie Eilish',
    search_query: 'chihiro billie eilish',
    platforms: ['tiktok', 'instagram'],
    moods: ['curious', 'dreamy', 'moody'],
    context: 'Cat exploring new spaces',
  },
  {
    title: 'Pink + White',
    artist: 'Frank Ocean',
    search_query: 'pink and white frank ocean',
    platforms: ['tiktok', 'instagram'],
    moods: ['dreamy', 'cozy', 'content'],
    context: 'Golden hour cat clips',
  },

  // ── Mishap / "oh no" / fails ──────────────────────────────────────────
  {
    title: 'Oh No',
    artist: 'Kreepa',
    search_query: 'oh no oh no oh no no no',
    platforms: ['tiktok', 'instagram'],
    moods: ['mischievous', 'cheeky', 'dramatic'],
    context: 'Knocking-things-over edits',
  },

  // ── Anxious / moody / pensive ─────────────────────────────────────────
  {
    title: 'Vampire',
    artist: 'Olivia Rodrigo',
    search_query: 'vampire olivia rodrigo',
    platforms: ['tiktok', 'instagram'],
    moods: ['moody', 'dramatic', 'anxious'],
    context: 'Mysterious / grumpy cat era',
  },

  // ── Universal / always-works default ──────────────────────────────────
  {
    title: "Don't Stop Me Now",
    artist: 'Queen',
    search_query: 'dont stop me now queen',
    platforms: ['tiktok', 'instagram'],
    moods: ['energetic', 'playful', 'triumphant'],
    context: 'Catch-all for fun moments',
  },
];

/**
 * Bundled fallback. Used when:
 *   1. Cron has never fired yet (first deploy)
 *   2. KV read fails for any reason
 *   3. Cron writes get rejected (sanitiser found <6 valid entries)
 *
 * Exported so audioTrendsRefresh.ts can reference it as the fallback
 * argument to readCurrentTrends().
 */
export const SEED_PAYLOAD: AudioTrendsPayload = {
  updated_at: '2026-05-02',
  next_refresh_due: '2026-05-09',
  note: 'Seed list — refresh weekly via TikTok Creative Center + IG Reels picker.',
  trends: SEED,
};

/**
 * Build the response for GET /audio-trends.json. Cached at the edge for
 * 6 hours (long enough to avoid hammering the worker on app cold-start
 * sprees, short enough that a fresh cron-fired refresh goes live within
 * the SWR window).
 */
export function renderAudioTrendsJson(payload: AudioTrendsPayload): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // 1h browser cache + 6h CDN cache + 24h SWR. SWR window means a
      // cron push goes live to all edges within minutes after Friday
      // 16:00 UTC even though Cloudflare keeps serving the previous
      // payload while it revalidates in the background.
      'Cache-Control': 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
