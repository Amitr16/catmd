/**
 * Reactive paywall entitlement hook. Rechecks on app-focus + after
 * purchase/restore actions (the caller calls `refresh()` after those).
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getEntitlement } from '../services/purchases';

export function useEntitlement() {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setIsPro(await getEntitlement());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { isPro, loading, refresh };
}
