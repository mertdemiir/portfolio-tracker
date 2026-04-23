import { describe, it, expect } from 'vitest';
import { decideBuyFxRate } from '../fxHelpers';
import type { FxRates } from '../../types';

const makeRates = (base: string, rates: Record<string, number>): FxRates => ({
  base,
  date: '2026-01-01',
  rates,
  fetchedAt: Date.now(),
});

// A simple stand-in for useFxRates.convertToBase
const makeConvert = (fxRates: FxRates | null, baseCurrency: string) =>
  (amount: number, fromCurrency = 'USD') => {
    if (fromCurrency === baseCurrency) return amount;
    if (!fxRates || fxRates.base !== baseCurrency) return amount;
    const r = fxRates.rates[fromCurrency];
    if (!r) return amount;
    return amount / r;
  };

describe('decideBuyFxRate', () => {
  it('returns 1 when new currency matches base', () => {
    const fxRates = makeRates('USD', { EUR: 0.9 });
    expect(
      decideBuyFxRate({
        newCurrency: 'USD',
        baseCurrency: 'USD',
        fxRates,
        convertToBase: makeConvert(fxRates, 'USD'),
      })
    ).toBe(1);
  });

  it('captures live rate on ADD when rates are ready', () => {
    const fxRates = makeRates('USD', { EUR: 0.9 });
    const rate = decideBuyFxRate({
      newCurrency: 'EUR',
      baseCurrency: 'USD',
      fxRates,
      convertToBase: makeConvert(fxRates, 'USD'),
    });
    // 1 EUR in USD = 1 / 0.9 = ~1.111
    expect(rate).toBeCloseTo(1.111, 2);
  });

  it('returns undefined on ADD when rates are not loaded', () => {
    expect(
      decideBuyFxRate({
        newCurrency: 'EUR',
        baseCurrency: 'USD',
        fxRates: null,
        convertToBase: makeConvert(null, 'USD'),
      })
    ).toBeUndefined();
  });

  it('returns undefined on ADD when rates are for a different base', () => {
    const fxRates = makeRates('EUR', { USD: 1.1 });
    expect(
      decideBuyFxRate({
        newCurrency: 'EUR',
        baseCurrency: 'USD',
        fxRates,
        convertToBase: makeConvert(fxRates, 'USD'),
      })
    ).toBeUndefined();
  });

  it('PRESERVES buyFxRate on EDIT when currency unchanged (regression: #2)', () => {
    const fxRates = makeRates('USD', { EUR: 0.85 }); // different from what was stored
    expect(
      decideBuyFxRate({
        newCurrency: 'EUR',
        baseCurrency: 'USD',
        existingBuyFxRate: 1.2, // legacy captured at purchase
        existingCurrency: 'EUR',
        fxRates,
        convertToBase: makeConvert(fxRates, 'USD'),
      })
    ).toBe(1.2);
  });

  it('preserves undefined buyFxRate on EDIT when currency unchanged', () => {
    const fxRates = makeRates('USD', { EUR: 0.9 });
    expect(
      decideBuyFxRate({
        newCurrency: 'EUR',
        baseCurrency: 'USD',
        existingBuyFxRate: undefined,
        existingCurrency: 'EUR',
        fxRates,
        convertToBase: makeConvert(fxRates, 'USD'),
      })
    ).toBeUndefined();
  });

  it('recaptures rate on EDIT when currency changed', () => {
    const fxRates = makeRates('USD', { EUR: 0.9, GBP: 0.8 });
    const rate = decideBuyFxRate({
      newCurrency: 'GBP',
      baseCurrency: 'USD',
      existingBuyFxRate: 1.1, // was EUR rate
      existingCurrency: 'EUR',
      fxRates,
      convertToBase: makeConvert(fxRates, 'USD'),
    });
    // 1 GBP in USD = 1 / 0.8 = 1.25
    expect(rate).toBeCloseTo(1.25, 2);
  });

  it('returns undefined rather than wrong value when rates are missing for new currency', () => {
    const fxRates = makeRates('USD', { EUR: 0.9 });
    expect(
      decideBuyFxRate({
        newCurrency: 'ZZZ',
        baseCurrency: 'USD',
        fxRates,
        convertToBase: makeConvert(fxRates, 'USD'),
      })
    ).toBeUndefined();
  });
});
