/**
 * useActiveCat — zustand-backed reactive selector for the currently-
 * active cat. Updates when the user switches or edits the active cat.
 */
import { useCatStore } from '../state/catStore';
import type { CatProfile } from '../state/catStore';

export function useActiveCat(): CatProfile | null {
  return useCatStore((s) =>
    s.cats.find((c) => c.id === s.activeCatId) ?? null,
  );
}
