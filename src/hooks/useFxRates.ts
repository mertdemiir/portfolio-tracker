import { useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { FxRates } from '../types';

const FX_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

export function useFxRates(baseCurrency: string) {
  const [fxRates, setFxRates] = useLocalStorage<FxRates | null>('fx-rates', null);

  const fetchRates = useCallback(async () => {
    if (baseCurrency === 'USD') {
      // No need to fetch if base is USD — prices are already in USD
      return;
    }
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`);
      if (!res.ok) return;
      const data = await res.json();
      setFxRates({
        base: baseCurrency,
        date: data.date,
        rates: data.rates,
      });
    } catch {
      // silently fail, keep cached rates
    }
  }, [baseCurrency, setFxRates]);

  useEffect(() => {
    // Fetch if no cache, wrong base, or stale
    const needsFetch =
      baseCurrency !== 'USD' &&
      (!fxRates || fxRates.base !== baseCurrency || isStale(fxRates.date));
    if (needsFetch) fetchRates();

    // Auto-refresh every 6 hours
    if (baseCurrency === 'USD') return;
    const interval = setInterval(fetchRates, FX_CACHE_DURATION);
    return () => clearInterval(interval);
  }, [baseCurrency, fxRates, fetchRates]);

  /**
   * Convert an amount from a source currency to the base currency.
   * All prices come from APIs in USD, so:
   * - If baseCurrency is USD, no conversion needed
   * - Otherwise, convert: amount_in_base = amount_in_USD * (rate_USD / 1)
   *
   * Frankfurter rates are: 1 baseCurrency = X foreignCurrency
   * So to convert from USD to baseCurrency: amount / rates['USD']
   */
  const convertToBase = useCallback(
    (amount: number, fromCurrency: string = 'USD'): number => {
      if (fromCurrency === baseCurrency) return amount;
      if (baseCurrency === 'USD' && fromCurrency === 'USD') return amount;
      if (!fxRates || fxRates.base !== baseCurrency) return amount;

      const fromRate = fxRates.rates[fromCurrency];
      if (!fromRate) return amount;

      // rates are: 1 baseCurrency = fromRate fromCurrency
      // So: amount_from / fromRate = amount_base
      return amount / fromRate;
    },
    [baseCurrency, fxRates]
  );

  return { fxRates, convertToBase, fetchRates };
}

function isStale(dateStr: string): boolean {
  const rateDate = new Date(dateStr).getTime();
  return Date.now() - rateDate > FX_CACHE_DURATION;
}
