/**
 * Supabase client — single instance, used for:
 *   - auth (anonymous sessions for scan history)
 *   - knowledge_cards RAG retrieval via match_knowledge_cards RPC
 *   - cat/event persistence
 *
 * Uses the publishable (anon) key. RLS enforces per-user access on user tables.
 * knowledge_cards is read-only for all authenticated/anon users.
 *
 * WEB EXPORT NOTE (audit 2026-05-14):
 *   `npx expo export --platform web` fails during static rendering with
 *   "ReferenceError: window is not defined" — @supabase/auth-js +
 *   @react-native-async-storage/async-storage both touch `window` at
 *   module load, which doesn't exist when this file is imported in
 *   Node during SSR / static-export. Since we ship Android-only via
 *   EAS (no web build profile in `eas.json`), this is currently a
 *   non-issue. catmd.pet is served by the standalone Cloudflare Worker
 *   (`proxy/worker.ts`) and does NOT bundle the RN app.
 *
 *   If we ever want to ship `app.catmd.pet` as a React Native Web
 *   build, fix by gating the createClient call behind a Platform.OS
 *   check + returning a no-op stub on web during SSR. ~30 min job.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anonKey) {
  // Better than silent failure at query time.
  console.warn(
    '[CatMD] Supabase URL or anon key missing — check .env and restart Metro.',
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type KnowledgeCardRow = {
  id: string;
  topic: string;
  category: string;
  body: KnowledgeCardBody;
  sources: { url: string; title: string; fetched_at: string; license: string | null }[];
  emergency_tags: string[];
  confidence: number;
  similarity: number;
};

export type KnowledgeCardBody = {
  topic: string;
  aliases: string[];
  symptoms: string[];
  emergency_threshold: string | null;
  time_to_vet: {
    urgent?: string | null;
    concern?: string | null;
    monitor?: string | null;
    routine?: string | null;
  };
  breed_risks: string[];
  age_risks: string | null;
  toxicology: null | {
    substance: string;
    ld50_mg_per_kg: number | null;
    minimum_toxic_dose_mg_per_kg: number | null;
    onset_hours: number | null;
    mechanism: string | null;
  };
  differentials: string[];
  cat_specific_notes: string;
  related_topics: string[];
};

/** Is this card LLM-generated (no external source)? */
export function isLlmFallbackCard(card: Pick<KnowledgeCardRow, 'sources'>): boolean {
  return card.sources.every((s) => s.url.startsWith('internal://'));
}
