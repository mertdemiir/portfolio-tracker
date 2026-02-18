import { createContext, useContext, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApiKey } from '../hooks/useApiKey';
import { usePortfolio } from '../hooks/usePortfolio';
import { useStockPrices } from '../hooks/useStockPrices';
import { enrichHoldings, calculateSummary, calculateNetWorthSummary } from '../utils/calculations';
import { DEFAULT_CATEGORIES } from '../types';
import type {
  Holding,
  EnrichedHolding,
  PortfolioSummary,
  PortfolioSnapshot,
  PriceCache,
  NetWorthSummary,
  CustomCategory,
} from '../types';

interface PortfolioContextValue {
  apiKey: string;
  setApiKey: (key: string) => void;
  hasApiKey: boolean;
  holdings: Holding[];
  addHolding: (data: Omit<Holding, 'id'>) => void;
  updateHolding: (id: string, data: Omit<Holding, 'id'>) => void;
  deleteHolding: (id: string) => void;
  // All holdings (net worth)
  allEnrichedHoldings: EnrichedHolding[];
  netWorthSummary: NetWorthSummary;
  // Portfolio-only holdings
  portfolioEnrichedHoldings: EnrichedHolding[];
  portfolioSummary: PortfolioSummary;
  // Backward compat aliases
  enrichedHoldings: EnrichedHolding[];
  summary: PortfolioSummary;
  snapshots: PortfolioSnapshot[];
  priceCache: PriceCache;
  pricesLoading: boolean;
  priceError: string | null;
  refreshPrices: () => void;
  // Categories
  customCategories: CustomCategory[];
  allCategories: { key: string; label: string }[];
  addCustomCategory: (label: string) => void;
  deleteCustomCategory: (key: string) => void;
}

const PortfolioCtx = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const { apiKey, setApiKey, hasApiKey } = useApiKey();
  const {
    holdings,
    snapshots,
    addHolding,
    updateHolding,
    deleteHolding,
    saveSnapshot,
    customCategories,
    addCustomCategory,
    deleteCustomCategory,
  } = usePortfolio();
  const { priceCache, loading: pricesLoading, error: priceError, fetchPrices } =
    useStockPrices(apiKey);

  const refreshPrices = useCallback(() => {
    if (holdings.length > 0) {
      fetchPrices(holdings);
    }
  }, [holdings, fetchPrices]);

  // Fetch prices when holdings change
  const prevHoldingsKeyRef = useRef<string>('');
  useEffect(() => {
    const key = holdings.map((h) => `${h.assetType}:${h.ticker}`).join(',');
    if (key !== prevHoldingsKeyRef.current && holdings.length > 0) {
      prevHoldingsKeyRef.current = key;
      fetchPrices(holdings);
    }
  }, [holdings, fetchPrices]);

  // Auto-refresh every 5 minutes (pause when tab hidden)
  useEffect(() => {
    if (holdings.length === 0) return;

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchPrices(holdings);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [holdings, fetchPrices]);

  // All enriched holdings (net worth allocation)
  const allEnrichedHoldings = useMemo(
    () => enrichHoldings(holdings, priceCache),
    [holdings, priceCache]
  );

  // Portfolio-only enriched holdings (portfolio allocation)
  const portfolioEnrichedHoldings = useMemo(
    () => enrichHoldings(holdings.filter((h) => h.inPortfolio), priceCache),
    [holdings, priceCache]
  );

  const portfolioSummary = useMemo(
    () => calculateSummary(portfolioEnrichedHoldings),
    [portfolioEnrichedHoldings]
  );

  const netWorthSummary = useMemo(
    () => calculateNetWorthSummary(allEnrichedHoldings, customCategories),
    [allEnrichedHoldings, customCategories]
  );

  const allCategories = useMemo(
    () => [...DEFAULT_CATEGORIES, ...customCategories],
    [customCategories]
  );

  // Save daily snapshot with both NW and portfolio values
  useEffect(() => {
    if (allEnrichedHoldings.length > 0 && netWorthSummary.totalNetWorth > 0) {
      saveSnapshot(netWorthSummary.totalNetWorth, netWorthSummary.totalPortfolioValue);
    }
  }, [allEnrichedHoldings.length, netWorthSummary.totalNetWorth, netWorthSummary.totalPortfolioValue, saveSnapshot]);

  const value: PortfolioContextValue = {
    apiKey,
    setApiKey,
    hasApiKey,
    holdings,
    addHolding,
    updateHolding,
    deleteHolding,
    allEnrichedHoldings,
    netWorthSummary,
    portfolioEnrichedHoldings,
    portfolioSummary,
    // Backward compat
    enrichedHoldings: allEnrichedHoldings,
    summary: portfolioSummary,
    snapshots,
    priceCache,
    pricesLoading,
    priceError,
    refreshPrices,
    customCategories,
    allCategories,
    addCustomCategory,
    deleteCustomCategory,
  };

  return <PortfolioCtx.Provider value={value}>{children}</PortfolioCtx.Provider>;
}

export function usePortfolioContext() {
  const ctx = useContext(PortfolioCtx);
  if (!ctx) throw new Error('usePortfolioContext must be inside PortfolioProvider');
  return ctx;
}
