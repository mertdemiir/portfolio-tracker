import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { fetchPriceForHolding, delay, LIVE_METAL_TICKERS } from '../utils/api';
import type { PriceCache, Holding } from '../types';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const REQUEST_DELAY = 200; // ms between API requests

function isFresh(lastUpdated: number): boolean {
  return Date.now() - lastUpdated < CACHE_DURATION;
}

function cacheKey(holding: Holding): string {
  return `${holding.assetType}:${holding.ticker}`;
}

export function useStockPrices(apiKey: string) {
  const [priceCache, setPriceCache] = useLocalStorage<PriceCache>('price-cache', {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const seqRef = useRef(0); // sequence counter to handle concurrent fetches
  // Use ref to read priceCache without it being a dependency
  const priceCacheRef = useRef(priceCache);
  priceCacheRef.current = priceCache;

  const fetchPrices = useCallback(
    async (holdings: Holding[], force = false) => {
      if (holdings.length === 0) return;

      const currentCache = priceCacheRef.current;
      const stale = force
        ? holdings
        : holdings.filter((h) => {
            const key = cacheKey(h);
            const cached = currentCache[key];
            return !cached || !isFresh(cached.lastUpdated);
          });

      if (stale.length === 0) return;

      const thisSeq = ++seqRef.current;
      setLoading(true);
      setError(null);
      abortRef.current = false;

      const isLiveMetal = (h: Holding) => h.assetType === 'metal' && (LIVE_METAL_TICKERS as readonly string[]).includes(h.ticker);
      const needsApi = stale.filter((h) => h.assetType === 'stock' || h.assetType === 'etf' || h.assetType === 'crypto' || isLiveMetal(h));
      const instant = stale.filter((h) => (h.assetType === 'cash' || h.assetType === 'custom') || (h.assetType === 'metal' && !isLiveMetal(h)));

      const failedTickers: string[] = [];
      try {
        for (const holding of instant) {
          if (abortRef.current) break;
          try {
            const key = cacheKey(holding);
            const quote = await fetchPriceForHolding(holding, apiKey);
            if (!abortRef.current) setPriceCache((prev) => ({ ...prev, [key]: quote }));
          } catch {
            failedTickers.push(holding.ticker);
          }
        }

        for (const holding of needsApi) {
          if (abortRef.current) break;
          if ((holding.assetType === 'stock' || holding.assetType === 'etf') && !apiKey) continue;

          try {
            const key = cacheKey(holding);
            const quote = await fetchPriceForHolding(holding, apiKey);
            if (!abortRef.current) setPriceCache((prev) => ({ ...prev, [key]: quote }));
          } catch (err) {
            if (err instanceof Error && err.message.includes('Rate limit')) {
              if (!abortRef.current) setError(err.message);
              break;
            }
            failedTickers.push(holding.ticker);
          }
          if (needsApi.indexOf(holding) < needsApi.length - 1) {
            await delay(REQUEST_DELAY);
          }
        }
      } finally {
        // Only the latest fetch call controls loading/error state
        if (!abortRef.current && seqRef.current === thisSeq) {
          if (failedTickers.length > 0) {
            setError(`Failed to fetch prices for ${failedTickers.join(', ')}`);
          }
          setLoading(false);
        }
      }
    },
    [apiKey, setPriceCache] // removed priceCache dep — read via ref
  );

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  return { priceCache, loading, error, fetchPrices };
}
