/**
 * PortfolioContext — the user's portfolio state (holdings, transactions,
 * snapshots, liabilities, portfolios) + every derived summary.
 *
 * Scope (after the 2C split):
 *   - Owns: holdings, transactions, snapshots, liabilities, portfolios,
 *     activePortfolioId, realizedPnl
 *   - Derives: allEnrichedHoldings, portfolioEnrichedHoldings,
 *     filteredEnrichedHoldings, netWorthSummary, portfolioSummary,
 *     filteredPortfolioSummary
 *
 * Depends on: SettingsContext (baseCurrency, customCategories),
 *             PricesFxContext (priceCache, convertToBase, fxRates)
 *
 * This provider is the heaviest — enrichHoldings runs on every price
 * tick or holdings change. Consumers that only need theme/currency are
 * now on SettingsContext instead, and won't re-render when a single
 * price updates.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useSettings } from './SettingsContext';
import { usePricesFx, usePricesFxInternals } from './PricesFxContext';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolios } from '../hooks/usePortfolios';
import { useLiabilities } from '../hooks/useLiabilities';
import { useTransactions } from '../hooks/useTransactions';
import { enrichHoldings, calculateSummary, calculateNetWorthSummary } from '../utils/calculations';
import { LIVE_METAL_TICKERS } from '../utils/api';
import { DEFAULT_PORTFOLIO_ID } from '../types';
import type {
  Holding,
  EnrichedHolding,
  PortfolioSummary,
  PortfolioSnapshot,
  NetWorthSummary,
  Transaction,
  Portfolio,
  Liability,
} from '../types';

interface PortfolioContextValue {
  // Holdings
  holdings: Holding[];
  addHolding: (data: Omit<Holding, 'id'>) => void;
  updateHolding: (id: string, data: Omit<Holding, 'id'>) => void;
  deleteHolding: (id: string) => void;
  restoreHolding: (holding: Holding) => void;

  // All holdings (net worth)
  allEnrichedHoldings: EnrichedHolding[];
  netWorthSummary: NetWorthSummary;

  // Portfolio-only holdings (inPortfolio === true)
  portfolioEnrichedHoldings: EnrichedHolding[];
  portfolioSummary: PortfolioSummary;

  // Backward-compat aliases (still used by some older call sites)
  enrichedHoldings: EnrichedHolding[];
  summary: PortfolioSummary;

  // Snapshots
  snapshots: PortfolioSnapshot[];
  addManualSnapshot: (date: string, netWorthValue: number, portfolioValue?: number, name?: string) => void;
  deleteSnapshot: (date: string) => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (data: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  restoreTransaction: (txn: Transaction) => void;
  realizedPnl: number;

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

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { customCategories, baseCurrency } = useSettings();
  const { priceCache, pricesLoading, convertToBase, fetchPrices } = usePricesFx();
  const { registerRefresh } = usePricesFxInternals();

  const {
    holdings,
    snapshots,
    addHolding,
    updateHolding,
    deleteHolding,
    restoreHolding,
    saveSnapshot,
    addManualSnapshot,
    deleteSnapshot,
  } = usePortfolio();

  const { transactions, addTransaction, deleteTransaction, restoreTransaction } = useTransactions();
  const { portfolios, activePortfolioId, setActivePortfolioId, createPortfolio, renamePortfolio, deletePortfolio: deletePortfolioRaw } = usePortfolios();
  const { liabilities, addLiability, updateLiability, deleteLiability } = useLiabilities();

  // Refresh-every-price implementation — registered with PricesFxContext
  // so that context's refreshPrices can drive it. This is the one place
  // that has both the holdings list AND the fetchPrices callback.
  const refreshPrices = useCallback(() => {
    if (holdings.length > 0) {
      fetchPrices(holdings, true);
    }
  }, [holdings, fetchPrices]);

  useEffect(() => {
    registerRefresh(refreshPrices);
  }, [refreshPrices, registerRefresh]);

  // Fetch prices when the set of holdings (by ticker) changes
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
      if (!document.hidden) fetchPrices(holdings);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [holdings, fetchPrices]);

  // All enriched holdings (net worth allocation)
  const allEnrichedHoldings = useMemo(
    () => enrichHoldings(holdings, priceCache, convertToBase, baseCurrency),
    [holdings, priceCache, convertToBase],
  );

  // Portfolio-only enriched holdings
  const portfolioEnrichedHoldings = useMemo(
    () => enrichHoldings(holdings.filter((h) => h.inPortfolio), priceCache, convertToBase, baseCurrency),
    [holdings, priceCache, convertToBase],
  );

  const portfolioSummary = useMemo(
    () => calculateSummary(portfolioEnrichedHoldings, baseCurrency),
    [portfolioEnrichedHoldings],
  );

  // Filtered by active portfolio — uniformly inPortfolio=true across scopes.
  // See Phase 1C (#20) for the reasoning.
  const filteredEnrichedHoldings = useMemo(() => {
    if (activePortfolioId === 'all') return portfolioEnrichedHoldings;
    const filtered = holdings.filter(
      (h) => h.portfolioId === activePortfolioId && h.inPortfolio,
    );
    return enrichHoldings(filtered, priceCache, convertToBase, baseCurrency);
  }, [activePortfolioId, holdings, priceCache, convertToBase, portfolioEnrichedHoldings]);

  const filteredPortfolioSummary = useMemo(
    () => calculateSummary(filteredEnrichedHoldings, baseCurrency),
    [filteredEnrichedHoldings],
  );

  // Delete portfolio: move orphaned holdings AND transactions to default
  const deletePortfolio = useCallback(
    (id: string) => {
      if (id === DEFAULT_PORTFOLIO_ID) return;
      holdings.forEach((h) => {
        if (h.portfolioId === id) {
          const { id: _hid, ...data } = h;
          updateHolding(h.id, { ...data, portfolioId: DEFAULT_PORTFOLIO_ID });
        }
      });
      transactions.forEach((t) => {
        if (t.portfolioId === id) {
          const { id: _txnId, ...txnData } = t;
          deleteTransaction(t.id);
          addTransaction({ ...txnData, portfolioId: DEFAULT_PORTFOLIO_ID });
        }
      });
      deletePortfolioRaw(id);
    },
    [holdings, updateHolding, deletePortfolioRaw, transactions, deleteTransaction, addTransaction],
  );

  const netWorthSummary = useMemo(
    () => calculateNetWorthSummary(allEnrichedHoldings, customCategories, liabilities, convertToBase, baseCurrency),
    [allEnrichedHoldings, customCategories, liabilities, convertToBase],
  );

  // Realized P&L — sum of (sellPrice - costBasis) * shares for sell
  // transactions, converted to base currency. Filtered by active portfolio
  // using the transaction's own portfolioId (schema v1 makes this required).
  const realizedPnl = useMemo(() => {
    const sellTxns = transactions.filter((t) => t.type === 'sell' && t.costBasisPerShare !== undefined);

    const computeGain = (t: Transaction) => {
      const gain = (t.pricePerShare - t.costBasisPerShare!) * t.shares;
      const txnCurrency = t.currency || 'USD';
      return convertToBase(gain, txnCurrency);
    };

    if (activePortfolioId === 'all') {
      return sellTxns.reduce((sum, t) => sum + computeGain(t), 0);
    }

    const filteredSells = sellTxns.filter((t) => t.portfolioId === activePortfolioId);
    return filteredSells.reduce((sum, t) => sum + computeGain(t), 0);
  }, [transactions, activePortfolioId, convertToBase]);

  // Save daily snapshot with NW, portfolio, and liabilities values.
  // See Phase 1A (#8) for the "wait for successful fetches" logic.
  const apiBackedHoldings = useMemo(
    () => holdings.filter((h) =>
      h.assetType === 'stock' || h.assetType === 'etf' || h.assetType === 'crypto' ||
      (h.assetType === 'metal' && (LIVE_METAL_TICKERS as readonly string[]).includes(h.ticker))
    ),
    [holdings],
  );
  const allApiHoldingsFetched = useMemo(
    () => apiBackedHoldings.every((h) => priceCache[`${h.assetType}:${h.ticker}`] !== undefined),
    [apiBackedHoldings, priceCache],
  );
  const pricesReady = apiBackedHoldings.length === 0 || (allApiHoldingsFetched && !pricesLoading);

  useEffect(() => {
    if (pricesReady && (allEnrichedHoldings.length > 0 || liabilities.length > 0)) {
      saveSnapshot(
        netWorthSummary.totalNetWorth.amount,
        netWorthSummary.totalPortfolioValue.amount,
        netWorthSummary.totalLiabilities.amount,
      );
    }
  }, [pricesReady, allEnrichedHoldings.length, liabilities.length, netWorthSummary.totalNetWorth.amount, netWorthSummary.totalPortfolioValue.amount, netWorthSummary.totalLiabilities.amount, saveSnapshot]);

  const value: PortfolioContextValue = useMemo(
    () => ({
      holdings, addHolding, updateHolding, deleteHolding, restoreHolding,
      allEnrichedHoldings, netWorthSummary,
      portfolioEnrichedHoldings, portfolioSummary,
      enrichedHoldings: allEnrichedHoldings,
      summary: portfolioSummary,
      snapshots, addManualSnapshot, deleteSnapshot,
      transactions, addTransaction, deleteTransaction, restoreTransaction, realizedPnl,
      portfolios, activePortfolioId, setActivePortfolioId, createPortfolio, renamePortfolio, deletePortfolio,
      liabilities, addLiability, updateLiability, deleteLiability,
      filteredEnrichedHoldings, filteredPortfolioSummary,
    }),
    [
      holdings, addHolding, updateHolding, deleteHolding, restoreHolding,
      allEnrichedHoldings, netWorthSummary,
      portfolioEnrichedHoldings, portfolioSummary,
      snapshots, addManualSnapshot, deleteSnapshot,
      transactions, addTransaction, deleteTransaction, restoreTransaction, realizedPnl,
      portfolios, activePortfolioId, setActivePortfolioId, createPortfolio, renamePortfolio, deletePortfolio,
      liabilities, addLiability, updateLiability, deleteLiability,
      filteredEnrichedHoldings, filteredPortfolioSummary,
    ],
  );

  return <PortfolioCtx.Provider value={value}>{children}</PortfolioCtx.Provider>;
}

export function usePortfolioContext(): PortfolioContextValue {
  const ctx = useContext(PortfolioCtx);
  if (!ctx) throw new Error('usePortfolioContext must be inside PortfolioProvider');
  return ctx;
}
