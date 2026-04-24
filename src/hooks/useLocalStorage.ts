import { useState, useCallback, useEffect } from 'react';
import { isManagedStoreKey } from '../data/store/types';
import { readCached, writeCached } from '../data/store/hydration';

/**
 * Persistent React state with the same API as React.useState, but the
 * value survives reloads.
 *
 * Where the value actually lives depends on the key:
 *
 *   - For keys in the managed store list (holdings, transactions,
 *     snapshots, price cache, benchmarks, watchlist, etc. — see
 *     src/data/store/types.ts), reads and writes go through the store
 *     hydration layer. That layer keeps an in-memory cache populated
 *     from the active adapter (localStorage today; IndexedDB once the
 *     feature flag ships). Reads stay synchronous because the cache is
 *     pre-populated at boot by hydrateStore() in main.tsx.
 *
 *   - For everything else (theme, accentColor, baseCurrency, apiKey,
 *     welcome-dismissed, etc.), reads and writes go straight to
 *     window.localStorage. These keys are small, sync-read-friendly
 *     settings with no reason to go through the async adapter pipe.
 *
 * The hook name is historical — it really means "persistent useState".
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const isManaged = isManagedStoreKey(key);

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (isManaged) {
      return readCached<T>(key, initialValue);
    }
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Re-read from the source of truth if the key changes.
  useEffect(() => {
    if (isManaged) {
      setStoredValue(readCached<T>(key, initialValue));
      return;
    }
    try {
      const item = localStorage.getItem(key);
      if (item !== null) setStoredValue(JSON.parse(item) as T);
    } catch { /* ignore */ }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-tab synchronization: only applies to localStorage-backed keys
  // (the browser doesn't emit StorageEvent for IndexedDB). BroadcastChannel
  // sync for managed keys is a future enhancement.
  useEffect(() => {
    if (isManaged) return;
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch { /* ignore malformed data */ }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, isManaged]); // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        if (isManaged) {
          writeCached(key, nextValue);
        } else {
          try {
            localStorage.setItem(key, JSON.stringify(nextValue));
          } catch {
            // localStorage full or unavailable
          }
        }
        return nextValue;
      });
    },
    [key, isManaged]
  );

  return [storedValue, setValue] as const;
}
