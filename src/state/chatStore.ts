/**
 * Chat store — per-cat conversation history.
 *
 * Single thread per cat (chronological, persistent). User can clear the
 * thread. We cap history to MAX_TURNS so storage + token cost stay bounded
 * — older turns drop off the front when the cap is exceeded. The user
 * never loses access to history mid-session; old turns just stop being
 * sent to the LLM as context.
 *
 * Storage: AsyncStorage via Zustand persist (same pattern as
 * notifPrefsStore / personalityStore / diaryStore).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generateChatReply, type ChatTurn } from '../services/chat';

/** Cap visible history per cat. Older turns are pruned at write-time. */
const MAX_TURNS = 60;
/** How many of the most-recent turns we send to the LLM as context. */
const HISTORY_WINDOW = 14;

type State = {
  /** Per-cat conversation thread. Key: catId. */
  threads: Record<string, ChatTurn[]>;
  /** Whether a reply is in flight per cat. UI uses this for typing indicators. */
  generating: Record<string, boolean>;

  /**
   * Send a user message + generate the assistant's reply. Throws on AI errors;
   * UI catches and shows a graceful retry.
   */
  sendMessage: (catId: string, userText: string) => Promise<void>;

  /** Wipe conversation for one cat (user-triggered "new conversation"). */
  clearForCat: (catId: string) => void;
  clearAll: () => void;
};

function newId(): string {
  return `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useChatStore = create<State>()(
  persist(
    (set, get) => ({
      threads: {},
      generating: {},

      sendMessage: async (catId, userText) => {
        const trimmed = userText.trim();
        if (!trimmed) return;

        // Push user turn synchronously
        const userTurn: ChatTurn = {
          id: newId(),
          role: 'user',
          content: trimmed,
          created_at: new Date().toISOString(),
        };
        set((s) => {
          const existing = s.threads[catId] ?? [];
          const next = [...existing, userTurn];
          // Prune from the front when we exceed the cap. This is the only
          // place we drop history — user-initiated clear wipes everything.
          const pruned = next.length > MAX_TURNS ? next.slice(next.length - MAX_TURNS) : next;
          return {
            threads: { ...s.threads, [catId]: pruned },
            generating: { ...s.generating, [catId]: true },
          };
        });

        try {
          // Send only the most recent HISTORY_WINDOW turns to the LLM.
          // We keep the rest visible to the user but don't pay tokens
          // re-sending every old turn.
          const fullThread = get().threads[catId] ?? [];
          const sent = fullThread.slice(-HISTORY_WINDOW);
          const { reply, citedCards, actions, learnedFacts, fieldUpdates } = await generateChatReply({
            catId,
            history: sent,
          });

          const assistantTurn: ChatTurn = {
            id: newId(),
            role: 'assistant',
            content: reply,
            created_at: new Date().toISOString(),
            cited_cards: citedCards,
            actions,
            ...(learnedFacts.length > 0 ? { learned_facts: learnedFacts } : {}),
            ...(fieldUpdates.length > 0 ? { field_updates: fieldUpdates } : {}),
          };
          set((s) => {
            const existing = s.threads[catId] ?? [];
            const next = [...existing, assistantTurn];
            const pruned = next.length > MAX_TURNS ? next.slice(next.length - MAX_TURNS) : next;
            return {
              threads: { ...s.threads, [catId]: pruned },
            };
          });
          // Cloud backup — sync both user and assistant turns. Per-turn so
          // a partial network failure doesn't lose the rest of the thread.
          void import('../services/sync').then(({ syncChatTurnToCloud }) => {
            syncChatTurnToCloud({ catId, turn: userTurn }).catch(() => {});
            syncChatTurnToCloud({ catId, turn: assistantTurn }).catch(() => {});
          });
        } finally {
          set((s) => {
            const generating = { ...s.generating };
            delete generating[catId];
            return { generating };
          });
        }
      },

      clearForCat: (catId) =>
        set((s) => {
          const threads = { ...s.threads };
          delete threads[catId];
          const generating = { ...s.generating };
          delete generating[catId];
          return { threads, generating };
        }),

      clearAll: () => set({ threads: {}, generating: {} }),
    }),
    {
      name: 'catmd-chat',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Don't persist transient flags
      partialize: (state) => ({ threads: state.threads }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

/**
 * Module-level stable empty array. The Zustand selector below uses this
 * as its fallback so the returned reference is stable across renders
 * when no thread exists. Without this, `?? []` creates a new empty
 * array on every render → Zustand sees "new state" → triggers re-render
 * → new array → infinite "Maximum update depth exceeded" loop.
 */
const EMPTY_THREAD: ChatTurn[] = Object.freeze([]) as unknown as ChatTurn[];

/** Read the conversation thread for a cat (empty array if none yet). */
export function useChatThread(catId: string | null | undefined): ChatTurn[] {
  return useChatStore((s) => (catId ? s.threads[catId] ?? EMPTY_THREAD : EMPTY_THREAD));
}

/** Whether a reply is in flight for this cat. */
export function useChatGenerating(catId: string | null | undefined): boolean {
  return useChatStore((s) => (catId ? !!s.generating[catId] : false));
}
