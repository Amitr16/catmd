/**
 * RAG retrieval — wraps the match_knowledge_cards Postgres RPC.
 * See supabase/schema.sql for the function definition.
 *
 * Called from the triage flow: user's free-text symptoms + cat profile
 * summary → embedding → top-k cards → injected into the LLM prompt.
 */
import { supabase, type KnowledgeCardRow } from './supabase';

export type MatchOptions = {
  queryEmbedding: number[];
  matchCount?: number;
  minConfidence?: number;
  categoryFilter?: string | null;
  emergencyOnly?: boolean;
};

export async function matchKnowledgeCards(
  opts: MatchOptions,
): Promise<KnowledgeCardRow[]> {
  const {
    queryEmbedding,
    matchCount = 8,
    minConfidence = 0.5,
    categoryFilter = null,
    emergencyOnly = false,
  } = opts;

  const { data, error } = await supabase.rpc('match_knowledge_cards', {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    min_confidence: minConfidence,
    category_filter: categoryFilter,
    emergency_only: emergencyOnly,
  });

  if (error) {
    console.warn('[CatMD] match_knowledge_cards RPC failed:', error);
    return [];
  }
  return (data ?? []) as KnowledgeCardRow[];
}
