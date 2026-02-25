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

  const fetchPrices = useCallback(
    async (holdings: Holding[]) => {
      if (holdings.length === 0) return;

      const stale = holdings.filter((h) => {
        const key = cacheKey(h);
        const cached = priceCache[key];
        return !cached || !isFresh(cached.lastUpdated);
      });

      if (stale.length === 0) return;

      setLoading(true);
      setError(null);
      abortRef.current = false;

      // Separate holdings that need network requests from instant ones
      const isLiveMetal = (h: Holding) => h.assetType === 'metal' && (LIVE_METAL_TICKERS as readonly string[]).includes(h.ticker);
      const needsApi = stale.filter((h) => h.assetType === 'stock' || h.assetType === 'etf' || h.assetType === 'crypto' || isLiveMetal(h));
      const instant = stale.filter((h) => (h.assetType === 'cash' || h.assetType === 'custom') || (h.assetType === 'metal' && !isLiveMetal(h)));

      try {
        // Process instant types immediately
        for (const holding of instant) {
          const key = cacheKey(holding);
          const quote = await fetchPriceForHolding(holding, apiKey);
          setPriceCache((prev) => ({ ...prev, [key]: quote }));
        }

        // Process API types with delays
        for (const holding of needsApi) {
          if (abortRef.current) break;

          // Skip stock/etf if no API key
          if ((holding.assetType === 'stock' || holding.assetType === 'etf') && !apiKey) continue;

          try {
            const key = cacheKey(holding);
            const quote = await fetchPriceForHolding(holding, apiKey);
            setPriceCache((prev) => ({ ...prev, [key]: quote }));
          } catch (err) {
            if (err instanceof Error && err.message.includes('Rate limit')) {
              setError(err.message);
              break;
            }
            // Skip individual ticker errors
          }
          if (needsApi.indexOf(holding) < needsApi.length - 1) {
            await delay(REQUEST_DELAY);
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [apiKey, priceCache, setPriceCache]
  );

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  return { priceCache, loading, error, fetchPrices };
}
