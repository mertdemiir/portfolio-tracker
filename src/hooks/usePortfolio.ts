import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLocalStorage } from './useLocalStorage';
import { todayDateString } from '../utils/formatters';
import { getDefaultCategory } from '../types';
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

  // Migration: add assetType, inPortfolio, category to existing holdings
  useEffect(() => {
    const needsMigration = holdings.some(
      (h) => !h.assetType || h.inPortfolio === undefined || h.category === undefined
    );
    if (needsMigration) {
      setHoldings((prev) =>
        prev.map((h) => ({
          ...h,
          assetType: h.assetType || ('stock' as const),
          inPortfolio: h.inPortfolio ?? true,
          category: h.category ?? getDefaultCategory(h.assetType || 'stock'),
        }))
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Migration: backfill netWorthValue/portfolioValue on old snapshots
  useEffect(() => {
    const needsMigration = snapshots.some(
      (s) => s.netWorthValue === undefined || s.portfolioValue === undefined
    );
    if (needsMigration) {
      setSnapshots((prev) =>
        prev.map((s) => ({
          ...s,
          netWorthValue: s.netWorthValue ?? s.totalValue,
          portfolioValue: s.portfolioValue ?? s.totalValue,
        }))
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
    (netWorthValue: number, portfolioValue: number) => {
      const today = todayDateString();
      setSnapshots((prev) => {
        const existing = prev.find((s) => s.date === today);
        const snapshot: PortfolioSnapshot = {
          date: today,
          totalValue: netWorthValue,
          netWorthValue,
          portfolioValue,
        };
        if (existing) {
          return prev.map((s) => (s.date === today ? snapshot : s));
        }
        return [...prev, snapshot];
      });
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
    customCategories,
    addCustomCategory,
    deleteCustomCategory,
  };
}
