import { describe, it, expect } from 'vitest';
import { computeCumulativeContributions, contributionsOnOrBefore } from '../contributions';
import type { Transaction } from '../../types';

const noFx = (amount: number) => amount; // identity

const txn = (p: Partial<Transaction> & { id: string; type: Transaction['type']; date: string }): Transaction => ({
  ticker: 'CASH',
  name: 'Cash',
  shares: 0,
  pricePerShare: 0,
  total: 0,
  portfolioId: 'default',
  currency: 'USD',
  ...p,
});

describe('computeCumulativeContributions', () => {
  it('sums deposits as positive, withdrawals as negative', () => {
    const m = computeCumulativeContributions(
      [
        txn({ id: 't1', type: 'deposit', total: 1000, date: '2026-01-01' }),
        txn({ id: 't2', type: 'withdrawal', total: 200, date: '2026-02-01' }),
        txn({ id: 't3', type: 'deposit', total: 500, date: '2026-03-01' }),
      ],
      noFx,
    );
    expect(m.get('2026-01-01')).toBe(1000);
    expect(m.get('2026-02-01')).toBe(800);
    expect(m.get('2026-03-01')).toBe(1300);
  });

  it('excludes buy / sell / interest', () => {
    const m = computeCumulativeContributions(
      [
        txn({ id: 't1', type: 'buy', total: 5000, date: '2026-01-01', ticker: 'AAPL' }),
        txn({ id: 't2', type: 'sell', total: 3000, date: '2026-02-01', ticker: 'AAPL' }),
        txn({ id: 't3', type: 'interest', total: 12, date: '2026-03-01' }),
      ],
      noFx,
    );
    // No deposit/withdrawal/correction → cumulative is 0 at every recorded date,
    // and the map only records dates where we actually emitted a row (we record
    // every txn date even if delta=0; the cumulative remains 0).
    expect(m.get('2026-01-01')).toBe(0);
    expect(m.get('2026-02-01')).toBe(0);
    expect(m.get('2026-03-01')).toBe(0);
  });

  it('treats correction as a signed contribution', () => {
    const m = computeCumulativeContributions(
      [
        txn({ id: 't1', type: 'deposit', total: 1000, date: '2026-01-01' }),
        // correction -50 (user reconciled their balance down)
        txn({ id: 't2', type: 'correction', total: -50, date: '2026-02-01' }),
      ],
      noFx,
    );
    expect(m.get('2026-02-01')).toBe(950);
  });

  it('uses convertToBase to normalize foreign-currency contributions', () => {
    const fxEUR_to_USD = (amt: number, ccy: string) => (ccy === 'EUR' ? amt * 1.1 : amt);
    const m = computeCumulativeContributions(
      [
        txn({ id: 't1', type: 'deposit', total: 1000, date: '2026-01-01', currency: 'EUR' }),
      ],
      fxEUR_to_USD,
    );
    expect(m.get('2026-01-01')).toBeCloseTo(1100, 6);
  });
});

describe('contributionsOnOrBefore', () => {
  it('returns the latest cumulative value at or before the target', () => {
    const m = new Map<string, number>([
      ['2026-01-01', 1000],
      ['2026-02-01', 800],
      ['2026-03-15', 1300],
    ]);
    expect(contributionsOnOrBefore(m, '2026-02-15')).toBe(800);
    expect(contributionsOnOrBefore(m, '2026-03-15')).toBe(1300);
    expect(contributionsOnOrBefore(m, '2026-04-01')).toBe(1300);
  });

  it('returns 0 if the target predates all entries', () => {
    const m = new Map<string, number>([['2026-01-01', 1000]]);
    expect(contributionsOnOrBefore(m, '2025-12-31')).toBe(0);
  });

  it('returns 0 for an empty map', () => {
    expect(contributionsOnOrBefore(new Map(), '2026-01-01')).toBe(0);
  });
});
