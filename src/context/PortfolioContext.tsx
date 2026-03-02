import { createContext, useContext, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApiKey } from '../hooks/useApiKey';
import { usePortfolio } from '../hooks/usePortfolio';
import { useStockPrices } from '../hooks/useStockPrices';
import { useBenchmarks } from '../hooks/useBenchmarks';
import { useTheme } from '../hooks/useTheme';
import { useFxRates } from '../hooks/useFxRates';
import { usePortfolios } from '../hooks/usePortfolios';
import { useLiabilities } from '../hooks/useLiabilities';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { enrichHoldings, calculateSummary, calculateNetWorthSummary } from '../utils/calculations';
import { setGlobalBaseCurrency } from '../utils/formatters';
import { DEFAULT_CATEGORIES, DEFAULT_PORTFOLIO_ID } from '../types';
import { useTargetAllocations } from '../hooks/useTargetAllocations';
import { useTransactions } from '../hooks/useTransactions';
import type {
  Holding,
  EnrichedHolding,
  PortfolioSummary,
  PortfolioSnapshot,
  PriceCache,
  NetWorthSummary,
  CustomCategory,
  TargetAllocation,
  Transaction,
  Portfolio,
  Liability,
  BenchmarkDataPoint,
  BenchmarkEnabled,
  BenchmarkId,
  ThemeId,
  ThemePreference,
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
  addManualSnapshot: (date: string, netWorthValue: number, portfolioValue?: number, name?: string) => void;
  deleteSnapshot: (date: string) => void;
  priceCache: PriceCache;
  pricesLoading: boolean;
  priceError: string | null;
  refreshPrices: () => void;
  // Categories
  customCategories: CustomCategory[];
  allCategories: { key: string; label: string }[];
  addCustomCategory: (label: string) => void;
  deleteCustomCategory: (key: string) => void;
  // Target allocations
  targetAllocations: TargetAllocation[];
  setTargetAllocation: (categoryKey: string, targetPercent: number) => void;
  removeTargetAllocation: (categoryKey: string) => void;
  // Transactions
  transactions: Transaction[];
  addTransaction: (data: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  realizedPnl: number;
  // Benchmarks
  benchmarkData: { spx: BenchmarkDataPoint[]; btc: BenchmarkDataPoint[]; gold: BenchmarkDataPoint[] };
  benchmarkEnabled: BenchmarkEnabled;
  toggleBenchmark: (key: BenchmarkId) => void;
  importBenchmarkCsv: (key: BenchmarkId, csvText: string) => { success: boolean; count: number; error?: string };
  clearBenchmark: (key: BenchmarkId) => void;
  getBenchmarkDateRange: (key: BenchmarkId) => { from: string; to: string; count: number } | null;
  // Theme
  theme: ThemeId;
  themePreference: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  accentColor: string;
  setAccentColor: (c: string) => void;
  // Currency
  baseCurrency: string;
  setBaseCurrency: (c: string) => void;
  // Portfolios
  portfolios: Portfolio[];
  activePortfolioId: string | 'all';
  setActivePortfolioId: (id: string | 'all') => void;
  createPortfolio: (name: string) => string;
  renamePortfolio: (id: string, name: string) => void;
  deletePortfolio: (id: string) => void;
  // Liabilities
  liabilities: Liability[];
  addLiability: (data: Omit<Liability, 'id'>) => void;
  updateLiability: (id: string, data: Omit<Liability, 'id'>) => void;
  deleteLiability: (id: string) => void;
  // Filtered by active portfolio (for holdings-level views)
  filteredEnrichedHoldings: EnrichedHolding[];
  filteredPortfolioSummary: PortfolioSummary;
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
    addManualSnapshot,
    deleteSnapshot,
    customCategories,
    addCustomCategory,
    deleteCustomCategory,
  } = usePortfolio();
  const { priceCache, loading: pricesLoading, error: priceError, fetchPrices } =
    useStockPrices(apiKey);
  const { targetAllocations, setTargetAllocation, removeTargetAllocation } =
    useTargetAllocations();
  const { transactions, addTransaction, deleteTransaction } = useTransactions();
  const { benchmarkData, benchmarkEnabled, toggleBenchmark, importBenchmarkCsv, clearBenchmark, getBenchmarkDateRange } =
    useBenchmarks();
  const { theme, themePreference, setTheme, accentColor, setAccentColor } = useTheme();
  const [baseCurrency, setBaseCurrency] = useLocalStorage<string>('base-currency', 'USD');
  const { convertToBase } = useFxRates(baseCurrency);
  const {
    portfolios, activePortfolioId, setActivePortfolioId,
    createPortfolio, renamePortfolio, deletePortfolio: deletePortfolioRaw,
  } = usePortfolios();
  const {
    liabilities, addLiability, updateLiability, deleteLiability,
  } = useLiabilities();

  // Keep global formatter in sync with base currency
  useEffect(() => {
    setGlobalBaseCurrency(baseCurrency);
  }, [baseCurrency]);

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
    () => enrichHoldings(holdings, priceCache, convertToBase),
    [holdings, priceCache, convertToBase]
  );

  // Portfolio-only enriched holdings (portfolio allocation — always global)
  const portfolioEnrichedHoldings = useMemo(
    () => enrichHoldings(holdings.filter((h) => h.inPortfolio), priceCache, convertToBase),
    [holdings, priceCache, convertToBase]
  );

  const portfolioSummary = useMemo(
    () => calculateSummary(portfolioEnrichedHoldings),
    [portfolioEnrichedHoldings]
  );

  // Filtered by active portfolio (for holdings table, charts, etc.)
  const filteredEnrichedHoldings = useMemo(() => {
    if (activePortfolioId === 'all') return portfolioEnrichedHoldings;
    // When viewing a specific portfolio bucket, include ALL holdings in it
    // (both portfolio and NW-only) so the user sees everything in that bucket
    const filtered = holdings.filter(
      (h) => (h.portfolioId || DEFAULT_PORTFOLIO_ID) === activePortfolioId
    );
    return enrichHoldings(filtered, priceCache, convertToBase);
  }, [activePortfolioId, holdings, priceCache, convertToBase, portfolioEnrichedHoldings]);

  const filteredPortfolioSummary = useMemo(
    () => calculateSummary(filteredEnrichedHoldings),
    [filteredEnrichedHoldings]
  );

  // Delete portfolio: move orphaned holdings to default
  const deletePortfolio = useCallback(
    (id: string) => {
      if (id === DEFAULT_PORTFOLIO_ID) return;
      // Move orphaned holdings to default portfolio
      holdings.forEach((h) => {
        if ((h.portfolioId || DEFAULT_PORTFOLIO_ID) === id) {
          const { id: _hid, ...data } = h;
          updateHolding(h.id, { ...data, portfolioId: DEFAULT_PORTFOLIO_ID });
        }
      });
      deletePortfolioRaw(id);
    },
    [holdings, updateHolding, deletePortfolioRaw]
  );

  const netWorthSummary = useMemo(
    () => calculateNetWorthSummary(allEnrichedHoldings, customCategories, liabilities, convertToBase),
    [allEnrichedHoldings, customCategories, liabilities, convertToBase]
  );

  const allCategories = useMemo(
    () => [...DEFAULT_CATEGORIES, ...customCategories],
    [customCategories]
  );

  // Realized P&L: sum of (sellPrice - costBasis) * shares for sell transactions
  // filtered by active portfolio using the transaction's own portfolioId metadata,
  // falling back to matching against current holdings for older transactions
  const realizedPnl = useMemo(() => {
    const sellTxns = transactions.filter((t) => t.type === 'sell' && t.costBasisPerShare !== undefined);

    if (activePortfolioId === 'all') {
      return sellTxns.reduce((sum, t) => sum + (t.pricePerShare - t.costBasisPerShare!) * t.shares, 0);
    }

    // For specific portfolio: use transaction's stored portfolioId if available,
    // otherwise fall back to matching against current holdings
    const filteredSells = sellTxns.filter((t) => {
      if (t.portfolioId) {
        return t.portfolioId === activePortfolioId;
      }
      // Fallback for older transactions without portfolioId metadata
      return holdings.some(
        (h) =>
          h.ticker.toUpperCase() === t.ticker.toUpperCase() &&
          (h.portfolioId || DEFAULT_PORTFOLIO_ID) === activePortfolioId
      );
    });

    return filteredSells.reduce((sum, t) => sum + (t.pricePerShare - t.costBasisPerShare!) * t.shares, 0);
  }, [transactions, activePortfolioId, holdings]);

  // Save daily snapshot with NW, portfolio, and liabilities values
  // Save when there are holdings OR liabilities (even if prices haven't loaded yet,
  // the snapshot captures liabilities and any manually-priced assets)
  useEffect(() => {
    if (allEnrichedHoldings.length > 0 || liabilities.length > 0) {
      saveSnapshot(netWorthSummary.totalNetWorth, netWorthSummary.totalPortfolioValue, netWorthSummary.totalLiabilities);
    }
  }, [allEnrichedHoldings.length, liabilities.length, netWorthSummary.totalNetWorth, netWorthSummary.totalPortfolioValue, netWorthSummary.totalLiabilities, saveSnapshot]);

  const value: PortfolioContextValue = useMemo(() => ({
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
    enrichedHoldings: allEnrichedHoldings,
    summary: portfolioSummary,
    snapshots,
    addManualSnapshot,
    deleteSnapshot,
    priceCache,
    pricesLoading,
    priceError,
    refreshPrices,
    customCategories,
    allCategories,
    addCustomCategory,
    deleteCustomCategory,
    targetAllocations,
    setTargetAllocation,
    removeTargetAllocation,
    transactions,
    addTransaction,
    deleteTransaction,
    realizedPnl,
    benchmarkData,
    benchmarkEnabled,
    toggleBenchmark,
    importBenchmarkCsv,
    clearBenchmark,
    getBenchmarkDateRange,
    theme,
    themePreference,
    setTheme,
    accentColor,
    setAccentColor,
    baseCurrency,
    setBaseCurrency,
    portfolios,
    activePortfolioId,
    setActivePortfolioId,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
    liabilities,
    addLiability,
    updateLiability,
    deleteLiability,
    filteredEnrichedHoldings,
    filteredPortfolioSummary,
  }), [
    apiKey, setApiKey, hasApiKey, holdings, addHolding, updateHolding, deleteHolding,
    allEnrichedHoldings, netWorthSummary, portfolioEnrichedHoldings, portfolioSummary,
    snapshots, addManualSnapshot, deleteSnapshot, priceCache, pricesLoading, priceError,
    refreshPrices, customCategories, allCategories, addCustomCategory, deleteCustomCategory,
    targetAllocations, setTargetAllocation, removeTargetAllocation, transactions, addTransaction,
    deleteTransaction, realizedPnl, benchmarkData, benchmarkEnabled, toggleBenchmark,
    importBenchmarkCsv, clearBenchmark, getBenchmarkDateRange, theme, themePreference, setTheme, accentColor,
    setAccentColor, baseCurrency, setBaseCurrency, portfolios, activePortfolioId,
    setActivePortfolioId, createPortfolio, renamePortfolio, deletePortfolio, liabilities,
    addLiability, updateLiability, deleteLiability, filteredEnrichedHoldings, filteredPortfolioSummary,
  ]);

  return <PortfolioCtx.Provider value={value}>{children}</PortfolioCtx.Provider>;
}

export function usePortfolioContext() {
  const ctx = useContext(PortfolioCtx);
  if (!ctx) throw new Error('usePortfolioContext must be inside PortfolioProvider');
  return ctx;
}
