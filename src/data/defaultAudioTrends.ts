/**
 * Bundled default audio-trends list — used when the Cloudflare Worker
 * fetch fails. Mirrors the shape of `proxy/audioTrends.ts` SEED_PAYLOAD
 * so the screen renders identically against either source.
 *
 * The Worker endpoint is the source of truth (cron-refreshed weekly).
 * This bundled fallback only kicks in when:
 *   - Network unreachable at first launch (no AsyncStorage cache yet)
 *   - Worker returns non-200 / malformed JSON
 *   - User has airplane mode on
 *
 * Refresh policy: this constant gets updated when we ship a new app
 * build (so even users who never connect get a vaguely-current set).
 * The Worker endpoint covers the gap between app releases.
 */

export type AudioTrendPlatform = 'tiktok' | 'instagram';

export type AudioTrend = {
  title: string;
  artist?: string;
  search_query: string;
  platforms: AudioTrendPlatform[];
  moods: string[];
  context: string;
};

export type AudioTrendsPayload = {
  updated_at: string;
  next_refresh_due: string;
  note?: string;
  trends: AudioTrend[];
};

/**
 * Mirrors proxy/audioTrends.ts SEED list verbatim. Keep them in sync at
 * each app build — the Worker is the source of truth thereafter.
 */
export const DEFAULT_AUDIO_TRENDS: AudioTrendsPayload = {
  updated_at: '2026-05-02',
  next_refresh_due: '2026-05-09',
  note: 'Bundled fallback (synced with proxy SEED at build time).',
  trends: [
    {
      title: 'Where the Wild Things Are',
      artist: 'Karol G',
      search_query: 'where the wild things are',
      platforms: ['tiktok', 'instagram'],
      moods: ['regal', 'dramatic', 'smug'],
      context: 'Cat-as-main-character edits',
    },
    {
      title: 'Murder on the Dancefloor',
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
    {
      title: 'Oh No',
      artist: 'Kreepa',
      search_query: 'oh no oh no oh no no no',
      platforms: ['tiktok', 'instagram'],
      moods: ['mischievous', 'cheeky', 'dramatic'],
      context: 'Knocking-things-over edits',
    },
    {
      title: 'Vampire',
      artist: 'Olivia Rodrigo',
      search_query: 'vampire olivia rodrigo',
      platforms: ['tiktok', 'instagram'],
      moods: ['moody', 'dramatic', 'anxious'],
      context: 'Mysterious / grumpy cat era',
    },
    {
      title: "Don't Stop Me Now",
      artist: 'Queen',
      search_query: 'dont stop me now queen',
      platforms: ['tiktok', 'instagram'],
      moods: ['energetic', 'playful', 'triumphant'],
      context: 'Catch-all for fun moments',
    },
  ],
};
