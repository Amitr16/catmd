/**
 * Free tier: 1 cat. Pro tier: unlimited cats.
 * Gate applies when user tries to add cat #2+.
 */
import { useCatStore } from '../state/catStore';
import { useEntitlement } from './useEntitlement';

const FREE_CATS_MAX = 1;

export type CatQuota = {
  isPro: boolean;
  limit: number;
  used: number;
  remaining: number;
  canAddCat: boolean;
};

export function useCatQuota(): CatQuota {
  const count = useCatStore((s) => s.cats.length);
  const { isPro } = useEntitlement();
  if (isPro) {
    return {
      isPro: true,
      limit: Infinity,
      used: count,
      remaining: Infinity,
      canAddCat: true,
    };
  }
  return {
    isPro: false,
    limit: FREE_CATS_MAX,
    used: count,
    remaining: Math.max(0, FREE_CATS_MAX - count),
    canAddCat: count < FREE_CATS_MAX,
  };
}
