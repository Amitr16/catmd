/**
 * Becoming store — persists the per-cat stage snapshot so the
 * milestone-detector knows when a facet has just crossed into a new
 * stage. Also persists a "milestone consumed" flag per facet so the
 * diary doesn't re-acknowledge the same milestone every day.
 *
 * Tiny store: just a snapshot map + a consumed-milestones map.
 * Mutators are pure synchronous setters; the actual derivation lives
 * in services/becoming.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FacetId, Stage } from '../services/becoming';

// Cloud sync — fire-and-forget, lazy-imported to avoid cycles.
function pushBecomingForCat(
  catId: string,
  lastStages: Partial<Record<FacetId, Stage>>,
  consumedMilestones: string[],
): void {
  void import('../services/sync')
    .then((m) =>
      m.syncBecomingStateToCloud({
        catId,
        lastStages,
        consumedMilestones,
      }),
    )
    .catch(() => {});
}

type StageSnapshot = Partial<Record<FacetId, Stage>>;

type State = {
  /** Per-cat snapshot of facet stages on the LAST observation. */
  lastStages: Record<string, StageSnapshot>;
  /**
   * Per-cat record of which (facet, stage) milestones have already
   * been surfaced to the diary. Each entry is a string `${facet}:${stage}`.
   * Prevents the same crossing from firing the diary hook twice.
   */
  consumedMilestones: Record<string, string[]>;

  /** Read the previous snapshot for a cat. Returns null if none. */
  getLastStages: (catId: string) => StageSnapshot | null;

  /** Persist a fresh snapshot for a cat. */
  setLastStages: (catId: string, snapshot: StageSnapshot) => void;

  /** True if a milestone has already been consumed. */
  hasConsumedMilestone: (catId: string, key: string) => boolean;

  /** Mark a milestone consumed so the diary doesn't repeat it. */
  markMilestoneConsumed: (catId: string, key: string) => void;

  /** GDPR / cat removal sweep. */
  clearForCat: (catId: string) => void;
  clearAll: () => void;
};

export const useBecomingStore = create<State>()(
  persist(
    (set, get) => ({
      lastStages: {},
      consumedMilestones: {},

      getLastStages: (catId) => get().lastStages[catId] ?? null,

      setLastStages: (catId, snapshot) => {
        set((s) => ({
          lastStages: { ...s.lastStages, [catId]: snapshot },
        }));
        const consumed = get().consumedMilestones[catId] ?? [];
        pushBecomingForCat(catId, snapshot, consumed);
      },

      hasConsumedMilestone: (catId, key) => {
        const list = get().consumedMilestones[catId] ?? [];
        return list.includes(key);
      },

      markMilestoneConsumed: (catId, key) => {
        let nextConsumed: string[] | null = null;
        set((s) => {
          const existing = s.consumedMilestones[catId] ?? [];
          if (existing.includes(key)) return s;
          nextConsumed = [...existing, key];
          return {
            consumedMilestones: {
              ...s.consumedMilestones,
              [catId]: nextConsumed,
            },
          };
        });
        if (nextConsumed) {
          const stages = get().lastStages[catId] ?? {};
          pushBecomingForCat(catId, stages, nextConsumed);
        }
      },

      clearForCat: (catId) =>
        set((s) => {
          const lastStages = { ...s.lastStages };
          const consumedMilestones = { ...s.consumedMilestones };
          delete lastStages[catId];
          delete consumedMilestones[catId];
          return { lastStages, consumedMilestones };
        }),

      clearAll: () => set({ lastStages: {}, consumedMilestones: {} }),
    }),
    {
      name: 'catmd-becoming',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/** Build the consumed-key for a (facet, stage) pair. */
export function milestoneKey(facet: FacetId, stage: Stage): string {
  return `${facet}:${stage}`;
}
