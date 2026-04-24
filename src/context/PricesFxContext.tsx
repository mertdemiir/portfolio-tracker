/**
 * PricesFxContext — all live-price and FX-rate plumbing.
 *
 * Scope:
 *   - Price cache (per ticker) + loading state + last fetch error
 *   - refreshPrices (caller-triggered force refresh)
 *   - FX rates + convertToBase (for multi-currency holdings)
 *   - Benchmark data (S&P 500, BTC, Gold) — reads, imports, clears
 *
 * Depends on: SettingsContext (for baseCurrency, apiKey)
 *
 * This context is the one that changes most often — every price tick
 * rerenders everything subscribed to it. Keeping it separate from
 * SettingsContext means theme/currency-only consumers don't re-render
 * on price updates.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useSettings } from './SettingsContext';
import { useStockPrices } from '../hooks/useStockPrices';
import { useFxRates } from '../hooks/useFxRates';
import { useBenchmarks } from '../hooks/useBenchmarks';
import type {
  PriceCache,
  Holding,
  FxRates,
  BenchmarkDataPoint,
  BenchmarkEnabled,
  BenchmarkId,
} from '../types';

interface PricesFxContextValue {
  // Prices
  priceCache: PriceCache;
  pricesLoading: boolean;
  priceError: string | null;
  /** Force-refresh every price, bypassing cache TTL. */
  refreshPrices: () => void;
  /** Drive a price fetch from a holdings snapshot (internal; exposed for tests). */
  fetchPrices: (holdings: Holding[], force?: boolean) => void;

  // FX
  fxRates: FxRates | null;
  convertToBase: (amount: number, fromCurrency?: string) => number;

  // Benchmarks
  benchmarkData: { spx: BenchmarkDataPoint[]; btc: BenchmarkDataPoint[]; gold: BenchmarkDataPoint[] };
  benchmarkEnabled: BenchmarkEnabled;
  toggleBenchmark: (key: BenchmarkId) => void;
  importBenchmarkCsv: (key: BenchmarkId, csvText: string) => { success: boolean; count: number; error?: string };
  clearBenchmark: (key: BenchmarkId) => void;
  getBenchmarkDateRange: (key: BenchmarkId) => { from: string; to: string; count: number } | null;
}

const PricesFxCtx = createContext<PricesFxContextValue | null>(null);

export function PricesFxProvider({ children }: { children: ReactNode }) {
  const { apiKey, baseCurrency } = useSettings();
  const { priceCache, loading: pricesLoading, error: priceError, fetchPrices } = useStockPrices(apiKey);
  const { fxRates, convertToBase } = useFxRates(baseCurrency);
  const {
    benchmarkData,
    benchmarkEnabled,
    toggleBenchmark,
    importBenchmarkCsv,
    clearBenchmark,
    getBenchmarkDateRange,
  } = useBenchmarks();

  // We don't own the Holdings list — PortfolioProvider does. But we
  // need to drive price fetches when holdings change AND at the 5-min
  // interval. We expose `fetchPrices` for PortfolioProvider to call.
  // This keeps the data flow explicit rather than having PricesFx reach
  // into PortfolioContext (which would create a circular dependency).

  const refreshPrices = useCallback(() => {
    // Consumers that call refreshPrices are implicitly asking for a
    // refetch of every holding. PortfolioProvider wires this up below
    // by calling fetchPrices with its current holdings list.
    // We expose the callback here as a no-op placeholder; PortfolioProvider
    // overwrites it via a ref-based override. See PortfolioContext.tsx.
    refreshRef.current?.();
  }, []);

  const refreshRef = useRef<(() => void) | null>(null);

  // Allow PortfolioProvider (which has access to holdings) to register the
  // actual "refresh every price" implementation. This is a one-way
  // dependency: PortfolioProvider reads from PricesFx, not the other way.
  const registerRefresh = useCallback((impl: () => void) => {
    refreshRef.current = impl;
  }, []);

  const value: PricesFxContextValue = useMemo(
    () => ({
      priceCache,
      pricesLoading,
      priceError,
      refreshPrices,
      fetchPrices,
      fxRates,
      convertToBase,
      benchmarkData,
      benchmarkEnabled,
      toggleBenchmark,
      importBenchmarkCsv,
      clearBenchmark,
      getBenchmarkDateRange,
    }),
    [
      priceCache, pricesLoading, priceError, refreshPrices, fetchPrices,
      fxRates, convertToBase,
      benchmarkData, benchmarkEnabled,
      toggleBenchmark, importBenchmarkCsv, clearBenchmark, getBenchmarkDateRange,
    ],
  );

  // Expose the register hook via a ref on the context itself. Simpler than
  // a parallel hook — consumers don't need it.
  useEffect(() => {
    (value as PricesFxContextValue & { __registerRefresh?: (fn: () => void) => void }).__registerRefresh = registerRefresh;
  }, [value, registerRefresh]);

  return <PricesFxCtx.Provider value={value}>{children}</PricesFxCtx.Provider>;
}

export function usePricesFx(): PricesFxContextValue {
  const ctx = useContext(PricesFxCtx);
  if (!ctx) throw new Error('usePricesFx must be inside PricesFxProvider');
  return ctx;
}

/**
 * Internal hook used by PortfolioProvider to register its "refresh every
 * price" implementation. Not part of the public surface.
 */
export function usePricesFxInternals(): {
  registerRefresh: (fn: () => void) => void;
} {
  const ctx = useContext(PricesFxCtx);
  if (!ctx) throw new Error('usePricesFxInternals must be inside PricesFxProvider');
  const register = (ctx as PricesFxContextValue & { __registerRefresh?: (fn: () => void) => void }).__registerRefresh;
  return {
    registerRefresh: register ?? (() => {}),
  };
}
