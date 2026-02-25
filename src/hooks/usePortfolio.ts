import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLocalStorage } from './useLocalStorage';
import { todayDateString } from '../utils/formatters';
import { getDefaultCategory, DEFAULT_PORTFOLIO_ID } from '../types';
import type { Holding, PortfolioSnapshot, CustomCategory } from '../types';

export function usePortfolio() {
  const [holdings, setHoldings] = useLocalStorage<Holding[]>('portfolio-holdings', []);
  const [snapshots, setSnapshots] = useLocalStorage<PortfolioSnapshot[]>(
    'portfolio-snapshots',
    []
  );
  const [customCategories, setCustomCategories] = useLocalStorage<CustomCategory[]>(
    'custom-categories',
    []
  );

  // Migration: add assetType, inPortfolio, category, portfolioId to existing holdings
  useEffect(() => {
    const needsMigration = holdings.some(
      (h) => !h.assetType || h.inPortfolio === undefined || h.category === undefined || h.portfolioId === undefined
    );
    if (needsMigration) {
      setHoldings((prev) =>
        prev.map((h) => ({
          ...h,
          assetType: h.assetType || ('stock' as const),
          inPortfolio: h.inPortfolio ?? true,
          category: h.category ?? getDefaultCategory(h.assetType || 'stock'),
          portfolioId: h.portfolioId ?? DEFAULT_PORTFOLIO_ID,
        }))
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Migration: backfill netWorthValue on old snapshots (pre-migration ones lack netWorthValue)
  // Only backfill portfolioValue on truly old snapshots where netWorthValue was also missing,
  // NOT on manual entries that intentionally omit portfolioValue.
  // Cleanup: strip portfolioValue from manual NW-only entries where the old migration
  // incorrectly set portfolioValue = totalValue = netWorthValue.
  useEffect(() => {
    const needsMigration = snapshots.some((s) => s.netWorthValue === undefined);
    const needsCleanup = snapshots.some(
      (s) =>
        s.portfolioValue !== undefined &&
        s.portfolioValue === s.totalValue &&
        s.totalValue === s.netWorthValue
    );
    if (needsMigration || needsCleanup) {
      setSnapshots((prev) =>
        prev.map((s) => {
          // Old pre-migration snapshot: backfill both fields
          if (s.netWorthValue === undefined) {
            return {
              ...s,
              netWorthValue: s.totalValue,
              portfolioValue: s.portfolioValue ?? s.totalValue,
            };
          }
          // Cleanup: manual NW-only entry that was incorrectly given portfolioValue
          if (
            s.portfolioValue !== undefined &&
            s.portfolioValue === s.totalValue &&
            s.totalValue === s.netWorthValue
          ) {
            const { portfolioValue: _, ...rest } = s;
            return rest as PortfolioSnapshot;
          }
          return s;
        })
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addHolding = useCallback(
    (data: Omit<Holding, 'id'>) => {
      setHoldings((prev) => [...prev, { ...data, id: uuidv4() }]);
    },
    [setHoldings]
  );

  const updateHolding = useCallback(
    (id: string, data: Omit<Holding, 'id'>) => {
      setHoldings((prev) =>
        prev.map((h) => (h.id === id ? { ...data, id } : h))
      );
    },
    [setHoldings]
  );

  const deleteHolding = useCallback(
    (id: string) => {
      setHoldings((prev) => prev.filter((h) => h.id !== id));
    },
    [setHoldings]
  );

  const saveSnapshot = useCallback(
    (netWorthValue: number, portfolioValue: number, totalLiabilities?: number) => {
      const today = todayDateString();
      setSnapshots((prev) => {
        const existing = prev.find((s) => s.date === today);
        const snapshot: PortfolioSnapshot = {
          date: today,
          totalValue: netWorthValue,
          netWorthValue,
          portfolioValue,
          ...(totalLiabilities !== undefined && totalLiabilities > 0 && { totalLiabilities }),
        };
        if (existing) {
          return prev.map((s) => (s.date === today ? snapshot : s));
        }
        return [...prev, snapshot];
      });
    },
    [setSnapshots]
  );

  const addManualSnapshot = useCallback(
    (date: string, netWorthValue: number, portfolioValue?: number, name?: string) => {
      setSnapshots((prev) => {
        const existing = prev.find((s) => s.date === date);
        const snapshot: PortfolioSnapshot = {
          date,
          totalValue: netWorthValue,
          netWorthValue,
          ...(portfolioValue !== undefined && { portfolioValue }),
          ...(name && { name }),
        };
        const updated = existing
          ? prev.map((s) => (s.date === date ? { ...snapshot, ...(s.name && !name ? { name: s.name } : {}) } : s))
          : [...prev, snapshot];
        return updated.sort((a, b) => a.date.localeCompare(b.date));
      });
    },
    [setSnapshots]
  );

  const deleteSnapshot = useCallback(
    (date: string) => {
      setSnapshots((prev) => prev.filter((s) => s.date !== date));
    },
    [setSnapshots]
  );

  const addCustomCategory = useCallback(
    (label: string) => {
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (!key) return;
      setCustomCategories((prev) => {
        if (prev.some((c) => c.key === key)) return prev;
        return [...prev, { key, label }];
      });
    },
    [setCustomCategories]
  );

  const deleteCustomCategory = useCallback(
    (key: string) => {
      setCustomCategories((prev) => prev.filter((c) => c.key !== key));
      // Move holdings in deleted category to 'other'
      setHoldings((prev) =>
        prev.map((h) => (h.category === key ? { ...h, category: 'other' } : h))
      );
    },
    [setCustomCategories, setHoldings]
  );

  return {
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
  };
}
