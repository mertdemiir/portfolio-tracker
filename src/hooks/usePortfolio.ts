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
  useEffect(() => {
    const needsMigration = snapshots.some((s) => s.netWorthValue === undefined);
    if (needsMigration) {
      setSnapshots((prev) =>
        prev.map((s) => {
          if (s.netWorthValue === undefined) {
            return {
              ...s,
              netWorthValue: s.totalValue,
              portfolioValue: s.portfolioValue ?? s.totalValue,
            };
          }
          return s;
        })
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addHolding = useCallback(
    (data: Omit<Holding, 'id'>): string => {
      const id = uuidv4();
      setHoldings((prev) => [...prev, { ...data, id }]);
      return id;
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

  const restoreHolding = useCallback(
    (holding: Holding) => {
      setHoldings((prev) => [...prev, holding]);
    },
    [setHoldings]
  );

  const saveSnapshot = useCallback(
    (netWorthValue: number, portfolioValue: number, totalLiabilities?: number) => {
      const today = todayDateString();
      setSnapshots((prev) => {
        const existing = prev.find((s) => s.date === today);
        if (existing?.name) {
          // Manual snapshot exists: only update portfolioValue/liabilities,
          // preserve the user's custom netWorthValue and name.
          // We persist totalLiabilities even when it's 0 so that paying off
          // the last liability is reflected (previous behavior dropped zero).
          return prev.map((s) => s.date === today ? {
            ...s,
            portfolioValue,
            ...(totalLiabilities !== undefined ? { totalLiabilities } : {}),
          } : s);
        }
        const snapshot: PortfolioSnapshot = {
          date: today,
          totalValue: netWorthValue,
          netWorthValue,
          portfolioValue,
          ...(totalLiabilities !== undefined && { totalLiabilities }),
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
        const updated = existing
          ? prev.map((s) => s.date === date ? {
              ...s, // preserve existing auto-data (portfolioValue, totalLiabilities)
              totalValue: netWorthValue,
              netWorthValue,
              ...(portfolioValue !== undefined ? { portfolioValue } : {}),
              ...(name ? { name } : s.name ? { name: s.name } : {}),
            } : s)
          : [...prev, {
              date,
              totalValue: netWorthValue,
              netWorthValue,
              ...(portfolioValue !== undefined && { portfolioValue }),
              ...(name && { name }),
            }];
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
    restoreHolding,
    saveSnapshot,
    addManualSnapshot,
    deleteSnapshot,
    customCategories,
    addCustomCategory,
    deleteCustomCategory,
  };
}
