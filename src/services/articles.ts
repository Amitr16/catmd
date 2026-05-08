/**
 * Article library — lets the owner browse the 527 Knowledge Cards that
 * power the triage RAG. Two entry points:
 *   - list/search: `listArticles`, `searchArticles`
 *   - detail: `getArticleById`
 *
 * The `knowledge_cards` table is read-only under RLS; anon and
 * authenticated users can both read it. Short column selection keeps
 * the list view lightweight (we don't ship the full body until detail).
 */
import { isLlmFallbackCard, supabase, type KnowledgeCardRow } from './supabase';

/** A trimmed row for list-view rendering. */
export type ArticleSummary = {
  id: string;
  topic: string;
  category: string;
  confidence: number;
  source_count: number;
  is_llm_fallback: boolean;
  emergency_tags: string[];
};

export const ARTICLE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'condition', label: 'Conditions' },
  { key: 'symptom', label: 'Symptoms' },
  { key: 'toxicology', label: 'Toxicology' },
  { key: 'behavior', label: 'Behavior' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'preventive', label: 'Preventive' },
  { key: 'emergency', label: 'Emergency' },
];

/**
 * List articles, optionally filtered by category. Paginated via offset.
 * Sorted alphabetically by topic for predictable browsing.
 */
export async function listArticles(opts: {
  category?: string | null;
  limit?: number;
  offset?: number;
} = {}): Promise<ArticleSummary[]> {
  const { category, limit = 60, offset = 0 } = opts;
  let q = supabase
    .from('knowledge_cards')
    .select('id, topic, category, confidence, sources, emergency_tags')
    .order('topic', { ascending: true })
    .range(offset, offset + limit - 1);
  if (category && category !== 'all') q = q.eq('category', category);

  const { data, error } = await q;
  if (error) {
    console.warn('[CatMD] listArticles:', error.message);
    return [];
  }
  return (data ?? []).map(toSummary);
}

/**
 * Substring-search across topic, category, and emergency tags. For full
 * semantic search we have `match_knowledge_cards` (RAG) — this is the
 * "I know what I'm looking for" path.
 */
export async function searchArticles(
  query: string,
  opts: { limit?: number } = {},
): Promise<ArticleSummary[]> {
  const q = query.trim();
  if (!q) return [];
  const limit = opts.limit ?? 40;
  // The `body` column is JSONB; search topic first, fall back to ilike on topic.
  const { data, error } = await supabase
    .from('knowledge_cards')
    .select('id, topic, category, confidence, sources, emergency_tags')
    .ilike('topic', `%${q}%`)
    .order('topic', { ascending: true })
    .limit(limit);
  if (error) {
    console.warn('[CatMD] searchArticles:', error.message);
    return [];
  }
  return (data ?? []).map(toSummary);
}

export async function getArticleById(id: string): Promise<KnowledgeCardRow | null> {
  const { data, error } = await supabase
    .from('knowledge_cards')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.warn('[CatMD] getArticleById:', error.message);
    return null;
  }
  return (data as KnowledgeCardRow) ?? null;
}

function toSummary(r: {
  id: string;
  topic: string;
  category: string;
  confidence: number;
  sources: { url: string }[] | null;
  emergency_tags: string[] | null;
}): ArticleSummary {
  const sources = r.sources ?? [];
  return {
    id: r.id,
    topic: r.topic,
    category: r.category,
    confidence: r.confidence,
    source_count: sources.length,
    is_llm_fallback: isLlmFallbackCard({ sources: sources as any }),
    emergency_tags: r.emergency_tags ?? [],
  };
}
