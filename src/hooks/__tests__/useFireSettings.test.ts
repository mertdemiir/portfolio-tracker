import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFireSettings } from '../useFireSettings';

describe('useFireSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults on first use', () => {
    const { result } = renderHook(() => useFireSettings());
    const [settings] = result.current;
    expect(settings.annualExpenses).toBe(0);
    expect(settings.expectedReturn).toBe(7);
    expect(settings.portfolioVolatility).toBe(15);
  });

  it('fills in portfolioVolatility for legacy stored settings (regression: #5)', () => {
    // Simulate a user who saved fire-settings before portfolioVolatility existed
    const legacy = {
      annualExpenses: 50000,
      monthlyContribution: 1000,
      expectedReturn: 7,
      inflationRate: 3,
      safeWithdrawalRate: 4,
      currentAge: 30,
      targetRetirementAge: 55,
      leanMultiplier: 0.7,
      fatMultiplier: 1.5,
    };
    localStorage.setItem('fire-settings', JSON.stringify(legacy));

    const { result } = renderHook(() => useFireSettings());
    const [settings] = result.current;
    expect(settings.portfolioVolatility).toBe(15); // filled in
    expect(settings.annualExpenses).toBe(50000); // preserved
  });

  it('updates individual fields via partial patches', () => {
    const { result } = renderHook(() => useFireSettings());
    act(() => {
      result.current[1]({ portfolioVolatility: 10 });
    });
    expect(result.current[0].portfolioVolatility).toBe(10);
    // Other fields unchanged
    expect(result.current[0].expectedReturn).toBe(7);
  });
});
