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
};

export function useFireSettings() {
  const [settings, setSettings] = useLocalStorage<FireSettings>('fire-settings', DEFAULT_SETTINGS);

  const updateSettings = useCallback(
    (partial: Partial<FireSettings>) => {
      setSettings((prev) => ({ ...prev, ...partial }));
    },
    [setSettings],
  );

  return [settings, updateSettings] as const;
}
