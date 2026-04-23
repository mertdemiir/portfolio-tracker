import { useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { FxRates } from '../types';

const FX_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Fetches FX rates from Frankfurter for the configured base currency and
 * exposes a `convertToBase(amount, fromCurrency)` helper.
 *
 * Rate semantics:
 *   Frankfurter's `/latest?from=X` returns rates where `rates[Y] = Y per 1 X`.
 *   So to convert an amount denominated in `fromCurrency` to `baseCurrency`,
 *   we divide by `rates[fromCurrency]`.
 *
 * Previously this short-circuited when `baseCurrency === 'USD'`, which
 * silently caused all non-USD holdings to be treated as USD. We now always
 * fetch rates relative to `baseCurrency` — including USD — so the formula
 * is uniform regardless of base.
 */
export function useFxRates(baseCurrency: string) {
  const [fxRates, setFxRates] = useLocalStorage<FxRates | null>('fx-rates', null);
  const fxRatesRef = useRef(fxRates);
  fxRatesRef.current = fxRates;

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`);
      if (!res.ok) return;
      const data = await res.json();
      setFxRates({
        base: baseCurrency,
        date: data.date,
        rates: data.rates,
        fetchedAt: Date.now(),
      });
    } catch {
      // Silently keep cached rates. Offline users will see pre-fetched values;
      // if they have no cached rates yet, non-base amounts won't be converted
      // (see convertToBase fallback below).
    }
  }, [baseCurrency, setFxRates]);

  useEffect(() => {
    // Use ref to avoid fxRates in deps (prevents fetch loop)
    const current = fxRatesRef.current;
    const needsFetch =
      !current || current.base !== baseCurrency || isStale(current);
    if (needsFetch) fetchRates();

    const interval = setInterval(fetchRates, FX_CACHE_DURATION);
    return () => clearInterval(interval);
  }, [baseCurrency, fetchRates]);

  /**
   * Convert an amount from `fromCurrency` to the app's base currency.
   *
   * Behavior:
   *   - Same currency → pass through unchanged.
   *   - Rates available → divide amount by rates[fromCurrency].
   *   - Rates missing or stale → return amount unchanged (best-effort fallback
   *     to avoid NaN; callers should not rely on correctness while offline).
   */
  const convertToBase = useCallback(
    (amount: number, fromCurrency: string = 'USD'): number => {
      if (fromCurrency === baseCurrency) return amount;
      if (!fxRates || fxRates.base !== baseCurrency) return amount;
      const fromRate = fxRates.rates[fromCurrency];
      if (!fromRate) return amount;
      return amount / fromRate;
    },
    [baseCurrency, fxRates]
  );

  return { fxRates, convertToBase, fetchRates };
}

function isStale(rates: FxRates): boolean {
  // Use fetchedAt timestamp if available, fall back to API date string.
  // Parse date parts manually to avoid UTC timezone shift.
  const timestamp = rates.fetchedAt || (() => {
    const [y, m, d] = rates.date.split('-').map(Number);
    return (y && m && d) ? new Date(y, m - 1, d).getTime() : 0;
  })();
  return Date.now() - timestamp > FX_CACHE_DURATION;
}
