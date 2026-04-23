/**
 * Pure helpers for deciding when to capture a `buyFxRate` on a holding.
 *
 * `buyFxRate` is the conversion factor from the holding's native currency to
 * the app's base currency at the time of purchase. It freezes the historical
 * cost basis so that later FX moves don't retroactively change P&L.
 *
 * Rules:
 *   - On ADD: capture current live rate if rates are ready; otherwise leave
 *     unset (enrichHoldings will fall back to live rate until we get one).
 *   - On EDIT with unchanged currency: preserve the existing value so we
 *     don't lose the original historical rate.
 *   - On EDIT with changed currency: recapture at current live rate (the
 *     old rate corresponded to the old currency and no longer applies).
 *   - If rates are unavailable at the moment of re-capture, leave unset
 *     rather than writing a stale value.
 */

import type { FxRates } from '../types';

export interface BuyFxRateDecisionInput {
  /** Currency of the new (or edited) holding */
  newCurrency: string;
  /** App base currency */
  baseCurrency: string;
  /** Existing holding being edited, or null/undefined for new holdings */
  existingBuyFxRate?: number | undefined;
  /** Previous currency of the holding being edited, undefined for adds */
  existingCurrency?: string | undefined;
  /** Currently loaded FX rates (null if never fetched) */
  fxRates: FxRates | null;
  /** Pure converter — typically `convertToBase` from useFxRates */
  convertToBase: (amount: number, fromCurrency?: string) => number;
}

/**
 * Returns the `buyFxRate` to persist on the holding, or `undefined` if we
 * shouldn't store one.
 */
export function decideBuyFxRate(input: BuyFxRateDecisionInput): number | undefined {
  const {
    newCurrency,
    baseCurrency,
    existingBuyFxRate,
    existingCurrency,
    fxRates,
    convertToBase,
  } = input;

  const isEdit = existingCurrency !== undefined;
  const currencyChanged = isEdit && existingCurrency !== newCurrency;

  // Fast path: same currency as base means rate is exactly 1, always safe.
  if (newCurrency === baseCurrency) {
    return 1;
  }

  // If we're editing and the currency is unchanged, preserve whatever was
  // there (could be undefined, which is also fine).
  if (isEdit && !currencyChanged) {
    return existingBuyFxRate;
  }

  // Fresh capture needed (new holding, or edit that changed currency).
  // Only record a rate if rates are loaded for the right base.
  const rateReady = fxRates && fxRates.base === baseCurrency;
  if (!rateReady) {
    return undefined;
  }

  const rate = convertToBase(1, newCurrency);
  // convertToBase falls back to the input amount if the currency is missing
  // from the rate table; detect that and avoid storing a misleading 1:1.
  if (rate === 1 && newCurrency !== baseCurrency) {
    return undefined;
  }
  return rate;
}
