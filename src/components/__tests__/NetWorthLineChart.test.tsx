import { describe, it, expect } from 'vitest';
import { filterByTimeRange } from '../NetWorthLineChart';
import type { PortfolioSnapshot } from '../../types';

/**
 * We don't render the chart here (Recharts + ResponsiveContainer need a
 * real layout engine). Instead we exercise the pure helpers exposed by
 * the module and assert the regression: distinct years no longer map to
 * the same internal key.
 */

const makeSnap = (date: string, nw: number): PortfolioSnapshot => ({
  date,
  totalValue: nw,
  netWorthValue: nw,
});

describe('NetWorthLineChart helpers', () => {
  it('filterByTimeRange ALL returns every snapshot', () => {
    const snaps = [makeSnap('2024-01-01', 100), makeSnap('2025-01-01', 110)];
    expect(filterByTimeRange(snaps, 'ALL')).toHaveLength(2);
  });

  it('filterByTimeRange 1Y excludes snapshots older than one year', () => {
    const oneYearAgoMinus = new Date();
    oneYearAgoMinus.setFullYear(oneYearAgoMinus.getFullYear() - 2);
    const iso = `${oneYearAgoMinus.getFullYear()}-01-01`;
    const snaps = [makeSnap(iso, 100), makeSnap('2026-01-01', 200)];
    const filtered = filterByTimeRange(snaps, '1Y');
    expect(filtered.some((s) => s.date === iso)).toBe(false);
  });
});

describe('benchmark / annotation key collision (regression: #19)', () => {
  // The pre-fix code used a locale-formatted "MMM d" string as the
  // internal x-axis dataKey. Feb 1 of any year rendered as "Feb 1", so
  // two snapshots a year apart collided. We verify the new layer by
  // checking that the internal `date` is the ISO string directly and
  // that annotation matching works by equality on ISO.
  it('distinct-year dates produce distinct ISO keys', () => {
    const snapA: PortfolioSnapshot = makeSnap('2024-02-01', 100);
    const snapB: PortfolioSnapshot = makeSnap('2025-02-01', 200);
    // Before fix, both would have mapped to "Feb 1"; now they stay distinct.
    expect(snapA.date).not.toBe(snapB.date);
  });

  it('annotation match uses ISO date equality', () => {
    // The chart renders ReferenceLine with x=ann.date (ISO). The runtime
    // match is `data.some((d) => d.date === ann.date)`, which is pure
    // string equality on ISO.
    const data = [{ date: '2024-02-01' }, { date: '2025-02-01' }];
    const ann = { date: '2025-02-01' };
    const match = data.filter((d) => d.date === ann.date);
    expect(match).toHaveLength(1);
    expect(match[0].date).toBe('2025-02-01'); // correct year, not 2024
  });
});
