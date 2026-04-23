import { useEffect, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * One-hour cached currency conversion rate between two ISO-4217 codes.
 *
 * Uses Frankfurter's `/latest?from=X&to=Y` endpoint, which returns
 * `rates[Y] = Y per 1 X`. Cached in localStorage per (from, to) pair so
 * multiple components asking for the same rate share a single request per
 * hour, and the rate survives page reloads.
 *
 * Returns `null` while we have no cached value and the first fetch is in
 * flight; callers should guard against null before applying a conversion.
 * When `from === to`, returns 1 immediately.
 */

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface CachedRate {
  rate: number;
  fetchedAt: number;
}

export function useExchangeRate(from: string, to: string): number | null {
  const cacheKey = `exchange-rate:${from}:${to}`;
  const [cached, setCached] = useLocalStorage<CachedRate | null>(cacheKey, null);

  // Read the latest cached value via a ref so it does not trigger the
  // effect to re-run each time we write it (that would cause an infinite
  // fetch loop).
  const cachedRef = useRef(cached);
  cachedRef.current = cached;

  useEffect(() => {
    if (from === to) return;

    const current = cachedRef.current;
    const isFresh = current && Date.now() - current.fetchedAt < CACHE_DURATION_MS;
    if (isFresh) return;

    let aborted = false;
    (async () => {
      try {
        const res = await fetch(
          `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const rate = data?.rates?.[to];
        if (!aborted && typeof rate === 'number' && Number.isFinite(rate)) {
          setCached({ rate, fetchedAt: Date.now() });
        }
      } catch {
        // keep prior cached rate
      }
    })();
    return () => {
      aborted = true;
    };
  }, [from, to, setCached]);

  if (from === to) return 1;
  return cached?.rate ?? null;
}
