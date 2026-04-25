import type { Transaction } from '../types';

/**
 * Cumulative external contributions to the portfolio, by ISO date.
 *
 * Definition (deliberately conservative — matches the model the app
 * actually has in v1.4):
 *
 *   contribution(t) := + deposit.total      (cash in from outside)
 *                      − withdrawal.total   (cash out to outside)
 *                      + correction.total   (signed; reconciles balance)
 *
 *   buys/sells/interest are EXCLUDED. The assumption is that buys/sells
 *   move money WITHIN the portfolio (cash → stock and back), and interest
 *   is earned, not contributed. For users without explicit deposit/
 *   withdrawal transactions, contributions will be ~0 and the "NW excl.
 *   contributions" line will track the NW line.
 *
 * Returns a Map<isoDate, cumulativeBaseAmount>. Dates with multiple
 * txns share a single cumulative value (the post-day total).
 *
 * @param transactions   Full transaction ledger
 * @param convertToBase  (amount, fromCurrency) → amount in base currency
 *                        (matches usePricesFx().convertToBase signature)
 */
export function computeCumulativeContributions(
  transactions: Transaction[],
  convertToBase: (amount: number, fromCurrency: string) => number,
): Map<string, number> {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const cumByDate = new Map<string, number>();
  let running = 0;

  for (const t of sorted) {
    const currency = t.currency || 'USD';
    let signedDelta = 0;
    switch (t.type) {
      case 'deposit':
        signedDelta = +t.total;
        break;
      case 'withdrawal':
        signedDelta = -t.total;
        break;
      case 'correction':
        // Stored signed (per CashLedgerModal) — treat as a balance reconciliation.
        signedDelta = +t.total;
        break;
      // buy / sell / interest contribute nothing.
      default:
        signedDelta = 0;
    }
    if (signedDelta !== 0) {
      running += convertToBase(signedDelta, currency);
    }
    cumByDate.set(t.date, running);
  }
  return cumByDate;
}

/**
 * Look up the cumulative contributions on or before a given date.
 * Used by the chart to align contribution values with snapshot dates.
 */
export function contributionsOnOrBefore(
  cumByDate: Map<string, number>,
  targetDate: string,
): number {
  // Walk all keys; cheap (snapshot count tends to be small). For users
  // with many snapshots and txns, sort once outside the hot path and
  // binary-search.
  let best = 0;
  let bestDate = '';
  for (const [date, value] of cumByDate) {
    if (date <= targetDate && date > bestDate) {
      best = value;
      bestDate = date;
    }
  }
  return best;
}
