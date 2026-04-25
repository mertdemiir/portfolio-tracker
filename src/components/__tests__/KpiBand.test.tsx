import { describe, it, expect } from 'vitest';
import { computePeriodReturn } from '../KpiBand';
import type { PortfolioSnapshot } from '../../types';

const makeSnap = (date: string, nw: number): PortfolioSnapshot => ({
  date,
  totalValue: nw,
  netWorthValue: nw,
});

/**
 * KpiBand renders the period-return / annualized stats. The math lives
 * in computePeriodReturn — that's what we test, since rendering needs
 * the portfolio context which would require heavy mocking.
 */
describe('KpiBand.computePeriodReturn', () => {
  it('returns nulls when there are fewer than 2 snapshots', () => {
    expect(computePeriodReturn([], 'ALL')).toEqual({ periodReturnPct: null, annualizedPct: null });
    expect(computePeriodReturn([makeSnap('2024-01-01', 100)], 'ALL')).toEqual({
      periodReturnPct: null,
      annualizedPct: null,
    });
  });

  it('1M return: percentage only, no annualization (too noisy)', () => {
    const snaps = [makeSnap('2024-01-01', 100), makeSnap('2024-01-31', 110)];
    const r = computePeriodReturn(snaps, '1M');
    expect(r.periodReturnPct).toBeCloseTo(10, 6);
    expect(r.annualizedPct).toBeNull();
  });

  it('3M annualizes by ×4', () => {
    const snaps = [makeSnap('2024-01-01', 100), makeSnap('2024-03-31', 105)];
    const r = computePeriodReturn(snaps, '3M');
    expect(r.periodReturnPct).toBeCloseTo(5, 6);
    expect(r.annualizedPct).toBeCloseTo(20, 6); // 5% × 4
  });

  it('1Y annualizes by ×1 (already a year)', () => {
    const snaps = [makeSnap('2023-01-01', 100), makeSnap('2024-01-01', 110)];
    const r = computePeriodReturn(snaps, '1Y');
    expect(r.periodReturnPct).toBeCloseTo(10, 6);
    expect(r.annualizedPct).toBeCloseTo(10, 6);
  });

  it('ALL annualizes by elapsed years (date-based)', () => {
    const snaps = [makeSnap('2022-01-01', 100), makeSnap('2024-01-01', 144)];
    const r = computePeriodReturn(snaps, 'ALL');
    expect(r.periodReturnPct).toBeCloseTo(44, 1);
    // 44% over ~2 years → ~22% / year
    expect(r.annualizedPct).toBeCloseTo(22, 0);
  });

  it('returns null when first value is non-positive (avoid divide by zero)', () => {
    const snaps = [makeSnap('2024-01-01', 0), makeSnap('2024-12-31', 100)];
    const r = computePeriodReturn(snaps, '1Y');
    expect(r.periodReturnPct).toBeNull();
    expect(r.annualizedPct).toBeNull();
  });
});
