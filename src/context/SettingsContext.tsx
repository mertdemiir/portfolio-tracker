/**
 * SettingsContext — the app's global, rarely-changing preferences.
 *
 * Scope:
 *   - API key for Finnhub (source of live stock/ETF prices)
 *   - Theme (preference + resolved variant), accent color
 *   - Base currency (the display currency; all cross-currency math
 *     normalizes to this)
 *   - User-defined taxonomies: custom categories, target allocations
 *
 * Why split this out of the monolithic PortfolioContext: these values
 * change rarely, but PortfolioContext re-rendered on every price tick.
 * Consumers that only need settings (most of the chart components for
 * theme colors, the FirePage for nothing-settings-related) used to be
 * subscribed to every portfolio state change. After the split they're
 * subscribed only here.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useApiKey } from '../hooks/useApiKey';
import { useTheme } from '../hooks/useTheme';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useTargetAllocations } from '../hooks/useTargetAllocations';
import { setGlobalBaseCurrency } from '../utils/formatters';
import { DEFAULT_CATEGORIES } from '../types';
import type {
  CustomCategory,
  TargetAllocation,
  ThemeId,
  ThemePreference,
} from '../types';

interface SettingsContextValue {
  // API key
  apiKey: string;
  setApiKey: (key: string) => void;
  hasApiKey: boolean;

  // Theme
  theme: ThemeId;
  themePreference: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  accentColor: string;
  setAccentColor: (c: string) => void;

  // Base currency
  baseCurrency: string;
  setBaseCurrency: (c: string) => void;

  // Custom categories
  customCategories: CustomCategory[];
  allCategories: { key: string; label: string }[];
  addCustomCategory: (label: string) => void;
  deleteCustomCategory: (key: string) => void;

  // Target allocations (per category)
  targetAllocations: TargetAllocation[];
  setTargetAllocation: (categoryKey: string, targetPercent: number) => void;
  removeTargetAllocation: (categoryKey: string) => void;
}

const SettingsCtx = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { apiKey, setApiKey, hasApiKey } = useApiKey();
  const { theme, themePreference, setTheme, accentColor, setAccentColor } = useTheme();
  const [baseCurrency, setBaseCurrency] = useLocalStorage<string>('base-currency', 'USD');
  const { targetAllocations, setTargetAllocation, removeTargetAllocation } = useTargetAllocations();

  // Custom categories — owned here since they're a settings concern that
  // crosses many surfaces (Add Holding form, Settings modal, chart labels).
  const [customCategories, setCustomCategories] = useLocalStorage<CustomCategory[]>(
    'custom-categories',
    [],
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
    [setCustomCategories],
  );

  const deleteCustomCategory = useCallback(
    (key: string) => {
      setCustomCategories((prev) => prev.filter((c) => c.key !== key));
      // Note: re-tagging holdings in the deleted category to "other" is the
      // portfolio provider's job and happens there so the SettingsContext
      // doesn't need a direct dependency on the holdings array.
    },
    [setCustomCategories],
  );

  // Keep the global formatter in sync with the chosen base currency.
  // This is a side effect on a module-level singleton in formatters.ts.
  useEffect(() => {
    setGlobalBaseCurrency(baseCurrency);
  }, [baseCurrency]);

  const allCategories = useMemo(
    () => [...DEFAULT_CATEGORIES, ...customCategories],
    [customCategories],
  );

  const value: SettingsContextValue = useMemo(
    () => ({
      apiKey,
      setApiKey,
      hasApiKey,
      theme,
      themePreference,
      setTheme,
      accentColor,
      setAccentColor,
      baseCurrency,
      setBaseCurrency,
      customCategories,
      allCategories,
      addCustomCategory,
      deleteCustomCategory,
      targetAllocations,
      setTargetAllocation,
      removeTargetAllocation,
    }),
    [
      apiKey, setApiKey, hasApiKey,
      theme, themePreference, setTheme, accentColor, setAccentColor,
      baseCurrency, setBaseCurrency,
      customCategories, allCategories, addCustomCategory, deleteCustomCategory,
      targetAllocations, setTargetAllocation, removeTargetAllocation,
    ],
  );

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider');
  return ctx;
}
