import { describe, it, expect } from 'vitest';
import { findSnapshotOnOrBefore, findStartSnapshot, startDateForPeriod } from '../snapshotPeriods';
import type { PortfolioSnapshot } from '../../types';

const snap = (date: string, nw = 1000): PortfolioSnapshot => ({
  date,
  totalValue: nw,
  netWorthValue: nw,
});

describe('snapshotPeriods', () => {
  describe('startDateForPeriod', () => {
    it('YTD returns Jan 1 of the current year', () => {
      expect(startDateForPeriod('YTD', '2026-04-25')).toBe('2026-01-01');
    });
    it('1W returns 7 days before today', () => {
      expect(startDateForPeriod('1W', '2026-04-25')).toBe('2026-04-18');
    });
    it('1M returns the same day one calendar month earlier', () => {
      expect(startDateForPeriod('1M', '2026-04-25')).toBe('2026-03-25');
    });
    it('3M returns the same day three calendar months earlier', () => {
      expect(startDateForPeriod('3M', '2026-04-25')).toBe('2026-01-25');
    });
    it('1Y returns the same day one year earlier', () => {
      expect(startDateForPeriod('1Y', '2026-04-25')).toBe('2025-04-25');
    });
    it('ALL returns null (caller uses earliest snapshot)', () => {
      expect(startDateForPeriod('ALL', '2026-04-25')).toBeNull();
    });
  });

  describe('findSnapshotOnOrBefore', () => {
    const snapshots = [
      snap('2026-01-01', 100),
      snap('2026-01-15', 150),
      snap('2026-02-10', 200),
      snap('2026-04-01', 300),
    ];
    it('returns the latest snapshot at or before the target date', () => {
      const r = findSnapshotOnOrBefore(snapshots, '2026-02-15');
      expect(r?.date).toBe('2026-02-10');
    });
    it('exact-date match wins', () => {
      const r = findSnapshotOnOrBefore(snapshots, '2026-01-15');
      expect(r?.netWorthValue).toBe(150);
    });
    it('returns null when nothing is at or before the target', () => {
      const r = findSnapshotOnOrBefore(snapshots, '2025-12-01');
      expect(r).toBeNull();
    });
  });

  describe('findStartSnapshot', () => {
    it('ALL picks the earliest snapshot', () => {
      const r = findStartSnapshot([snap('2026-03-01'), snap('2026-01-15'), snap('2026-02-01')], 'ALL');
      expect(r?.date).toBe('2026-01-15');
    });
    it('returns null with no snapshots', () => {
      expect(findStartSnapshot([], '1Y')).toBeNull();
      expect(findStartSnapshot([], 'ALL')).toBeNull();
    });
  });
});
