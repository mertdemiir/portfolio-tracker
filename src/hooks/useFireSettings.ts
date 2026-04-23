import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface FireSettings {
  annualExpenses: number;
  monthlyContribution: number;
  expectedReturn: number;       // % real return
  inflationRate: number;        // %
  safeWithdrawalRate: number;   // %
  currentAge: number;
  targetRetirementAge: number;
  leanMultiplier: number;       // e.g. 0.7 = 70% of expenses
  fatMultiplier: number;        // e.g. 1.5 = 150% of expenses
  /**
   * Annualised standard deviation of portfolio returns, in percent.
   * Used as the stdev input to the Monte Carlo simulation. Typical ranges:
   *   - 60/40 stocks/bonds: ~10%
   *   - 80/20: ~12%
   *   - 90/10: ~15%
   *   - 100% equities: ~18–20%
   */
  portfolioVolatility: number;
}

const DEFAULT_SETTINGS: FireSettings = {
  annualExpenses: 0,
  monthlyContribution: 0,
  expectedReturn: 7,
  inflationRate: 3,
  safeWithdrawalRate: 4,
  currentAge: 30,
  targetRetirementAge: 55,
  leanMultiplier: 0.7,
  fatMultiplier: 1.5,
  portfolioVolatility: 15,
};

export function useFireSettings() {
  const [settings, setSettings] = useLocalStorage<FireSettings>('fire-settings', DEFAULT_SETTINGS);

  // Defensive merge: older saved settings won't have keys added in later
  // versions (e.g. portfolioVolatility). Fill in defaults at read time so
  // consumers always see a complete object.
  const mergedSettings: FireSettings = { ...DEFAULT_SETTINGS, ...settings };

  const updateSettings = useCallback(
    (partial: Partial<FireSettings>) => {
      setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...partial }));
    },
    [setSettings],
  );

  return [mergedSettings, updateSettings] as const;
}
